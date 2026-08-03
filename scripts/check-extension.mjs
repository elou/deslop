import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.ok(
  typeof manifest.key === 'string' && manifest.key.length > 40,
  'Unpacked installs must use one stable manifest key so canonical and worktree paths cannot run as competing extension IDs'
);
const extensionId = [...createHash('sha256')
  .update(Buffer.from(manifest.key, 'base64'))
  .digest()
  .subarray(0, 16)]
  .map((byte) => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)))
  .join('');
assert.equal(
  extensionId,
  'fdopmnabjnidbaigfgdfelcnpcmgiopg',
  'The manifest key must keep the chosen De-Slop development extension ID stable'
);
assert.ok(manifest.background?.service_worker);
assert.ok(Array.isArray(manifest.content_scripts));
assert.ok(manifest.permissions?.includes('storage'));
assert.ok(!manifest.permissions?.includes('contextMenus'));
assert.ok(!manifest.permissions?.includes('nativeMessaging'));
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
  'https://sallysbakingaddiction.com/*'
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
  'https://apod.nasa.gov/*',
  'https://api.nga.gov/*',
  'https://data.rijksmuseum.nl/*',
  'https://iiif.micr.io/*',
  'https://www.newyorker.com/*',
  'https://media.newyorker.com/*'
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

const smokeSource = await readFile(
  path.join(root, 'scripts/smoke-live-extension.mjs'),
  'utf8'
);
assert.match(
  smokeSource,
  /Buffer\.from\(manifest\.key, 'base64'\)/,
  'The live smoke must open the stable manifest-key extension ID'
);
assert.doesNotMatch(
  smokeSource,
  /extensionIdForPath/,
  'The live smoke must not fall back to a path-derived extension ID'
);

console.log(`Checked manifest and ${referencedFiles.length} referenced files.`);
