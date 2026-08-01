import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotIndex = process.argv.indexOf('--screenshot');
const screenshotPath =
  screenshotIndex === -1 ? '' : resolve(process.argv[screenshotIndex + 1]);
const profileDirectory = mkdtempSync(join(tmpdir(), 'deslop-live-extension-'));

function findChrome() {
  const playwrightRoot = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  const testingBrowsers = existsSync(playwrightRoot)
    ? readdirSync(playwrightRoot)
        .filter((name) => name.startsWith('chromium-'))
        .sort()
        .reverse()
        .map((name) =>
          join(
            playwrightRoot,
            name,
            'chrome-mac-arm64',
            'Google Chrome for Testing.app',
            'Contents',
            'MacOS',
            'Google Chrome for Testing'
          )
        )
    : [];
  const candidates = [
    process.env.CHROME_BIN,
    ...testingBrowsers,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function extensionIdForPath(path) {
  const prefix = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return prefix.replace(/[0-9a-f]/g, (value) =>
    String.fromCharCode(97 + Number.parseInt(value, 16))
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function waitFor(predicate, message, timeout = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await wait(100);
  }
  throw new Error(message);
}

async function launchChrome(chrome) {
  const child = spawn(
    chrome,
    [
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--window-position=-10000,-10000',
      '--window-size=420,850',
      `--user-data-dir=${profileDirectory}`,
      `--disable-extensions-except=${projectRoot}`,
      `--load-extension=${projectRoot}`,
      '--remote-debugging-port=0',
      'about:blank'
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk.toString();
  });
  const portFile = join(profileDirectory, 'DevToolsActivePort');
  const port = await waitFor(
    () => {
      if (!existsSync(portFile)) return 0;
      return Number(readFileSync(portFile, 'utf8').split('\n')[0]);
    },
    `Chrome did not expose a debugging port.\n${errors}`
  );
  return { child, errors: () => errors, port };
}

async function stopChrome(instance) {
  if (!instance?.child || instance.child.exitCode !== null) return;
  instance.child.kill('SIGTERM');
  const exited = await Promise.race([
    new Promise((resolvePromise) => instance.child.once('exit', resolvePromise)),
    wait(3_000).then(() => false)
  ]);
  if (exited === false && instance.child.exitCode === null) {
    instance.child.kill('SIGKILL');
  }
}

async function createTarget(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: 'PUT' }
  );
  if (!response.ok) throw new Error(`Could not open extension page: ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolvePromise, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolvePromise(message.result);
  });
  return {
    close() {
      socket.close();
    },
    send(method, params = {}) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolvePromise, reject) => {
        pending.set(id, { resolve: resolvePromise, reject });
      });
    }
  };
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || 'Extension evaluation failed');
  }
  return result.result.value;
}

const chrome = findChrome();
if (!chrome) throw new Error('Google Chrome or Chromium is required.');

const extensionId = extensionIdForPath(projectRoot);
let instance;
let client;

try {
  const install = spawnSync(
    join(projectRoot, 'scripts', 'install-dictionary-host.sh'),
    [extensionId],
    { encoding: 'utf8' }
  );
  assert.equal(install.status, 0, install.stderr || install.stdout);
  const profileInstall = spawnSync(
    join(projectRoot, 'scripts', 'install-dictionary-host.sh'),
    [extensionId],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        DESLOP_NATIVE_MANIFEST_DIR: join(profileDirectory, 'NativeMessagingHosts')
      }
    }
  );
  assert.equal(
    profileInstall.status,
    0,
    profileInstall.stderr || profileInstall.stdout
  );

  instance = await launchChrome(chrome);
  const liveTarget = await createTarget(
    instance.port,
    `chrome-extension://${extensionId}/src/options/options.html`
  );
  client = await connectCdp(liveTarget.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 420,
    height: 850,
    deviceScaleFactor: 2,
    mobile: false
  });
  try {
    await waitFor(
      () => evaluate(client, "document.readyState === 'complete' && document.body.dataset.optionsReady === 'true'"),
      'The reloaded extension popup did not finish rendering.'
    );
  } catch (error) {
    const diagnostic = await evaluate(
      client,
      `({
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        optionsReady: document.body?.dataset.optionsReady || '',
        bodyText: document.body?.innerText?.slice(0, 500) || '',
        bodyHtml: document.body?.innerHTML?.slice(0, 500) || ''
      })`
    );
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic, null, 2)}`);
  }

  const permissions = await evaluate(
    client,
    `(async () => await chrome.permissions.getAll())()`
  );
  assert.ok(permissions.permissions.includes('contextMenus'));
  assert.ok(permissions.permissions.includes('nativeMessaging'));

  const definition = await evaluate(
    client,
    `(async () => await new Promise((resolve) => {
      chrome.runtime.sendNativeMessage(
        'com.elou.deslop.dictionary',
        { type: 'define', term: 'erudition' },
        (response) => resolve({
          response,
          error: chrome.runtime.lastError?.message || ''
        })
      );
    }))()`
  );
  assert.equal(definition.error, '');
  assert.equal(definition.response.ok, true);
  assert.equal(definition.response.source, 'macOS Dictionary');
  assert.match(definition.response.definition, /erudition/i);

  const gating = await evaluate(
    client,
    `(async () => {
      const entry = {
        id: 'live-erudition',
        term: 'erudition',
        addedAt: new Date().toISOString(),
        definition: ${JSON.stringify('Knowledge acquired through study or scholarship.')},
        definitionStatus: 'defined',
        definitionSource: 'macOS Dictionary',
        definitionError: ''
      };
      await chrome.storage.local.set({
        pangramGalleryVocabulary: { enabled: false, entries: [entry] }
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const selects = [...document.querySelectorAll('select')];
      const before = selects.some((select) =>
        [...select.options].some((option) => option.value === 'vocabulary')
      );
      const configure = document.querySelector('.configure-section');
      const initiallyCollapsed = !configure.open;
      const vocabularyInsideConfigure = Boolean(
        document.querySelector('#vocabulary-heading')?.closest('.configure-section')
      );
      document.querySelector('#vocabulary-enabled').click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const after = selects.every((select) =>
        [...select.options].some((option) => option.value === 'vocabulary')
      );
      const shared = document.querySelector('#stream-shared');
      shared.value = 'vocabulary';
      shared.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 200));
      const replacement = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'PANGRAM_GALLERY_GET_REPLACEMENT',
            verdict: 'ai',
            stream: 'vocabulary'
          },
          resolve
        );
      });
      configure.open = true;
      return {
        initiallyCollapsed,
        vocabularyInsideConfigure,
        before,
        after,
        enabled: (await chrome.storage.local.get('pangramGalleryVocabulary'))
          .pangramGalleryVocabulary.enabled,
        replacement
      };
    })()`
  );
  assert.equal(gating.initiallyCollapsed, true);
  assert.equal(gating.vocabularyInsideConfigure, true);
  assert.equal(gating.before, false);
  assert.equal(gating.after, true);
  assert.equal(gating.enabled, true);
  assert.equal(gating.replacement.ok, true);
  assert.equal(gating.replacement.item.title, 'erudition');

  if (screenshotPath) {
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true
    });
    writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        extensionId,
        nativeDefinition: {
          ok: definition.response.ok,
          source: definition.response.source,
          term: 'erudition'
        },
        gating: {
          absentBeforeEnabled: !gating.before,
          presentAfterEnabled: gating.after,
          replacementTitle: gating.replacement.item.title,
          insideConfigure: gating.vocabularyInsideConfigure
        },
        screenshot: screenshotPath
      },
      null,
      2
    )}\n`
  );
} finally {
  client?.close();
  await stopChrome(instance);
  rmSync(profileDirectory, { recursive: true, force: true });
}
