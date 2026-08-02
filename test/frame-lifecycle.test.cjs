const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contentSource = fs.readFileSync(path.join(root, 'src', 'content.js'), 'utf8');

test('runs feed replacement only in the top frame across LinkedIn refreshes', () => {
  const contentScript = manifest.content_scripts[0];

  assert.notEqual(
    contentScript.all_frames,
    true,
    'injecting scripts and CSS into transient LinkedIn subframes creates invalid extension-resource requests on refresh'
  );

  const startupGuard = contentSource.slice(0, contentSource.indexOf('const CARD_CLASS'));
  assert.match(
    startupGuard,
    /window\.top\s*!==\s*window/,
    'a stale or explicitly injected subframe context must exit before touching storage or mounting observers'
  );
});
