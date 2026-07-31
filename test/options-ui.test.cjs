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
  assert.match(optionsHtml, /💩 De-Slop/);
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
  assert.match(optionsHtml, /Style each differently/);
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

test('does not expose removed museum source controls', () => {
  assert.doesNotMatch(optionsHtml, /provider-met|provider-artic|art-sources/);
  assert.doesNotMatch(optionsSource, /PoetryDB|NASA space|museum/i);
});

test('does not expose cleanup controls in the core QA baseline', () => {
  assert.match(optionsSource, /Hide AI completely/);
  assert.match(optionsHtml, /AI-Assisted/);
  assert.match(optionsHtml, /id="replace-assisted"/);
  assert.doesNotMatch(optionsHtml, /id="hide-promoted"/);
  assert.doesNotMatch(optionsHtml, /Feed cleanup/);
});
