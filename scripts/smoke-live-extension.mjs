import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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

function extensionIdForManifest() {
  const manifest = JSON.parse(
    readFileSync(join(projectRoot, 'manifest.json'), 'utf8')
  );
  if (typeof manifest.key !== 'string' || !manifest.key) {
    throw new Error('The unpacked extension manifest must include its stable key.');
  }
  const prefix = createHash('sha256')
    .update(Buffer.from(manifest.key, 'base64'))
    .digest('hex')
    .slice(0, 32);
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
  const listeners = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      for (const listener of listeners.get(message.method) || []) listener(message.params || {});
      return;
    }
    if (!pending.has(message.id)) return;
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
    },
    on(method, listener) {
      const methodListeners = listeners.get(method) || [];
      methodListeners.push(listener);
      listeners.set(method, methodListeners);
    }
  };
}

async function connectBrowserCdp(port) {
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) =>
    response.json()
  );
  return connectCdp(version.webSocketDebuggerUrl);
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

const extensionId = extensionIdForManifest();
let instance;
let client;
let pageClient;
let browserClient;

try {
  instance = await launchChrome(chrome);
  browserClient = await connectBrowserCdp(instance.port);
  const loadedExtension = await browserClient.send('Extensions.loadUnpacked', {
    path: projectRoot
  });
  assert.equal(loadedExtension.id, extensionId);
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
  assert.ok(!permissions.permissions.includes('contextMenus'));
  assert.ok(!permissions.permissions.includes('nativeMessaging'));

  const dormant = await evaluate(
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
        pangramGalleryVocabulary: { enabled: true, entries: [entry] }
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const selects = [...document.querySelectorAll('select')];
      const vocabularyInDropdowns = selects.some((select) =>
        [...select.options].some((option) => option.value === 'vocabulary')
      );
      const configure = document.querySelector('.configure-section');
      const initiallyCollapsed = !configure.open;
      const vocabularySection = document.querySelector('.vocabulary-section');
      configure.open = true;
      return {
        initiallyCollapsed,
        vocabularyInDropdowns,
        vocabularyControlsHidden: vocabularySection.hidden,
        vocabularyControlsVisible: vocabularySection.getClientRects().length > 0
      };
    })()`
  );
  assert.equal(dormant.initiallyCollapsed, true);
  assert.equal(dormant.vocabularyInDropdowns, false);
  assert.equal(dormant.vocabularyControlsHidden, true);
  assert.equal(dormant.vocabularyControlsVisible, false);

  const pageTarget = await createTarget(instance.port, 'about:blank');
  pageClient = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await pageClient.send('Runtime.enable');
  await pageClient.send('Page.enable');
  await pageClient.send('Network.enable');
  await pageClient.send('Debugger.enable');
  await pageClient.send('Fetch.enable', {
    patterns: [
      { urlPattern: 'https://www.linkedin.com/feed/*', requestStage: 'Request' },
      { urlPattern: 'https://www.linkedin.com/in/*', requestStage: 'Request' }
    ]
  });
  const requests = new Map();
  const invalidExtensionFailures = [];
  const extensionScripts = [];
  const interceptionFailures = [];
  pageClient.on('Network.requestWillBeSent', ({ requestId, request }) => {
    requests.set(requestId, request?.url || '');
  });
  pageClient.on('Network.loadingFailed', ({ requestId, errorText }) => {
    const url = requests.get(requestId) || '';
    if (/^chrome-extension:\/\/invalid\/?$/i.test(url)) {
      invalidExtensionFailures.push({ url, errorText });
    }
  });
  pageClient.on('Debugger.scriptParsed', ({ url }) => {
    if (url?.startsWith(`chrome-extension://${extensionId}/src/`)) {
      extensionScripts.push(url);
    }
  });
  pageClient.on('Fetch.requestPaused', (params) => {
    void (async () => {
      const url = new URL(params.request.url);
      const supportedRoute = url.hostname === 'www.linkedin.com' && /^\/feed\//.test(url.pathname);
      const profileRoute = url.hostname === 'www.linkedin.com' && /^\/in\//.test(url.pathname);
      if (!supportedRoute && !profileRoute) {
        await pageClient.send('Fetch.continueRequest', { requestId: params.requestId });
        return;
      }
      const pageKind = supportedRoute ? 'feed' : 'profile';
      const body = `<!doctype html>
        <html lang="en"><head><title>Controlled LinkedIn ${pageKind}</title></head>
        <body><main id="fixture-${pageKind}">Controlled LinkedIn ${pageKind}</main></body></html>`;
      await pageClient.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'text/html; charset=utf-8' },
          { name: 'cache-control', value: 'no-store' }
        ],
        body: Buffer.from(body).toString('base64')
      });
    })().catch((error) => {
      interceptionFailures.push(error.message);
    });
  });

  await pageClient.send('Page.navigate', { url: 'https://www.linkedin.com/feed/' });
  await waitFor(
    () => evaluate(pageClient, "location.pathname === '/feed/' && document.readyState === 'complete'"),
    'The controlled LinkedIn feed did not finish loading.'
  );

  async function inspectFrameBoundary() {
    return evaluate(
      pageClient,
      `(async () => {
        const topMarker = document.createElement('div');
        topMarker.className = 'pangram-gallery-original-hidden';
        document.body.append(topMarker);

        const child = document.createElement('iframe');
        child.src = 'https://www.linkedin.com/feed/?deslop-child-frame';
        document.body.append(child);
        await new Promise((resolve) => {
          child.addEventListener('load', resolve, { once: true });
          setTimeout(resolve, 5000);
        });
        const childMarker = child.contentDocument.createElement('div');
        childMarker.className = 'pangram-gallery-original-hidden';
        child.contentDocument.body.append(childMarker);

        const sandboxed = document.createElement('iframe');
        sandboxed.sandbox = 'allow-scripts';
        sandboxed.src = 'https://www.linkedin.com/feed/?deslop-sandboxed-frame';
        document.body.append(sandboxed);
        await new Promise((resolve) => {
          sandboxed.addEventListener('load', resolve, { once: true });
          setTimeout(resolve, 5000);
        });

        return {
          topDisplay: getComputedStyle(topMarker).display,
          childDisplay: child.contentWindow.getComputedStyle(childMarker).display
        };
      })()`
    );
  }

  const initialFrameBoundary = await inspectFrameBoundary();
  assert.equal(initialFrameBoundary.topDisplay, 'none');
  assert.notEqual(initialFrameBoundary.childDisplay, 'none');
  const initialFeedScripts = extensionScripts.slice();
  assert.ok(
    initialFeedScripts.includes(`chrome-extension://${extensionId}/src/content.js`),
    'The controlled LinkedIn feed did not receive the content script.'
  );

  const invalidFailuresBeforeReload = invalidExtensionFailures.length;
  let reloadRequestError = '';
  try {
    await Promise.race([
      evaluate(client, 'chrome.runtime.reload(); true'),
      wait(2_000).then(() => {
        throw new Error('The extension runtime reload did not return.');
      })
    ]);
  } catch (error) {
    // Reloading an MV3 extension can tear down the caller before CDP receives a
    // response. The post-reload options-page readiness check below distinguishes
    // that expected teardown from a failed reload request.
    reloadRequestError = error.message;
  }
  await wait(500);
  // Chrome's isolated CDP profile unloads a runtime-reloaded unpacked
  // extension instead of immediately rereading its source directory. Load the
  // same unpacked path back into that still-running browser, mirroring the
  // extension-management Reload action's source reread without replacing the
  // open LinkedIn target.
  let reloadedExtension = await browserClient.send('Extensions.loadUnpacked', {
    path: projectRoot
  });
  assert.equal(reloadedExtension.id, extensionId);
  let reloadedExtensionInfo = await browserClient.send('Extensions.getExtensions');
  let reloadedExtensionState = reloadedExtensionInfo.extensions.find(
    (extension) => extension.id === extensionId
  );
  const runtimeReloadDisabledExtension = reloadedExtensionState?.enabled === false;
  if (runtimeReloadDisabledExtension) {
    await browserClient.send('Extensions.uninstall', { id: extensionId });
    reloadedExtension = await browserClient.send('Extensions.loadUnpacked', {
      path: projectRoot
    });
    assert.equal(reloadedExtension.id, extensionId);
    reloadedExtensionInfo = await browserClient.send('Extensions.getExtensions');
    reloadedExtensionState = reloadedExtensionInfo.extensions.find(
      (extension) => extension.id === extensionId
    );
  }
  assert.equal(reloadedExtensionState?.enabled, true);
  const reloadedOptionsTarget = await waitFor(async () => {
    try {
      return await createTarget(
        instance.port,
        `chrome-extension://${extensionId}/src/options/options.html`
      );
    } catch {
      return null;
    }
  }, 'The extension options page did not return after runtime reload.');
  client.close();
  client = await connectCdp(reloadedOptionsTarget.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  try {
    await waitFor(
      () => evaluate(client, "document.readyState === 'complete' && document.body.dataset.optionsReady === 'true'"),
      `The extension did not become ready after runtime reload. ${reloadRequestError}`
    );
  } catch (error) {
    const diagnostic = await evaluate(
      client,
      `({ href: location.href, readyState: document.readyState, body: document.body?.innerText || '', html: document.documentElement?.outerHTML?.slice(0, 1000) || '' })`
    );
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic, null, 2)}`);
  }

  const refreshScriptStart = extensionScripts.length;
  await pageClient.send('Page.reload', { ignoreCache: true });
  await waitFor(
    () => evaluate(pageClient, "location.pathname === '/feed/' && document.readyState === 'complete'"),
    'The controlled LinkedIn feed did not finish refreshing after runtime reload.'
  );
  const refreshedFrameBoundary = await inspectFrameBoundary();
  assert.equal(refreshedFrameBoundary.topDisplay, 'none');
  assert.notEqual(refreshedFrameBoundary.childDisplay, 'none');
  const postReloadFeedScripts = extensionScripts.slice(refreshScriptStart);
  assert.ok(
    postReloadFeedScripts.includes(`chrome-extension://${extensionId}/src/content.js`),
    'The refreshed LinkedIn feed did not receive a fresh content script.'
  );
  await wait(500);
  assert.deepEqual(interceptionFailures, []);
  const postReloadInvalidFailures = invalidExtensionFailures.slice(invalidFailuresBeforeReload);
  assert.deepEqual(postReloadInvalidFailures, []);

  const profileScriptStart = extensionScripts.length;
  await pageClient.send('Page.navigate', { url: 'https://www.linkedin.com/in/test/' });
  await waitFor(
    () => evaluate(pageClient, "location.pathname === '/in/test/' && document.readyState === 'complete'"),
    'The controlled LinkedIn profile did not finish loading.'
  );
  const profileBoundary = await evaluate(
    pageClient,
    `(() => {
      const marker = document.createElement('div');
      marker.className = 'pangram-gallery-original-hidden';
      document.body.append(marker);
      return {
        markerDisplay: getComputedStyle(marker).display,
        extensionStylesheets: [...document.styleSheets]
          .map((sheet) => sheet.href)
          .filter((href) => href?.startsWith(${JSON.stringify(`chrome-extension://${extensionId}/src/`)}))
      };
    })()`
  );
  const profileExtensionScripts = extensionScripts.slice(profileScriptStart);
  assert.notEqual(profileBoundary.markerDisplay, 'none');
  assert.deepEqual(profileBoundary.extensionStylesheets, []);
  assert.deepEqual(profileExtensionScripts, []);

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
        permissions: permissions.permissions,
        vocabularyDormant: {
          controlsHidden: dormant.vocabularyControlsHidden,
          dropdownAbsent: !dormant.vocabularyInDropdowns
        },
        frameLifecycle: {
          topFrameInjected: refreshedFrameBoundary.topDisplay === 'none',
          childFrameSkipped: refreshedFrameBoundary.childDisplay !== 'none',
          runtimeReloaded: true,
          runtimeReloadDisabledInIsolatedProfile: runtimeReloadDisabledExtension,
          postReloadInvalidExtensionFailures: postReloadInvalidFailures.length
        },
        unsupportedLinkedInProfile: {
          contentScriptsInjected: profileExtensionScripts.length,
          contentStylesheetsInjected: profileBoundary.extensionStylesheets.length
        },
        screenshot: screenshotPath
      },
      null,
      2
    )}\n`
  );
} finally {
  pageClient?.close();
  client?.close();
  browserClient?.close();
  await stopChrome(instance);
  rmSync(profileDirectory, { recursive: true, force: true });
}
