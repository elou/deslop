import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const renderer = join(projectRoot, 'scripts', 'render-report-layout.mjs');

function render(width, height, scale = 1) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [renderer, '--width', String(width), '--height', String(height), '--scale', String(scale)],
      { encoding: 'utf8' }
    )
  );
}

test('keeps the populated report readable and bounded on desktop', () => {
  const metrics = render(1100, 1000);
  assert.equal(metrics.viewport.width, 1100);
  assert.equal(metrics.bodyScrollWidth, 1100, 'the report should not scroll horizontally');
  assert.equal(metrics.shell.width, 960);
  assert.equal(metrics.privacy.width, 960);
  assert.match(metrics.summaryColumns, /\d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  assert.match(metrics.actorColumns, /\d+(?:\.\d+)?px \d+(?:\.\d+)?px \d+(?:\.\d+)?px \d+(?:\.\d+)?px/);
  assert.ok(metrics.actorRow.height >= 80);
  assert.ok(metrics.reset.height >= 44);
});

test('reflows the populated report without horizontal clipping on mobile', () => {
  const metrics = render(500, 1200);
  assert.equal(metrics.viewport.width, 500);
  assert.equal(metrics.bodyScrollWidth, 500, 'the report should not scroll horizontally');
  assert.equal(metrics.shell.width, 468);
  assert.equal(metrics.privacy.width, 468);
  assert.equal(metrics.summaryColumns, '426px');
  assert.match(metrics.actorColumns, /\d+(?:\.\d+)?px 80px/);
  assert.ok(metrics.actorRow.height >= 150);
  assert.equal(metrics.reset.width, 468);
  assert.ok(metrics.reset.height >= 44);
});
