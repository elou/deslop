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

test('does not hydrate a delayed image after its card was marked offscreen', () => {
  assert.match(
    contentSource,
    /card\.pangramGalleryResident\s*=\s*entry\.isIntersecting/,
    'the observer must persist the latest residency result on the card'
  );
  assert.match(
    contentSource,
    /if \(card\.pangramGalleryResident !== false\) restoreCardImage\(image\)/,
    'hydration must not restore an image after an offscreen observation'
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
    /\.pangram-gallery-card__image-stage\s*\{[^}]*padding:\s*32px\s+32px\s+32px\s+0;[^}]*background:\s*inherit;/s
  );
});

test('show original collapses the art card while keeping its toggle available', () => {
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
    /body\.append\(notice, title, location, toggle\)/,
    'the original toggle should sit below the replacement metadata'
  );
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

test('uses compact metadata controls below the artwork', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card__title\s*\{[^}]*font:\s*500 20px\/1\.2 -apple-system/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__location\s*\{[^}]*margin-block:\s*2px 16px;[^}]*color:\s*inherit;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__source,\s*\n\.pangram-gallery-card__toggle\s*\{[^}]*margin-block-start:\s*6px;[^}]*color:\s*#999;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__toggle\s*\{[^}]*min-block-size:\s*24px;[^}]*padding:\s*10px 10px;/s
  );
});

test('sends each Pangram verdict to the selected stream router', () => {
  assert.match(
    contentSource,
    /type:\s*'PANGRAM_GALLERY_GET_REPLACEMENT',\s*verdict/s
  );
});

test('renders the compact slop-cleansed notice without an original toggle', () => {
  assert.match(contentSource, /item\.kind === 'notice'/);
  assert.match(contentSource, /☢️ Slop cleansed/);
  assert.match(contentSource, /pangram-gallery-card--notice/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__image-stage\s*\{[^}]*display:\s*none;/s
  );
});

test('defines a compact promoted-post hide state', () => {
  assert.match(contentSource, /hidden-promoted/);
  assert.match(contentSource, /collectPromotedTargetsFromMutationRecords/);
  assert.doesNotMatch(
    contentSource,
    /record\.target[\s\S]{0,300}querySelectorAll\?\.\(FEED_ITEM_SELECTOR\)/,
    'mutation targets must not trigger a feed-tree rescan'
  );
  assert.match(contentSource, /💸 Depromoted your feed/);
  assert.match(
    contentSource,
    /hydrateCard\(card, \{ kind: 'notice', title: '💸 Depromoted your feed' \}\)/
  );
});

test('defines a compact suggested-post hide state', () => {
  assert.match(contentSource, /hidden-suggested/);
  assert.match(contentSource, /core\.isSuggestedTarget\(target\)/);
  assert.match(contentSource, /🦟 Desuggested your feed/);
});

test('gives promoted cleanup precedence over suggested cleanup', () => {
  assert.match(
    contentSource,
    /if \(settings\.hidePromoted && promotedTargets\.has\(target\)\)[\s\S]*?hidePromotedTarget\(target\);[\s\S]*?else if \(settings\.hideSuggested && suggestedTargets\.has\(target\)\)[\s\S]*?hideSuggestedTarget\(target\);/
  );
});

test('observes Pangram scanning an existing feed item without rescanning the page', () => {
  assert.match(contentSource, /attributes:\s*true/);
  assert.match(
    contentSource,
    /attributeFilter:\s*\[\s*['"]data-pangram-scanned['"]\s*\]/
  );
});

test('observes Pangram hydrating a verdict in an existing badge text node', () => {
  assert.match(contentSource, /characterData:\s*true/);
});

test('clowns only Pangram-marked AI comments and keeps their words accessible', () => {
  assert.match(contentSource, /core\.findCommentTarget\(badge\)/);
  assert.match(contentSource, /clownCommentTarget\(commentTarget, badge\)/);
  assert.match(contentSource, /commentTarget\.querySelector\?\.\('\[data-pangram-text-id\]'\)/);
  assert.match(contentSource, /clowns\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(contentSource, /root\.classList\.add\(COMMENT_ORIGINAL_CLASS\)/);
  assert.match(contentSource, /root\.after\(clowns\)/);
  assert.doesNotMatch(contentSource, /textNode\.replaceWith/);
  assert.match(
    contentCss,
    /\.pangram-gallery-comment-original\s*\{[^}]*clip:\s*rect\(0, 0, 0, 0\)/s
  );
});
