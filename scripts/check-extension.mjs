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
  'De-Slop must run in the same child frames that Pangram scans'
);

const requiredHosts = [
  'https://www.wikidata.org/*',
  'https://commons.wikimedia.org/*',
  'https://upload.wikimedia.org/*',
  'https://thefreeverse.org/*',
  'https://raw.githubusercontent.com/*',
  'https://datasets-server.huggingface.co/*',
  'https://images-api.nasa.gov/*',
  'https://images-assets.nasa.gov/*',
  'https://www.newyorker.com/*',
  'https://media.newyorker.com/*'
];
for (const host of requiredHosts) {
  assert.ok(manifest.host_permissions?.includes(host), `Missing host permission: ${host}`);
}
for (const removedHost of [
  'https://collectionapi.metmuseum.org/*',
  'https://images.metmuseum.org/*',
  'https://api.artic.edu/*',
  'https://www.artic.edu/*',
  'https://poetrydb.org/*',
  'https://api.nasa.gov/*',
  'https://apod.nasa.gov/*'
]) {
  assert.ok(!manifest.host_permissions?.includes(removedHost), `Removed host still present: ${removedHost}`);
}

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action?.default_popup,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((entry) => [
    ...(entry.js || []),
    ...(entry.css || [])
  ]),
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  'src/report/report.html',
  'src/report/report.css',
  'src/report/report.js'
].filter(Boolean);

for (const file of referencedFiles) {
  await access(path.join(root, file));
}

console.log(`Checked manifest and ${referencedFiles.length} referenced files.`);
