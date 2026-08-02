const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => {
  const filename = path.join(root, relativePath);
  return fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : '';
};
const html = read('src/report/report.html');
const css = read('src/report/report.css');
const source = read('src/report/report.js');
const optionsHtml = read('src/options/options.html');

test('offers a dedicated hidden-feed report from the extension popup', () => {
  assert.match(optionsHtml, /href="\.\.\/report\/report\.html"/);
  assert.match(optionsHtml, />\s*View hidden feed report/);
  assert.match(html, /<title>Hidden feed report · De-Slop<\/title>/);
  assert.match(html, /<script src="\.\.\/history-core\.js"><\/script>/);
  assert.match(html, /<script src="report\.js"><\/script>/);
});

test('makes local-only privacy, loading, empty, error, and reset states explicit', () => {
  assert.match(html, /Stored only in this browser/);
  assert.match(html, /id="report-status"[^>]*role="status"/);
  assert.match(html, /id="empty-state"/);
  assert.match(html, /id="error-state"/);
  assert.match(html, /id="reset-history"/);
  assert.match(source, /window\.confirm\(/);
  assert.match(source, /chrome\.storage\.local\.remove\(historyCore\.STORAGE_KEY/);
});

test('renders a source-actor roll-up without exposing post content or remote transport', () => {
  assert.match(source, /historyCore\.sortedActors\(/);
  assert.match(source, /actor\.profileUrl/);
  assert.match(source, /actor\.hiddenCount/);
  assert.match(source, /actor\.reasons/);
  assert.match(source, /actor\.firstSeen/);
  assert.match(source, /actor\.lastSeen/);
  assert.doesNotMatch(source, /originalAuthor|postContent|postText/);
  assert.doesNotMatch(source, /fetch\(|sendMessage\(/);
});

test('lays out the report responsively with visible keyboard focus', () => {
  assert.match(css, /max-width:\s*960px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
});
