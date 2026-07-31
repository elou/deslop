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

test('offers the supported live streams', () => {
  for (const label of [
    'Painting Classics',
    'Classic Poetry',
    'Modern Art (experimental)',
    'Deep Space',
    'New Yorker latest',
    'New Yorker cartoons'
  ]) {
    assert.ok(optionsSource.includes(`'${label}'`), `missing stream label: ${label}`);
  }
});

test('switches between one shared stream and per-verdict stream menus', () => {
  assert.match(optionsHtml, /id="style-mode-toggle"/);
  assert.match(optionsHtml, /Style each differently/);
  assert.match(optionsHtml, /id="stream-ai"/);
  assert.match(optionsHtml, /id="stream-mixed"/);
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
