import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
if (!chrome) throw new Error('Chrome or Chromium is required for options visual QA.');

const viewportHeight = Number(option('--height') || 650);
const screenshotPath = resolve(
  option('--screenshot') || join(projectRoot, 'design/proofs/vocabulary-options.png')
);
const htmlPath = join(projectRoot, 'src/options/options.html');
const contentCorePath = join(projectRoot, 'src/content-core.js');
const optionsScriptPath = join(projectRoot, 'src/options/options.js');
const optionsCssPath = join(projectRoot, 'src/options/options.css');
const tempDirectory = mkdtempSync(join(tmpdir(), 'deslop-options-layout-'));
const renderedHtmlPath = join(tempDirectory, 'options.html');
const vocabulary = {
  enabled: true,
  entries: [
    {
      id: 'liminal',
      term: 'liminal',
      addedAt: '2026-08-01T20:00:00.000Z',
      definition: 'Occupying a position at, or on both sides of, a boundary or threshold.',
      definitionStatus: 'defined',
      definitionSource: 'macOS Dictionary',
      definitionError: ''
    },
    {
      id: 'serendipity',
      term: 'serendipity',
      addedAt: '2026-08-01T20:01:00.000Z',
      definition: 'The occurrence of events by chance in a beneficial way.',
      definitionStatus: 'defined',
      definitionSource: 'macOS Dictionary',
      definitionError: ''
    }
  ]
};
const settings = {
  styleMode: 'same',
  streams: {
    ai: 'vocabulary',
    mixed: 'painting-classics',
    assisted: 'painting-classics',
    promoted: 'hide-promoted',
    suggested: 'hide-suggested'
  }
};
const stub = `<script>
  const localState = ${JSON.stringify({ pangramGalleryVocabulary: vocabulary })};
  const syncState = ${JSON.stringify(settings)};
  const area = (state) => ({
    get(defaults, callback) { callback({ ...defaults, ...state }); },
    set(value, callback) { Object.assign(state, value); callback?.(); }
  });
  globalThis.chrome = {
    storage: {
      local: area(localState),
      sync: area(syncState),
      onChanged: { addListener() {} }
    }
  };
</script>`;

const html = readFileSync(htmlPath, 'utf8')
  .replace(
    '<details class="configure-section">',
    '<details class="configure-section" open>'
  )
  .replace(
    '<link rel="stylesheet" href="options.css" />',
    `<link rel="stylesheet" href="${pathToFileURL(optionsCssPath).href}" />`
  )
  .replace(
    '<script src="../content-core.js"></script>',
    `${stub}<script src="${pathToFileURL(contentCorePath).href}"></script>`
  )
  .replace(
    '<script type="module" src="options.js"></script>',
    `<script type="module" src="${pathToFileURL(optionsScriptPath).href}"></script>`
  );
writeFileSync(renderedHtmlPath, html);

try {
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    '--force-color-profile=srgb',
    '--virtual-time-budget=1500',
    `--window-size=420,${viewportHeight}`,
    '--force-device-scale-factor=2',
    `--screenshot=${screenshotPath}`,
    pathToFileURL(renderedHtmlPath).href
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Options screenshot failed');
  }
  process.stdout.write(`${screenshotPath}\n`);
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
