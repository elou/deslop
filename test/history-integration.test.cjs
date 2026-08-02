const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contentSource = fs.readFileSync(path.join(root, 'src', 'content.js'), 'utf8');

test('loads the local history model before the LinkedIn content script', () => {
  assert.deepEqual(manifest.content_scripts[0].js.slice(0, 3), [
    'src/history-core.js',
    'src/content-core.js',
    'src/content.js'
  ]);
});

test('records only successful Pangram verdict replacements in local extension storage', () => {
  assert.match(contentSource, /const historyCore = globalThis\.PangramGalleryHistory;/);
  assert.match(
    contentSource,
    /if \(!core \|\| !globalThis\.chrome\?\.runtime\?\.id\) return;/,
    'a stale extension manifest must not disable existing card replacement while waiting for reload'
  );
  assert.match(contentSource, /function recordHiddenPangramPost\(card, verdict\)/);
  assert.match(contentSource, /chrome\.storage\.local\.get/);
  assert.match(contentSource, /chrome\.storage\.local\.set/);
  assert.match(contentSource, /historyCore\.recordHiddenPost\(/);
  assert.match(
    contentSource,
    /target\.setAttribute\(STATE_ATTRIBUTE, 'replaced'\);\s*void recordHiddenPangramPost\(card, verdict\);/
  );
  assert.match(
    contentSource,
    /if \(!historyCore \|\| !\['ai', 'mixed', 'ai-assisted'\]\.includes\(verdict\)\) return;/
  );
});

test('serializes history writes and never sends roll-up history to a remote service', () => {
  assert.match(contentSource, /historyWriteQueue = historyWriteQueue\.catch\(\(\) => \{\}\)\.then/);
  assert.doesNotMatch(contentSource, /sendMessage\([^)]*history/i);
  assert.doesNotMatch(contentSource, /fetch\([^)]*history/i);
});

test('contains a rejected local history write immediately during extension reload', () => {
  const recordStart = contentSource.indexOf('function recordHiddenPangramPost');
  const recordEnd = contentSource.indexOf('\n  function cleanName', recordStart);
  const recordSource = contentSource.slice(recordStart, recordEnd);

  assert.match(
    recordSource,
    /historyWriteQueue\s*=\s*historyWriteQueue[\s\S]*?\.catch\(\(\)\s*=>\s*\{\}\);/,
    'storage denial from an invalidated page context must be handled on the same queued promise'
  );
});
