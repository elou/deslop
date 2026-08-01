import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const renderer = join(projectRoot, 'scripts', 'render-card-layout.mjs');

function renderMetrics() {
  const arguments_ = [renderer];
  if (process.env.CARD_LAYOUT_CSS) arguments_.push('--css', process.env.CARD_LAYOUT_CSS);
  return JSON.parse(execFileSync(process.execPath, arguments_, { encoding: 'utf8' }));
}

const metrics = renderMetrics();

function assertSharedComposition(card, kind) {
  assert.deepEqual(
    {
      title: [card.title.fontSize, card.title.lineHeight, card.title.fontWeight],
      attribution: [card.attribution.fontSize, card.attribution.lineHeight, card.attribution.fontWeight],
      source: [card.source.fontSize, card.source.lineHeight, card.source.fontWeight]
    },
    {
      title: ['20px', '24px', '500'],
      attribution: ['20px', '27px', '400'],
      source: ['17px', '22.1px', '400']
    },
    `${kind} should retain the approved restrained title, attribution, and original-link type hierarchy`
  );

  assert.ok(card.spacing.bodyToTitle >= 22 && card.spacing.bodyToTitle <= 35);
  assert.ok(card.spacing.titleToAttribution >= 16 && card.spacing.titleToAttribution <= 26);
  assert.ok(card.spacing.attributionToControls >= 30 && card.spacing.attributionToControls <= 46);
  assert.ok(card.spacing.bodyBottom >= 36 && card.spacing.bodyBottom <= 49);
  assert.equal(card.spacing.sourceToToggle, 12, `${kind} original link should sit 12px from the control`);
  assert.equal(card.spacing.toggleToVerdict, 12, `${kind} control should sit 12px from the verdict`);
  assert.equal(card.spacing.verdictRight, 56, `${kind} verdict should honor the body’s right inset`);
  assert.ok(
    Math.abs(card.spacing.controlCenterDelta) <= 0.5,
    `${kind} control and verdict should share a visual center`
  );

  assert.ok(
    card.toggle.width >= 120 && card.toggle.width <= 135,
    `${kind} Show original control should remain compact`
  );
  assert.equal(card.toggle.height, 37.59);
  assert.equal(card.toggle.borderRadius, '5px');
  assert.equal(card.verdict.right, card.body.right - 56, `${kind} verdict should align to the content edge`);
  assert.equal(card.source.left, card.body.left + 56, `${kind} original-post link should align to the title edge`);
}

test('renders the approved artwork card typography and control composition', () => {
  const { artwork } = metrics;
  assertSharedComposition(artwork, 'artwork');
  assert.equal(artwork.image.borderRadius, '14px', 'artwork should retain the approved corner treatment');
});

test('renders poetry through the same typography and control composition', () => {
  const { poetry } = metrics;
  assertSharedComposition(poetry, 'poetry');
  assert.equal(poetry.poem.fontSize, '16px');
  assert.equal(poetry.poem.lineHeight, '24px');
});
