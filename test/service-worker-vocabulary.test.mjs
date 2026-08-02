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

test('the service worker keeps saved vocabulary dormant and repairs stale routing', async () => {
  const listeners = {};
  const local = {
    [STORAGE_KEY]: {
      enabled: true,
      entries: [{ id: 'saved', term: 'erudition' }]
    }
  };
  const sync = {
    streams: {
      ai: 'vocabulary',
      mixed: 'vocabulary',
      assisted: 'vocabulary',
      promoted: 'vocabulary',
      suggested: 'vocabulary'
    }
  };

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
    runtime: {
      lastError: undefined,
      onInstalled: { addListener(listener) { listeners.installed = listener; } },
      onMessage: { addListener(listener) { listeners.message = listener; } }
    },
    storage: {
      local: area(local),
      sync: area(sync),
      onChanged: { addListener(listener) { listeners.storageChange = listener; } }
    }
  };

  await import(`../src/background/service-worker.mjs?test=${Date.now()}`);
  listeners.installed({ reason: 'install' });
  await waitFor(() => sync.streams?.ai === 'painting-classics');

  assert.equal(listeners.contextClick, undefined);
  assert.equal(local[STORAGE_KEY].entries[0].term, 'erudition');
  assert.deepEqual(sync.streams, {
    ai: 'painting-classics',
    mixed: 'painting-classics',
    assisted: 'painting-classics',
    promoted: 'painting-classics',
    suggested: 'painting-classics'
  });

  delete globalThis.chrome;
});
