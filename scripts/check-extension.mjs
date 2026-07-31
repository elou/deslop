import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.background?.service_worker);
assert.ok(Array.isArray(manifest.content_scripts));
assert.ok(manifest.permissions?.includes('storage'));
assert.equal(
  manifest.content_scripts[0]?.all_frames,
  true,
  'Pangram Gallery must run in the same child frames that Pangram scans'
);

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((entry) => [
    ...(entry.js || []),
    ...(entry.css || [])
  ]),
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
].filter(Boolean);

for (const file of referencedFiles) {
  await access(path.join(root, file));
}

console.log(`Checked manifest and ${referencedFiles.length} referenced files.`);
