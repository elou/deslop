const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const optionsHtml = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'options', 'options.html'),
  'utf8'
);
const optionsSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'options', 'options.js'),
  'utf8'
);
const optionsCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'options', 'options.css'),
  'utf8'
);

test('keeps the core QA build branded as De-Slop', () => {
  assert.match(optionsHtml, />De-Slop</);
  assert.match(optionsHtml, /id="close-options"/);
  assert.match(optionsCss, /\.close-options[\s\S]*width: 32px/);
  assert.match(optionsCss, /\.close-options[\s\S]*font-size: 20px/);
  assert.doesNotMatch(optionsHtml, /<small>/);
  assert.match(optionsHtml, /Pangram Filters/);
  assert.doesNotMatch(optionsHtml, /Show for every replacement/);
  assert.doesNotMatch(optionsHtml, /<span>Show<\/span>/);
  assert.doesNotMatch(optionsHtml, /<footer class="footer">/);
});

test('uses a transparent, optically large toolbar icon', () => {
  const iconSource = fs.readFileSync(
    path.join(__dirname, '..', 'assets', 'icon.svg'),
    'utf8'
  );
  assert.doesNotMatch(iconSource, /<rect\b/);
  assert.match(iconSource, /font-size="104"/);
});

test('uses a transparent popup canvas so the rounded panel is the only surface', () => {
  assert.match(optionsCss, /html,\s*body\s*\{[\s\S]*background:\s*transparent;/);
});

test('does not expose a redundant global replacement switch', () => {
  assert.doesNotMatch(optionsHtml, /Replace flagged posts/);
  assert.doesNotMatch(optionsHtml, /id="enabled"/);
  assert.doesNotMatch(optionsSource, /controls\.enabled/);
  assert.doesNotMatch(optionsCss, /\.switch-track|\.section-status/);
});

test('keeps the compact options-panel styling hooks in the source', () => {
  assert.doesNotMatch(optionsHtml, /panel-subheader|pangram-verdicts|stream-picker-cleanup/);
  assert.match(optionsCss, /#verdict-heading/);
  assert.match(optionsCss, /#cleanup-heading/);
  assert.match(optionsCss, /#verdict-heading,[\s\S]*font-size: 13px/);
  assert.match(optionsCss, /\.section\[aria-labelledby="cleanup-heading"\] \.stream-picker/);
  assert.match(optionsCss, /border-radius: 12px/);
  assert.match(optionsCss, /body \{[\s\S]*overflow: hidden/);
  assert.match(optionsCss, /box-shadow: 0 0 0 1px rgb\(0 0 0 \/ 0\.1\), 0 8px 20px rgb\(0 0 0 \/ 0\.05\)/);
  assert.match(optionsCss, /accent-color: var\(--control-ink\)/);
  assert.match(optionsCss, /align-items: center/);
  assert.match(optionsCss, /gap: 6px/);
  assert.ok(optionsCss.includes("--border: rgba(0, 0, 0, .14)"));
  assert.match(optionsCss, /padding: 0 0 8px/);
  assert.match(optionsCss, /cleanup-heading[\s\S]*display: grid/);
  assert.match(optionsCss, /cleanup-heading[\s\S]*gap: 5px/);
  assert.match(optionsCss, /padding: 8px 32px 8px 8px/);
  assert.match(optionsCss, /appearance: none/);
  assert.match(optionsCss, /background-position: calc\(100% - 15px\)/);
  assert.match(optionsCss, /select:focus/);
  assert.match(optionsCss, /cleanup-choice\[data-active="true"\]/);
  assert.match(optionsCss, /grid-template-rows: auto 0fr/);
  assert.match(optionsCss, /transition: grid-template-rows 200ms ease 100ms/);
  assert.match(optionsCss, /cleanup-choice\[data-active="true"\][\s\S]*transition-delay: 0ms/);
  assert.match(optionsCss, /cleanup-choice\[data-active="true"\][\s\S]*overflow: visible/);
  assert.match(optionsCss, /verdict-choice\[data-active="true"\]/);
  assert.match(optionsCss, /verdict-choice > \.stream-picker-verdict/);
  assert.match(optionsCss, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(optionsCss, /\.stream-picker-verdict > span/);
  assert.match(optionsCss, /\.stream-picker-verdict[\s\S]*margin-top: 10px/);
  assert.match(optionsCss, /cleanup-choice\[data-active="true"\] > \.stream-picker[\s\S]*margin-top: 2px/);
  assert.match(optionsHtml, /class="choice-block verdict-choice"/);
  assert.match(optionsCss, /cleanup-choice \+ \.cleanup-choice[\s\S]*margin-top: 4px/);
  assert.match(optionsCss, /transition: opacity 200ms ease/);
  assert.match(optionsCss, /filter: blur\(4px\)/);
  assert.match(
    optionsCss,
    /verdict-choice\[data-active="true"\] > \.stream-picker-verdict,[\s\S]*cleanup-choice\[data-active="true"\] > \.stream-picker\s*\{[\s\S]*transition-delay: 100ms, 100ms, 100ms, 0ms, 0ms;/
  );
  assert.match(optionsCss, /cleanup-heading.*section-heading/);
  assert.match(optionsCss, /margin-inline-start: auto/);
  assert.match(optionsCss, /white-space: nowrap/);
});

test('supports translucent light and dark option-panel themes', () => {
  assert.match(optionsCss, /color-scheme: light dark/);
  assert.match(optionsCss, /backdrop-filter: blur\(12px\)/);
  assert.match(optionsCss, /@media \(prefers-color-scheme: dark\)/);
  assert.match(optionsCss, /--background: rgb\(0 0 0 \/ 0\.9\)/);
  assert.match(optionsCss, /--text: #fff/);
});

test('offers the supported live streams', () => {
  for (const label of [
    '🖼️ Art',
    '🖼️ Art 2',
    '📜 Poetry',
    '🎨 Modern Art (experimental)',
    '🌌 Deep Space',
    '🗞️ Publisher feeds',
    '🃏 New Yorker cartoons',
    '🃏 Far Side (experimental)',
    '🎾 Garross Gallery',
    '✨ Surprise me'
  ]) {
    assert.ok(optionsSource.includes(`'${label}'`), `missing stream label: ${label}`);
  }
});

test('switches between one shared stream and per-verdict stream menus', () => {
  assert.match(optionsHtml, /id="style-mode-toggle"/);
  assert.match(optionsHtml, />Hide promoted posts</);
  assert.match(optionsHtml, />Hide suggested posts</);
  assert.match(optionsHtml, /Style each differently/);
  assert.match(optionsHtml, /Replace with…/);
  assert.match(optionsHtml, /id="stream-ai"/);
  assert.match(optionsHtml, /id="stream-mixed"/);
  assert.match(optionsHtml, /id="stream-assisted"/);
  assert.match(optionsHtml, /id="stream-shared"/);
  assert.match(optionsSource, /Style the same/);
  assert.match(
    optionsCss,
    /body\[data-style-mode="different"\]\s+\.stream-picker-verdict/
  );
});

test('does not animate picker controls during the initial popup render', () => {
  assert.match(optionsCss, /body:not\(\[data-options-ready="true"\]\)[\s\S]*transition: none !important/);
  assert.match(
    optionsSource,
    /requestAnimationFrame\(\(\) =>\s*(?:window\.)?requestAnimationFrame\(\(\) =>\s*\{\s*document\.body\.dataset\.optionsReady = 'true';/
  );
});

test('does not expose removed museum source controls', () => {
  assert.doesNotMatch(optionsHtml, /provider-met|provider-artic|art-sources/);
  assert.doesNotMatch(optionsSource, /PoetryDB|NASA space|museum/i);
});

test('offers a separate promoted-post cleanup control', () => {
  assert.match(optionsSource, /Hide AI completely/);
  assert.match(optionsHtml, /AI-Assisted/);
  assert.match(optionsHtml, /id="replace-assisted"/);
  assert.match(optionsHtml, /id="hide-promoted"/);
  assert.match(optionsHtml, />Hide promoted posts</);
  assert.match(optionsHtml, /id="stream-promoted"/);
  assert.match(optionsSource, /hide-promoted/);
});

test('offers a separate Suggested-post cleanup control', () => {
  assert.match(optionsHtml, /id="hide-suggested"/);
  assert.match(optionsHtml, />Hide suggested posts</);
  assert.match(optionsHtml, /id="stream-suggested"/);
  assert.match(optionsSource, /hide-suggested/);
});
