import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const renderer = join(projectRoot, 'scripts', 'render-card-layout.mjs');

function renderMetrics(options = []) {
  const arguments_ = [renderer];
  if (process.env.CARD_LAYOUT_CSS) arguments_.push('--css', process.env.CARD_LAYOUT_CSS);
  arguments_.push(...options);
  return JSON.parse(execFileSync(process.execPath, arguments_, { encoding: 'utf8' }));
}

const metrics = renderMetrics();
const sourceTruth = renderMetrics([
  '--template',
  join(projectRoot, 'test', 'fixtures', 'card-source-of-truth.html'),
  '--width',
  '553',
  '--height',
  '528'
]);
const sourceActorState = renderMetrics([
  '--template',
  join(projectRoot, 'test', 'fixtures', 'source-actor-popover.html'),
  '--width',
  '760',
  '--height',
  '900'
]);

function assertSharedComposition(card, kind) {
  assert.deepEqual(
    {
      title: [card.title.fontSize, card.title.lineHeight, card.title.fontWeight],
      attribution: [card.attribution.fontSize, card.attribution.lineHeight, card.attribution.fontWeight],
      source: [card.source.fontSize, card.source.lineHeight, card.source.fontWeight]
    },
    {
      title: ['20px', '24px', '500'],
      attribution: ['15.5px', '20.925px', '400'],
      source: ['16px', '20.8px', '400']
    },
    `${kind} should retain the source-of-truth title, attribution, and original-link type hierarchy`
  );

  assert.equal(card.spacing.bodyToTitle, 18, `${kind} title should retain the approved body inset`);
  assert.deepEqual(
    [card.attribution.overflow, card.attribution.textOverflow, card.attribution.whiteSpace],
    ['hidden', 'ellipsis', 'nowrap'],
    `${kind} description should remain visible on one ellipsized line`
  );
  assert.ok(
    card.attribution.height <= Number.parseFloat(card.attribution.lineHeight) + 0.01,
    `${kind} description should never exceed one line`
  );
  assert.equal(
    card.spacing.titleToAttribution,
    2,
    `${kind} attribution should sit 2px below the title`
  );
  assert.equal(
    card.spacing.attributionToControls,
    22,
    `${kind} footer controls should sit 22px below the attribution`
  );
  assert.equal(card.spacing.bodyBottom, 20, `${kind} should retain the approved lower inset`);
  assert.equal(card.spacing.sourceToToggle, 10, `${kind} original link should sit 10px from the control`);
  assert.ok(card.spacing.toggleToVerdict >= 60, `${kind} verdict should remain pinned to the right edge`);
  assert.equal(card.spacing.verdictRight, 28, `${kind} verdict should honor the body’s right inset`);
  assert.ok(
    Math.abs(card.spacing.controlCenterDelta) <= 1.1,
    `${kind} control should retain its intentional 8px start-margin offset`
  );

  assert.ok(
    card.toggle.width >= 105 && card.toggle.width <= 115,
    `${kind} Show original control should remain compact`
  );
  assert.equal(card.toggle.height, 24);
  assert.equal(card.toggle.borderRadius, '5px');
  assert.equal(card.verdict.right, card.body.right - 28, `${kind} verdict should align to the content edge`);
  assert.equal(card.source.left, card.body.left + 28, `${kind} original-post link should align to the title edge`);
}

test('renders the approved artwork card typography and control composition', () => {
  const { artwork } = metrics;
  assertSharedComposition(artwork, 'artwork');
  assert.equal(artwork.image.borderRadius, '8px', 'artwork should retain the approved shell radius');
  assert.equal(
    artwork.image.overflow,
    'hidden',
    'the artwork bitmap should be clipped to the approved shell radius'
  );
});

test('renders poetry through the same typography and control composition', () => {
  const { poetry } = metrics;
  assertSharedComposition(poetry, 'poetry');
  assert.deepEqual(
    {
      fontFamily: poetry.poem.fontFamily,
      fontSize: poetry.poem.fontSize,
      fontStyle: poetry.poem.fontStyle,
      lineHeight: poetry.poem.lineHeight,
      overflow: poetry.poem.overflow,
      position: [poetry.poem.x, poetry.poem.y],
      width: poetry.poem.width
    },
    {
      fontFamily: 'system-ui',
      fontSize: '15px',
      fontStyle: 'normal',
      lineHeight: '22.5px',
      overflow: 'scroll',
      position: [poetry.imageLink.x, poetry.imageLink.y],
      width: poetry.imageLink.width
    },
    'poetry should use the requested full-width scrollable system treatment'
  );
  assert.equal(poetry.poem.tabIndex, 0, 'the poem scroll region should be keyboard focusable');
  assert.ok(
    poetry.poem.scrollHeight > poetry.poem.clientHeight,
    'the complete poem should overflow inside the fixed-height reading pane'
  );
});

test('renders the durable image-card source of truth', () => {
  const referencePath = join(projectRoot, 'design', 'references', 'image-card-refinement-75cea9d.png');
  const referenceHash = createHash('sha256').update(readFileSync(referencePath)).digest('hex');
  assert.equal(referenceHash, 'fd416fa317383906f09987cb7e5aa819e23887c50b585cd13f86874aff3d38ea');

  const { artwork } = sourceTruth;
  assert.deepEqual(
    {
      body: artwork.body,
      title: [artwork.title.x, artwork.title.y, artwork.title.fontSize, artwork.title.lineHeight],
      attribution: [
        artwork.attribution.x,
        artwork.attribution.y,
        artwork.attribution.fontSize,
        artwork.attribution.lineHeight
      ],
      source: [artwork.source.x, artwork.source.y, artwork.source.fontSize, artwork.source.lineHeight],
      toggle: [artwork.toggle.x, artwork.toggle.y, artwork.toggle.width, artwork.toggle.height],
      verdict: [artwork.verdict.x, artwork.verdict.y, artwork.verdict.width, artwork.verdict.height],
      image: [artwork.image.x, artwork.image.y, artwork.image.width, artwork.image.height, artwork.image.borderRadius]
    },
    {
      body: { x: 1, y: 398.31, width: 551, height: 130.92, top: 398.31, right: 552, bottom: 529.23, left: 1 },
      title: [29, 416.31, '20px', '24px'],
      attribution: [29, 442.31, '15.5px', '20.925px'],
      source: [29, 485.83, '16px', '20.8px'],
      toggle: [238.52, 485.23, 61.69, 24],
      verdict: [473.64, 485.53, 50.36, 22.39],
      image: [141.02, 33, 270.95, 350.31, '8px']
    },
    'the approved screenshot geometry should remain stable'
  );
});

test('renders the feed-source row and accessible action popover without disturbing the card footer', () => {
  const { artwork } = sourceActorState;
  assert.ok(artwork.sourceActor, 'the feed-source row should render');
  assert.ok(artwork.sourceActorTrigger, 'the feed-source actor should be an interactive trigger');
  assert.ok(artwork.popover, 'the shared popover should render');
  assert.equal(artwork.sourceActor.left, artwork.title.left);
  assert.ok(artwork.sourceActor.top > artwork.attribution.bottom);
  assert.ok(artwork.source.top > artwork.sourceActor.bottom);
  assert.deepEqual(
    [artwork.sourceActor.fontSize, artwork.sourceActor.lineHeight, artwork.sourceActorTrigger.textDecorationLine],
    ['12.5px', '16.875px', 'underline']
  );
  assert.deepEqual(
    [artwork.popover.width, artwork.popover.position, artwork.popover.zIndex, artwork.popover.borderRadius],
    [300, 'fixed', '2147483646', '8px']
  );
  assert.equal(artwork.popoverProfile.fontSize, '16px');
  assert.equal(artwork.popoverUnfollow.width, 266);
});
