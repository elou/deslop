const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const guardEntry = manifest.content_scripts.find((entry) =>
  entry.js?.includes('src/linkedin-fetch-guard.js')
);

test('loads the LinkedIn extension-probe guard at document start in the page world', () => {
  assert.ok(guardEntry, 'manifest should include the LinkedIn fetch guard');
  assert.deepEqual(guardEntry.matches, ['https://linkedin.com/*', 'https://*.linkedin.com/*']);
  assert.equal(guardEntry.run_at, 'document_start');
  assert.equal(guardEntry.world, 'MAIN');
  assert.equal(guardEntry.all_frames, false);
  assert.ok(fs.existsSync(path.join(root, 'src/linkedin-fetch-guard.js')));
});

test('rejects only LinkedIn’s exact invalid extension probe and delegates normal fetches', async () => {
  const source = fs.readFileSync(path.join(root, 'src/linkedin-fetch-guard.js'), 'utf8');
  const calls = [];
  const nativeFetch = function (...args) {
    calls.push({ thisValue: this, args });
    return Promise.resolve({ ok: true, status: 200 });
  };
  const window = { fetch: nativeFetch };
  vm.runInNewContext(source, { window, URL, TypeError });

  await assert.rejects(
    window.fetch('chrome-extension://invalid/'),
    (error) => error instanceof TypeError && /extension probe/i.test(error.message)
  );
  assert.equal(calls.length, 0);

  const context = { marker: true };
  const response = await window.fetch.call(context, 'https://example.com/data', { method: 'GET' });
  assert.equal(response.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].thisValue, context);
  assert.deepEqual(calls[0].args, ['https://example.com/data', { method: 'GET' }]);
});

test('does not wrap fetch more than once', () => {
  const source = fs.readFileSync(path.join(root, 'src/linkedin-fetch-guard.js'), 'utf8');
  const nativeFetch = () => Promise.resolve({ ok: true });
  const window = { fetch: nativeFetch };
  const context = { window, URL, TypeError };
  vm.runInNewContext(source, context);
  const guardedFetch = window.fetch;
  vm.runInNewContext(source, context);
  assert.equal(window.fetch, guardedFetch);
});
