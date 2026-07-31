const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contentSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'content.js'),
  'utf8'
);
const contentCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'content.css'),
  'utf8'
);

test('mounts a reserved replacement card before requesting museum content', () => {
  const replaceTargetStart = contentSource.indexOf('async function replaceTarget');
  const replaceTargetEnd = contentSource.indexOf('\n  function processBadges', replaceTargetStart);
  const replaceTargetSource = contentSource.slice(replaceTargetStart, replaceTargetEnd);
  const mountIndex = replaceTargetSource.indexOf('target.before(card)');
  const requestIndex = replaceTargetSource.indexOf('await sendMessage');

  assert.notEqual(mountIndex, -1, 'replacement card should be mounted');
  assert.notEqual(requestIndex, -1, 'museum content should be requested');
  assert.ok(
    mountIndex < requestIndex,
    'the reserved card must mount before the museum request starts'
  );
});

test('core QA baseline does not scan or process promoted cleanup targets', () => {
  const initialStart = contentSource.indexOf('function scanInitialDocument');
  const initialEnd = contentSource.indexOf('\n  function hidePromotedTarget', initialStart);
  const mutationStart = contentSource.indexOf('function handleMutations');
  const mutationEnd = contentSource.indexOf('\n  const observer', mutationStart);

  assert.doesNotMatch(
    contentSource.slice(initialStart, initialEnd),
    /processPromotedTargets/,
    'initial core scans must only evaluate Pangram verdict badges'
  );
  assert.doesNotMatch(
    contentSource.slice(mutationStart, mutationEnd),
    /processPromotedTargets/,
    'live core scans must only evaluate Pangram verdict badges'
  );
});

test('reserves a stable four-by-three artwork frame while loading', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-frame\s*\{[^}]*min-block-size:\s*280px;[^}]*aspect-ratio:\s*4\s*\/\s*3;/s
  );
  assert.match(contentCss, /\.pangram-gallery-card--loading/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card__body\s*\{[^}]*min-block-size:\s*\d+px;/s,
    'metadata space should remain stable while the title and source load'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image\s*\{[^}]*max-inline-size:\s*100%;[^}]*max-block-size:\s*100%;[^}]*object-fit:\s*contain;/s,
    'the final image should remain inside the reserved frame without cropping'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-stage\s*\{[^}]*padding:\s*64px\s+48px\s+28px;[^}]*background:\s*inherit;/s
  );
});

test('unhide collapses the replacement card while keeping its control available', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card--original-visible\s*\{[^}]*block-size:\s*0;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--original-visible\s+\.pangram-gallery-card__toggle\s*\{[^}]*top:\s*16px;/s
  );
  assert.match(
    contentSource,
    /body\.append\(notice, title, description, postMeta\)/,
    'the control should sit in the card metadata row'
  );
  assert.match(contentSource, /toggle\.textContent = 'Unhide'/);
});

test('constrains portrait and landscape artwork to the reserved frame', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*margin:\s*auto;/s,
    'the image needs a definite containing block for percentage max sizes'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-frame\s*\{[^}]*position:\s*relative;/s
  );
});

test('renders poem lines inside the same stable replacement frame', () => {
  assert.match(contentSource, /item\.kind === 'poem'/);
  assert.match(contentSource, /lines\.slice\(0,\s*12\)\.join\('\\n'\)/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card__poem\s*\{[^}]*white-space:\s*pre-line;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--poem\s+\.pangram-gallery-card__image-frame/
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__poem\s*\{[^}]*max-inline-size:\s*100%;[^}]*max-block-size:\s*100%;[^}]*font:\s*400 italic clamp\(16px,\s*1\.2vw,\s*20px\)\s*\/\s*1\.5/s
  );
});

test('uses the editorial card anatomy from the visual reference', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card\s*\{[^}]*border-radius:\s*14px;[^}]*box-shadow:\s*0 18px 44px/s,
    'the replacement should be a softly shadowed rounded surface'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-frame\s*\{[^}]*inline-size:\s*min\(90%,\s*560px\);[^}]*border-radius:\s*14px;/s,
    'artwork should be centered in a bounded, rounded frame'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__title\s*\{[^}]*font:\s*520 30px\/1\.15 -apple-system/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__description\s*\{[^}]*font:\s*400 20px\/1\.35 -apple-system/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__post-meta\s*\{[^}]*display:\s*flex;[^}]*margin-block-start:\s*34px;[^}]*min-block-size:\s*44px;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__author\s*\{[^}]*text-decoration:\s*underline;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__toggle\s*\{[^}]*min-block-size:\s*44px;[^}]*text-transform:\s*uppercase;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__verdict\s*\{[^}]*margin-inline-start:\s*auto;[^}]*background:\s*#ffe2e5;/s
  );
  assert.match(
    contentSource,
    /postMeta\.append\(byline, toggle, verdictChip\)/,
    'every card should include author, unhide, and Pangram verdict controls'
  );
});

test('sends each Pangram verdict to the selected stream router', () => {
  assert.match(
    contentSource,
    /type:\s*'PANGRAM_GALLERY_GET_REPLACEMENT',\s*verdict/s
  );
});

test('renders the compact slop-cleansed notice with an unhide control', () => {
  assert.match(contentSource, /item\.kind === 'notice'/);
  assert.match(contentSource, /☢️ Slop cleansed/);
  assert.match(contentSource, /pangram-gallery-card--notice/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__image-stage\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__body\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s
  );
});

test('does not define a promoted-post hide state in the core QA baseline', () => {
  assert.doesNotMatch(contentSource, /hidden-promoted/);
  assert.doesNotMatch(contentSource, /collectPromotedTargetsFromMutationRecords/);
  assert.doesNotMatch(contentSource, /💸 Unpromoted a post/);
});
