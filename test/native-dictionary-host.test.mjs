import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the installer can target an isolated Chrome profile', () => {
  const installer = readFileSync(
    path.join(root, 'scripts/install-dictionary-host.sh'),
    'utf8'
  );
  assert.match(installer, /DESLOP_NATIVE_MANIFEST_DIR/);
});

test('the native host returns a framed system Dictionary definition', {
  skip: process.platform !== 'darwin'
}, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'deslop-dictionary-'));
  const binary = path.join(directory, 'dictionary-host');
  try {
    const compile = spawnSync('swiftc', [
      path.join(root, 'native/dictionary-host/main.swift'),
      '-framework',
      'CoreServices',
      '-o',
      binary
    ], { encoding: 'utf8' });
    assert.equal(compile.status, 0, compile.stderr);

    const payload = Buffer.from(JSON.stringify({
      type: 'define',
      term: 'serendipity'
    }));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length);
    const result = spawnSync(binary, [], {
      input: Buffer.concat([header, payload])
    });

    assert.equal(result.status, 0, result.stderr.toString());
    assert.ok(result.stdout.length > 4);
    const length = result.stdout.readUInt32LE(0);
    const response = JSON.parse(result.stdout.subarray(4, 4 + length).toString());
    assert.equal(response.ok, true);
    assert.equal(response.source, 'macOS Dictionary');
    assert.match(response.definition, /serendipity/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
