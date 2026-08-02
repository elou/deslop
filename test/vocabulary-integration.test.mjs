import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const worker = await readFile(
  path.join(root, 'src/background/service-worker.mjs'),
  'utf8'
);

test('keeps selection capture and native definitions dormant in the release', () => {
  assert.ok(!manifest.permissions.includes('contextMenus'));
  assert.ok(!manifest.permissions.includes('nativeMessaging'));
  assert.match(worker, /VOCABULARY_FEATURE_ENABLED && chrome\.contextMenus/);
  assert.match(worker, /contexts:\s*\['selection'\]/);
  assert.match(worker, /info\.selectionText/);
  assert.match(worker, /chrome\.runtime\.sendNativeMessage/);
  assert.match(worker, /com\.elou\.deslop\.dictionary/);
});

test('stores vocabulary locally and prevents content-script access', () => {
  assert.match(worker, /storageGet\('local'/);
  assert.match(worker, /storageSet\('local'/);
  assert.match(worker, /accessLevel:\s*'TRUSTED_CONTEXTS'/);
});

test('falls back to Painting Classics for a stale vocabulary request', () => {
  assert.match(
    worker,
    /selectedStream === VOCABULARY_STREAM_ID[\s\S]*\? 'painting-classics'/
  );
});
