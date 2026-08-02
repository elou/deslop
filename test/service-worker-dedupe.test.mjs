import assert from 'node:assert/strict';
import test from 'node:test';

function installChromeStub() {
  const listeners = {};
  const area = {
    get(defaults, callback) { callback(defaults); },
    set(_value, callback) { callback?.(); },
    setAccessLevel() { return Promise.resolve(); }
  };

  globalThis.chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: { addListener(listener) { listeners.message = listener; } }
    },
    storage: {
      local: area,
      sync: area,
      onChanged: { addListener() {} }
    }
  };
  return listeners;
}

function dispatchMessage(listener, message) {
  return new Promise((resolve) => {
    assert.equal(listener(message, {}, resolve), true);
  });
}

test('duplicate production requests call the provider once and reuse its result', async () => {
  installChromeStub();
  const { createReplacementRequestCache, resolveReplacementRequest } = await import(
    `../src/background/service-worker.mjs?dedupe=${Date.now()}`
  );
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const cache = createReplacementRequestCache({ ttlMs: 1_000, maxEntries: 10 });
  const load = async () => {
    calls += 1;
    await pending;
    return { title: 'One stable replacement' };
  };

  const request = {
    postKey: 'post-1',
    verdict: 'ai',
    stream: 'painting-classics'
  };
  const first = resolveReplacementRequest(request, load, cache);
  const second = resolveReplacementRequest(request, load, cache);
  release();

  assert.strictEqual(await first, await second);
  assert.deepEqual(
    await resolveReplacementRequest(request, load, cache),
    { title: 'One stable replacement' }
  );
  assert.equal(calls, 1);
  delete globalThis.chrome;
});

test('failed production requests back off and retry after the negative TTL', async () => {
  installChromeStub();
  const { createReplacementRequestCache, resolveReplacementRequest } = await import(
    `../src/background/service-worker.mjs?backoff=${Date.now()}`
  );
  let now = 100;
  let calls = 0;
  const cache = createReplacementRequestCache({
    negativeTtlMs: 25,
    now: () => now
  });
  const request = {
    postKey: 'rate-limited-post',
    verdict: 'ai',
    stream: 'painting-classics'
  };
  const load = async () => {
    calls += 1;
    throw new Error('HTTP 429');
  };

  await assert.rejects(resolveReplacementRequest(request, load, cache), /429/);
  await assert.rejects(resolveReplacementRequest(request, load, cache), /429/);
  assert.equal(calls, 1);

  now += 26;
  await assert.rejects(resolveReplacementRequest(request, load, cache), /429/);
  assert.equal(calls, 2);
  delete globalThis.chrome;
});

test('verdict and stream remain separate production request keys', async () => {
  installChromeStub();
  const { createReplacementRequestCache, resolveReplacementRequest } = await import(
    `../src/background/service-worker.mjs?keys=${Date.now()}`
  );
  let calls = 0;
  const cache = createReplacementRequestCache();
  const load = async () => ({ call: ++calls });

  const aiArt = await resolveReplacementRequest(
    { postKey: 'post-1', verdict: 'ai', stream: 'painting-classics' },
    load,
    cache
  );
  const mixedArt = await resolveReplacementRequest(
    { postKey: 'post-1', verdict: 'mixed', stream: 'painting-classics' },
    load,
    cache
  );
  const aiPoetry = await resolveReplacementRequest(
    { postKey: 'post-1', verdict: 'ai', stream: 'classic-poetry' },
    load,
    cache
  );

  assert.deepEqual([aiArt.call, mixedArt.call, aiPoetry.call], [1, 2, 3]);
  delete globalThis.chrome;
});

test('production requests without a post key bypass the cache', async () => {
  installChromeStub();
  const { createReplacementRequestCache, resolveReplacementRequest } = await import(
    `../src/background/service-worker.mjs?anonymous=${Date.now()}`
  );
  let calls = 0;
  const cache = createReplacementRequestCache();
  const load = async () => ({ call: ++calls });
  const request = { verdict: 'ai', stream: 'painting-classics' };

  assert.deepEqual(await resolveReplacementRequest(request, load, cache), { call: 1 });
  assert.deepEqual(await resolveReplacementRequest(request, load, cache), { call: 2 });
  delete globalThis.chrome;
});

test('production invalidation removes a cached success so the next GET reloads', async () => {
  installChromeStub();
  const {
    createReplacementRequestCache,
    invalidateReplacementRequest,
    resolveReplacementRequest
  } = await import(
    `../src/background/service-worker.mjs?invalidate=${Date.now()}`
  );
  let calls = 0;
  const cache = createReplacementRequestCache();
  const load = async () => ({ call: ++calls });
  const request = {
    postKey: 'broken-image-post',
    verdict: 'ai',
    stream: 'painting-classics'
  };

  assert.deepEqual(await resolveReplacementRequest(request, load, cache), { call: 1 });
  assert.deepEqual(await resolveReplacementRequest(request, load, cache), { call: 1 });
  assert.equal(invalidateReplacementRequest(request, cache), true);
  assert.deepEqual(await resolveReplacementRequest(request, load, cache), { call: 2 });
  assert.equal(calls, 2);
  delete globalThis.chrome;
});

test('the runtime invalidation message removes the exact cached replacement', async () => {
  const listeners = installChromeStub();
  await import(`../src/background/service-worker.mjs?runtime-invalidate=${Date.now()}`);
  const request = {
    postKey: 'runtime-post',
    verdict: 'ai',
    stream: 'hide-ai'
  };

  const first = await dispatchMessage(listeners.message, {
    ...request,
    type: 'PANGRAM_GALLERY_GET_REPLACEMENT'
  });
  const invalidation = await dispatchMessage(listeners.message, {
    ...request,
    type: 'PANGRAM_GALLERY_INVALIDATE_REPLACEMENT'
  });
  const repeatedInvalidation = await dispatchMessage(listeners.message, {
    ...request,
    type: 'PANGRAM_GALLERY_INVALIDATE_REPLACEMENT'
  });

  assert.equal(first.ok, true);
  assert.deepEqual(invalidation, { ok: true, invalidated: true });
  assert.deepEqual(repeatedInvalidation, { ok: true, invalidated: false });
  delete globalThis.chrome;
});

test('replacement request cache expires results and evicts its oldest entry', async () => {
  installChromeStub();
  const { createReplacementRequestCache } = await import(
    `../src/background/service-worker.mjs?bounds=${Date.now()}`
  );
  let now = 10;
  let calls = 0;
  const cache = createReplacementRequestCache({
    ttlMs: 50,
    maxEntries: 2,
    now: () => now
  });
  const load = async () => ({ call: ++calls });

  await cache.get('one', load);
  now += 1;
  await cache.get('two', load);
  now += 1;
  await cache.get('three', load);
  assert.deepEqual(await cache.get('one', load), { call: 4 });

  now += 51;
  assert.deepEqual(await cache.get('one', load), { call: 5 });
  delete globalThis.chrome;
});
