import assert from 'node:assert/strict';
import test from 'node:test';

import { STORAGE_KEY } from '../src/vocabulary-core.mjs';

function waitFor(predicate, timeout = 1000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (predicate()) return resolve();
      if (Date.now() - started > timeout) {
        reject(new Error('Timed out waiting for service-worker state'));
        return;
      }
      setTimeout(check, 5);
    }
    check();
  });
}

test('the service worker saves a selection, resolves its definition, and serves it', async () => {
  const listeners = {};
  const local = {};
  const sync = {};
  let createdMenu = null;

  function area(store) {
    return {
      get(defaults, callback) {
        callback({ ...defaults, ...store });
      },
      set(value, callback) {
        Object.assign(store, value);
        callback?.();
      },
      setAccessLevel() {
        return Promise.resolve();
      }
    };
  }

  globalThis.chrome = {
    contextMenus: {
      removeAll(callback) { callback(); },
      create(value) { createdMenu = value; },
      onClicked: { addListener(listener) { listeners.contextClick = listener; } }
    },
    runtime: {
      lastError: undefined,
      onInstalled: { addListener(listener) { listeners.installed = listener; } },
      onMessage: { addListener(listener) { listeners.message = listener; } },
      sendNativeMessage(host, request, callback) {
        assert.equal(host, 'com.elou.deslop.dictionary');
        assert.equal(request.term, 'accidental multiple words');
        queueMicrotask(() => callback({
          ok: true,
          definition: 'A test definition.',
          source: 'macOS Dictionary'
        }));
      }
    },
    storage: {
      local: area(local),
      sync: area(sync),
      onChanged: { addListener(listener) { listeners.storageChange = listener; } }
    }
  };

  await import(`../src/background/service-worker.mjs?test=${Date.now()}`);
  listeners.installed({ reason: 'install' });
  assert.deepEqual(createdMenu.contexts, ['selection']);

  listeners.contextClick({
    menuItemId: createdMenu.id,
    selectionText: '  accidental multiple words  '
  });
  await waitFor(() => local[STORAGE_KEY]?.entries?.[0]?.definitionStatus === 'defined');

  const [entry] = local[STORAGE_KEY].entries;
  assert.equal(entry.term, 'accidental multiple words');
  assert.equal(entry.definition, 'A test definition.');

  local[STORAGE_KEY] = {
    ...local[STORAGE_KEY],
    enabled: true
  };
  const response = await new Promise((resolve) => {
    const keepsChannelOpen = listeners.message(
      {
        type: 'PANGRAM_GALLERY_GET_REPLACEMENT',
        verdict: 'ai',
        stream: 'vocabulary'
      },
      {},
      resolve
    );
    assert.equal(keepsChannelOpen, true);
  });

  assert.equal(response.ok, true);
  assert.equal(response.item.title, 'accidental multiple words');
  assert.deepEqual(response.item.lines, ['A test definition.']);

  delete globalThis.chrome;
});
