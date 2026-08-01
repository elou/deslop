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

test('keeps promoted cleanup on its own explicit target path', () => {
  assert.match(contentSource, /function processPromotedTargets\(/);
  assert.match(contentSource, /core\.collectPromotedTargets\(document\)/);
  assert.match(contentSource, /core\.collectPromotedTargetsFromMutationRecords\(records\)/);
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
    /\.pangram-gallery-card__image\s*\{[^}]*max-inline-size:\s*100%\s*!important;[^}]*max-block-size:\s*100%\s*!important;[^}]*object-fit:\s*contain;/s,
    'the final image should remain inside the reserved frame without cropping'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-stage\s*\{[^}]*padding:\s*32px\s+32px\s+32px\s+0;[^}]*background:\s*inherit;/s,
    'the image should sit in a generous, centered stage'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image-frame\s*\{[^}]*inline-size:\s*min\(90%,\s*560px\)\s*!important;[^}]*max-inline-size:\s*560px\s*!important;[^}]*justify-self:\s*center;[^}]*margin-inline:\s*auto;[^}]*border-radius:\s*14px;/s,
    'the image frame should be visually bounded without changing the card metadata'
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
    /body\.append\(notice, title, location, toggle\);[\s\S]*body\.append\(source, verdictChip\);/,
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

test('renders poem lines inside the same stable replacement frame and gallery shell', () => {
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
  assert.doesNotMatch(
    contentCss,
    /\.pangram-gallery-card--poem[^,{]*\.(?:pangram-gallery-card__title|pangram-gallery-card__location|pangram-gallery-card__source|pangram-gallery-card__toggle|pangram-gallery-card__verdict)[^{]*\{[^}]*display:\s*none;/s,
    'poetry cards must retain the shared metadata and footer'
  );
  assert.match(
    contentSource,
    /card\.classList\.add\('pangram-gallery-card--poem'\);[\s\S]*if \(item\.kind !== 'notice'\) \{[\s\S]*renderOriginalPostAuthor\(card\);/,
    'poetry should hydrate through the same metadata and original-post footer path as artwork'
  );
});

test('builds one tuned wrapping metadata and control composition for every full card', () => {
  assert.match(contentSource, /body\.append\(notice, title, location, toggle\);/);
  assert.match(contentSource, /body\.append\(source, verdictChip\);/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card__body\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*align-items:\s*center;[^}]*column-gap:\s*12px;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__title\s*\{[^}]*flex-basis:\s*100%;[^}]*font:\s*500 20px\s*\/\s*1\.2 -apple-system/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__location\s*\{[^}]*flex-basis:\s*100%;[^}]*margin-block-start:\s*2px;[^}]*margin-block-end:\s*16px;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__source\s*\{[^}]*order:\s*1;[^}]*flex:\s*1 1 0;[^}]*margin-block-start:\s*6px;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__toggle\s*\{[^}]*order:\s*2;[^}]*min-block-size:\s*24px;[^}]*margin-block-start:\s*6px;[^}]*padding:\s*10px\s+10px;[^}]*text-transform:\s*uppercase;/s
  );
});

test('uses the approved artwork radius and shared subtle toggle hover', () => {
  assert.match(
    contentCss,
    /\.pangram-gallery-card__image\s*\{[^}]*border-radius:\s*14px;/s,
    'artwork should use the approved 14px radius'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__toggle\s*\{[^}]*transition:\s*background-color 200ms[^;]*,\s*border-color 200ms[^;]*,\s*color 200ms[^;]*;/s,
    'every toggle should animate its hover treatment over 200ms'
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__toggle:hover\s*\{[^}]*background:\s*rgba\(0, 0, 0, 0\.04\);[^}]*color:\s*#666 !important;[^}]*border-color:\s*rgba\(0, 0, 0, 0\.3\) !important;/s,
    'image and notice toggles should share the subtle gray hover treatment'
  );
});

test('sends each Pangram verdict to the selected stream router', () => {
  assert.match(
    contentSource,
    /type:\s*'PANGRAM_GALLERY_GET_REPLACEMENT',\s*verdict/s
  );
});

test('links replacement artwork and its title to the item source', () => {
  assert.match(
    contentSource,
    /imageFrame\.append\(imageLink, poem\)/,
    'artwork should be wrapped in its source link'
  );
  assert.match(contentSource, /imageLink\.href = item\.sourceUrl/);
  assert.match(contentSource, /title\.href = item\.sourceUrl/);
});

test('keeps creator, date, and location metadata visible on image replacement cards', () => {
  assert.doesNotMatch(
    contentSource,
    /location\.hidden = item\.kind !== 'poem';/,
    'image cards should retain the creator, date, or location line from the refined card design'
  );
  assert.match(contentSource, /location\.textContent = core\.formatCardDetails\(item\);/);
});

test('shows the Pangram verdict at the right of the replacement footer', () => {
  assert.match(contentSource, /pangram-gallery-card__verdict/);
  assert.match(contentSource, /verdict === 'promoted'/);
  assert.match(contentSource, /verdict === 'suggested'/);
  assert.match(contentSource, /verdictChip\.setAttribute\('aria-label', `Pangram verdict: \$\{verdictLabel\}`\);/);
  assert.match(contentSource, /body\.append\(source, verdictChip\);/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card__verdict\s*\{[^}]*order:\s*3;[^}]*margin-inline-start:\s*auto;/s
  );
});

test('links the original post author to the post permalink or their profile', () => {
  assert.match(contentSource, /function getOriginalPostPermalink\(target\)/);
  assert.match(contentSource, /function getOriginalPostAuthor\(target\)/);
  assert.match(contentSource, /const isFeedUpdate =/);
  assert.match(contentSource, /const isPostPage =/);
  assert.match(contentSource, /url\.origin === window\.location\.origin/);
  assert.match(contentSource, /querySelector\('\[data-urn\*="activity:"\]'\)/);
  assert.doesNotMatch(contentSource, /a\[href\*="\\\/feed\\\/update\\\/"\]/);
  assert.match(contentSource, /card\.pangramGalleryPermalink = getOriginalPostPermalink\(target\)/);
  assert.match(contentSource, /card\.pangramGalleryAuthor = getOriginalPostAuthor\(target\)/);
  assert.match(contentSource, /source\.textContent = postAuthor \? 'Original post by ' : 'Original post';/);
  assert.match(contentSource, /const authorDestination = card\.pangramGalleryPermalink \|\| postAuthor\.href;/);
  assert.match(contentSource, /author\.removeAttribute\('href'\);/);
  assert.match(contentSource, /author\.textContent = postAuthor\.name;/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card__author\s*\{[^}]*text-decoration:\s*underline;/s
  );
});

test('renders each hide variant as a compact notice with an unhide control', () => {
  assert.match(contentSource, /item\.kind === 'notice'/);
  assert.match(contentSource, /☢️ AI post hidden/);
  assert.match(contentSource, /toggle\.textContent = 'Unhide'/);
  assert.match(contentSource, /pangram-gallery-card--notice/);
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__image-stage\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice\s*\{[^}]*margin-block:\s*0;[^}]*border-color:\s*rgba\(0, 0, 0, 0\.15\);[^}]*border-radius:\s*12px;[^}]*background:\s*transparent;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__body\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*min-block-size:\s*0;[^}]*padding:\s*8px 8px 8px 16px;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__title,\s*\.pangram-gallery-card--notice \.pangram-gallery-card__location\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card__notice\s*\{[^}]*color:\s*#777;[^}]*font:\s*400 15px\/1\.4[^;]*;[^}]*text-shadow:\s*0 1px rgba\(255, 255, 255, 0\.4\);/s
  );
  assert.match(
    contentCss,
    /\.pangram-gallery-card--notice \.pangram-gallery-card__toggle\s*\{[^}]*display:\s*inline-flex;[^}]*margin-inline-start:\s*auto;[^}]*color:\s*#888;[^}]*font-size:\s*13px;[^}]*font-weight:\s*500;[^}]*border-color:\s*rgba\(0, 0, 0, 0\.2\);/s
  );
});

test('resolves the original author from the post control menu and rejects feed navigation URLs', () => {
  assert.match(
    contentSource,
    /button\[aria-label\^="Open control menu for post by "\]/
  );
  assert.match(contentSource, /data-pangram-author-handle/);
  assert.match(contentSource, /function isOriginalPostPermalink\(/);
  assert.match(contentSource, /function isOriginalAuthorProfile\(/);
  assert.match(contentSource, /function scheduleOriginalMetadataRefresh\(/);
});

test('processes promoted feed targets independently of Pangram verdict badges', () => {
  assert.match(contentSource, /function processPromotedTargets\(/);
  assert.match(contentSource, /core\.collectPromotedTargets\(document\)/);
  assert.match(contentSource, /core\.collectPromotedTargetsFromMutationRecords\(records\)/);
  assert.match(contentSource, /core\.getStreamForCleanup\(settings, 'promoted'\)/);
});

test('processes Suggested feed targets independently of Pangram verdict badges', () => {
  assert.match(contentSource, /function processSuggestedTargets\(/);
  assert.match(contentSource, /core\.collectSuggestedTargets\(document\)/);
  assert.match(contentSource, /core\.collectSuggestedTargetsFromMutationRecords\(records\)/);
  assert.match(contentSource, /core\.getStreamForCleanup\(settings, 'suggested'\)/);
});
