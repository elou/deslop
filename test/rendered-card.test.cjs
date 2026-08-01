const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fixture = path.join(__dirname, 'fixtures', 'rendered-artwork-card.html');

test('keeps a landscape artwork gallery-bounded in a LinkedIn-width rendered feed', () => {
  const documentHtml = execFileSync(
    chrome,
    ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--dump-dom', fixture],
    { encoding: 'utf8' }
  );
  const match = documentHtml.match(
    /<output id="rendered-card-measurements">([^<]+)<\/output>/
  );
  assert.ok(match, 'the browser should report rendered artwork measurements');

  const measurements = JSON.parse(match[1]);
  const landscape = measurements.landscape;
  const portrait = measurements.portrait;
  const loading = measurements.loading;
  const poem = measurements.poem;
  assert.ok(
    landscape.frameWidth <= 560,
    `gallery frame should resist host width rules (received ${landscape.frameWidth}px)`
  );
  assert.ok(
    landscape.imageWidth <= 560,
    `landscape artwork should remain gallery-bounded (received ${landscape.imageWidth}px)`
  );
  assert.ok(
    landscape.imageWidth < landscape.stageWidth,
    'landscape artwork should leave visible breathing room inside the stage'
  );
  assert.equal(landscape.objectFit, 'contain');
  assert.equal(portrait.objectFit, 'contain');
  assert.equal(portrait.objectPosition, '50% 50%');
  assert.equal(
    loading.frameWidth,
    landscape.frameWidth,
    'loading should preserve the artwork frame width'
  );
  assert.equal(
    loading.frameHeight,
    landscape.frameHeight,
    'loading should preserve the artwork frame height'
  );
  assert.equal(
    poem.frameWidth,
    landscape.frameWidth,
    'poetry should use the same gallery frame width'
  );
  assert.equal(
    poem.frameHeight,
    landscape.frameHeight,
    'poetry should use the same gallery frame height'
  );
  assert.ok(poem.footerHeight > 0, 'poetry should retain visible replacement metadata');
});
