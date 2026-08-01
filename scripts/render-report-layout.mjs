import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
if (!chrome) throw new Error('Chrome or Chromium is required for rendered report coverage.');

const viewportWidth = Number(option('--width') || 1100);
const viewportHeight = Number(option('--height') || 1000);
const deviceScaleFactor = Number(option('--scale') || 1);
const screenshotPath = option('--screenshot') ? resolve(option('--screenshot')) : '';
const tempDirectory = mkdtempSync(join(tmpdir(), 'deslop-report-layout-'));
const htmlPath = join(tempDirectory, 'report.html');

const css = readFileSync(join(projectRoot, 'src', 'report', 'report.css'), 'utf8');
let html = readFileSync(join(projectRoot, 'src', 'report', 'report.html'), 'utf8')
  .replace('<link rel="stylesheet" href="report.css" />', `<style>${css}</style>`)
  .replaceAll('<script src="../history-core.js"></script>', '')
  .replaceAll('<script src="report.js"></script>', '')
  .replace('data-state="loading"', 'data-state="ready"')
  .replace('id="report-content" class="report-content" hidden', 'id="report-content" class="report-content"')
  .replace('<span id="total-hidden">0</span>', '<span id="total-hidden">17</span>')
  .replace('<dd id="total-ai">0</dd>', '<dd id="total-ai">9</dd>')
  .replace('<dd id="total-mixed">0</dd>', '<dd id="total-mixed">5</dd>')
  .replace('<dd id="total-assisted">0</dd>', '<dd id="total-assisted">3</dd>')
  .replace('<dd id="total-unattributed">0</dd>', '<dd id="total-unattributed">1</dd>')
  .replace(
    '<ol id="actor-list" class="actor-list" aria-label="Feed sources by hidden post count"></ol>',
    `<ol id="actor-list" class="actor-list" aria-label="Feed sources by hidden post count">
      <li class="actor-row">
        <a class="actor-profile" href="https://www.linkedin.com/in/mathieuritter/">Mathieu Ritter</a>
        <div class="actor-count"><strong>7</strong><span>posts hidden</span></div>
        <p class="actor-reasons">4 liked · 2 commented · 1 reposted</p>
        <div class="actor-dates"><span>First seen Jul 29, 2026</span><span>Last seen Aug 1, 2026</span></div>
      </li>
      <li class="actor-row">
        <a class="actor-profile" href="https://www.linkedin.com/in/dhoang/">David Hoang</a>
        <div class="actor-count"><strong>5</strong><span>posts hidden</span></div>
        <p class="actor-reasons">3 commented · 2 reposted</p>
        <div class="actor-dates"><span>First seen Jul 30, 2026</span><span>Last seen Aug 1, 2026</span></div>
      </li>
      <li class="actor-row">
        <a class="actor-profile" href="https://www.linkedin.com/in/charleslmauro/">Charles L Mauro CHFP</a>
        <div class="actor-count"><strong>4</strong><span>posts hidden</span></div>
        <p class="actor-reasons">4 liked</p>
        <div class="actor-dates"><span>First seen Jul 31, 2026</span><span>Last seen Aug 1, 2026</span></div>
      </li>
    </ol>`
  );

const measurementScript = `
<script>
  const round = (value) => Math.round(value * 100) / 100;
  const rect = (selector) => {
    const value = document.querySelector(selector).getBoundingClientRect();
    return { x: round(value.x), y: round(value.y), width: round(value.width), height: round(value.height) };
  };
  const result = {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    shell: rect('.report-shell'),
    privacy: rect('.privacy-note'),
    summary: rect('.summary'),
    summaryColumns: getComputedStyle(document.querySelector('.summary')).gridTemplateColumns,
    actorHeading: rect('.actors-heading'),
    actorRow: rect('.actor-row'),
    actorColumns: getComputedStyle(document.querySelector('.actor-row')).gridTemplateColumns,
    profileMinHeight: getComputedStyle(document.querySelector('.actor-profile')).minHeight,
    reset: rect('.reset-button')
  };
  document.body.dataset.reportMetrics = encodeURIComponent(JSON.stringify(result));
</script>`;
html = html.replace('</body>', `${measurementScript}</body>`);
writeFileSync(htmlPath, html);

const commonArguments = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--force-color-profile=srgb',
  `--force-device-scale-factor=${deviceScaleFactor}`,
  '--virtual-time-budget=1000',
  `--window-size=${viewportWidth},${viewportHeight}`,
  pathToFileURL(htmlPath).href
];

try {
  if (screenshotPath) {
    mkdirSync(dirname(screenshotPath), { recursive: true });
    const screenshot = spawnSync(
      chrome,
      [
        ...commonArguments.slice(0, -1),
        `--screenshot=${screenshotPath}`,
        commonArguments.at(-1)
      ],
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
  const match = rendered.stdout.match(/data-report-metrics="([^"]+)"/);
  if (!match) throw new Error('Rendered report metrics were not emitted');
  process.stdout.write(`${decodeURIComponent(match[1].replaceAll('&amp;', '&'))}\n`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
