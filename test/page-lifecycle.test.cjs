const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('injects extension resources only on supported feed routes', () => {
  const matches = manifest.content_scripts[0].matches;

  assert.deepEqual(matches, [
    'https://*.linkedin.com/feed/*',
    'https://*.x.com/home*'
  ]);
});

async function startContentRuntime(urlValue) {
  const url = new URL(urlValue);
  const calls = {
    observers: 0,
    storageListeners: 0,
    storageReads: 0
  };

  class MutationObserver {
    constructor() {
      calls.observers += 1;
    }

    observe() {}
  }

  const documentElement = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: () => []
  };
  const document = {
    documentElement,
    querySelectorAll: () => []
  };
  const window = {
    location: {
      href: url.href,
      hostname: url.hostname,
      origin: url.origin,
      pathname: url.pathname
    },
    setTimeout: () => 1
  };
  window.top = window;

  const context = {
    chrome: {
      runtime: { id: 'page-lifecycle-test' },
      storage: {
        sync: {
          get: (_defaults, callback) => {
            calls.storageReads += 1;
            callback({});
          }
        },
        onChanged: {
          addListener: () => {
            calls.storageListeners += 1;
          }
        }
      }
    },
    document,
    MutationObserver,
    window
  };
  context.globalThis = context;
  vm.createContext(context);

  for (const filename of ['history-core.js', 'content-core.js', 'content.js']) {
    const source = fs.readFileSync(path.join(root, 'src', filename), 'utf8');
    vm.runInContext(source, context);
  }
  await new Promise(setImmediate);
  return calls;
}

test('does not initialize the feed runtime on a LinkedIn profile page', async () => {
  const calls = await startContentRuntime('https://www.linkedin.com/in/emmiecampbell/');

  assert.deepEqual(
    calls,
    { observers: 0, storageListeners: 0, storageReads: 0 },
    'profile pages must not start feed storage or document-wide mutation work'
  );
});

test('initializes the feed runtime on the LinkedIn feed', async () => {
  const calls = await startContentRuntime('https://www.linkedin.com/feed/');

  assert.equal(calls.observers, 1);
  assert.equal(calls.storageListeners, 1);
  assert.equal(calls.storageReads, 1);
});
