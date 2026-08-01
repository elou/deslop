import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultTemplatePath = join(projectRoot, 'test', 'fixtures', 'card-layout.html');
const artworkPath = join(projectRoot, 'test', 'fixtures', 'approved-artwork.jpg');
const defaultCssPath = join(projectRoot, 'src', 'content.css');

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map((name) => {
      try {
        return execFileSync('which', [name], { encoding: 'utf8' }).trim();
      } catch {
        return '';
      }
    })
  ];
  return candidates.find(Boolean);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1];
}

const chrome = findChrome();
if (!chrome) {
  throw new Error('Chrome or Chromium is required for rendered card regression coverage. Set CHROME_BIN.');
}

const cssPath = resolve(option('--css') || defaultCssPath);
const templatePath = resolve(option('--template') || defaultTemplatePath);
const screenshotPath = option('--screenshot') ? resolve(option('--screenshot')) : '';
const viewportWidth = Number(option('--width') || 554);
const viewportHeight = Number(option('--height') || 1600);
const deviceScaleFactor = Number(option('--scale') || 2);
const tempDirectory = mkdtempSync(join(tmpdir(), 'pangram-card-layout-'));
const htmlPath = join(tempDirectory, 'card-layout.html');

const template = readFileSync(templatePath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const artworkDataUri = `data:image/jpeg;base64,${readFileSync(artworkPath).toString('base64')}`;
const measurementScript = `
<script>
  const round = (value) => Math.round(value * 100) / 100;
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return {
      x: round(value.x),
      y: round(value.y),
      width: round(value.width),
      height: round(value.height),
      top: round(value.top),
      right: round(value.right),
      bottom: round(value.bottom),
      left: round(value.left)
    };
  };
  const style = (element) => {
    const value = getComputedStyle(element);
    return {
      fontFamily: value.fontFamily,
      fontSize: value.fontSize,
      fontWeight: value.fontWeight,
      lineHeight: value.lineHeight,
      borderRadius: value.borderRadius
    };
  };
  const measure = (card) => {
    const body = card.querySelector('.pangram-gallery-card__body');
    const title = card.querySelector('.pangram-gallery-card__title');
    const attribution = card.querySelector('.pangram-gallery-card__location');
    const source = card.querySelector('.pangram-gallery-card__source');
    const toggle = card.querySelector('.pangram-gallery-card__toggle');
    const verdict = card.querySelector('.pangram-gallery-card__verdict');
    const image = card.querySelector('.pangram-gallery-card__image');
    const imageLink = card.querySelector('.pangram-gallery-card__image-link');
    const poem = card.querySelector('.pangram-gallery-card__poem');
    const bodyRect = rect(body);
    const titleRect = rect(title);
    const attributionRect = rect(attribution);
    const sourceRect = rect(source);
    const toggleRect = rect(toggle);
    const verdictRect = rect(verdict);
    return {
      body: bodyRect,
      title: { ...rect(title), ...style(title) },
      attribution: { ...rect(attribution), ...style(attribution) },
      source: { ...rect(source), ...style(source) },
      toggle: { ...rect(toggle), ...style(toggle) },
      verdict: { ...rect(verdict), ...style(verdict) },
      image: { ...rect(image), ...style(image) },
      imageLink: { ...rect(imageLink), ...style(imageLink) },
      poem: { ...rect(poem), ...style(poem) },
      spacing: {
        bodyToTitle: round(titleRect.top - bodyRect.top),
        titleToAttribution: round(attributionRect.top - titleRect.bottom),
        attributionToControls: round(toggleRect.top - attributionRect.bottom),
        bodyBottom: round(bodyRect.bottom - toggleRect.bottom),
        sourceToToggle: round(toggleRect.left - sourceRect.right),
        toggleToVerdict: round(verdictRect.left - toggleRect.right),
        verdictRight: round(bodyRect.right - verdictRect.right),
        controlCenterDelta: round((toggleRect.top + toggleRect.height / 2) - (verdictRect.top + verdictRect.height / 2))
      }
    };
  };
  const result = {};
  for (const card of document.querySelectorAll('[data-fixture-kind]')) {
    result[card.dataset.fixtureKind] = measure(card);
  }
  document.body.dataset.cardMetrics = encodeURIComponent(JSON.stringify(result));
</script>`;

writeFileSync(
  htmlPath,
  template
    .replace('/* __CARD_CSS__ */', css)
    .replace('__APPROVED_ARTWORK_DATA_URI__', artworkDataUri)
    .replace('</body>', `${measurementScript}</body>`)
);

const commonArguments = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--force-color-profile=srgb',
  '--virtual-time-budget=1000',
  `--window-size=${viewportWidth},${viewportHeight}`,
  pathToFileURL(htmlPath).href
];

try {
  if (screenshotPath) {
    const screenshot = spawnSync(
      chrome,
      [...commonArguments.slice(0, -1), `--force-device-scale-factor=${deviceScaleFactor}`, `--screenshot=${screenshotPath}`, commonArguments.at(-1)],
      { encoding: 'utf8' }
    );
    if (screenshot.status !== 0) {
      throw new Error(screenshot.stderr || screenshot.stdout || 'Chrome screenshot failed');
    }
  }

  const rendered = spawnSync(chrome, ['--dump-dom', ...commonArguments], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  if (rendered.status !== 0) {
    throw new Error(rendered.stderr || rendered.stdout || 'Chrome render failed');
  }
  const match = rendered.stdout.match(/data-card-metrics="([^"]+)"/);
  if (!match) throw new Error('Rendered card metrics were not emitted');
  process.stdout.write(`${decodeURIComponent(match[1].replaceAll('&amp;', '&'))}\n`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
