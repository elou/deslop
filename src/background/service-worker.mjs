import { getReplacement } from './providers.mjs';

const DEFAULT_SETTINGS = {
  enabled: true,
  replaceMixed: false,
  providers: { met: true, artic: true }
};

function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (value) => {
      resolve({
        enabled: value.enabled !== false,
        replaceMixed: value.replaceMixed === true,
        providers: {
          met: value.providers?.met !== false,
          artic: value.providers?.artic !== false
        }
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
    chrome.storage.sync.set({
      enabled:
        typeof current.enabled === 'boolean'
          ? current.enabled
          : DEFAULT_SETTINGS.enabled,
      replaceMixed:
        typeof current.replaceMixed === 'boolean'
          ? current.replaceMixed
          : DEFAULT_SETTINGS.replaceMixed,
      providers: {
        met:
          typeof current.providers?.met === 'boolean'
            ? current.providers.met
            : true,
        artic:
          typeof current.providers?.artic === 'boolean'
            ? current.providers.artic
            : true
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PANGRAM_GALLERY_GET_REPLACEMENT') return false;

  (async () => {
    try {
      const settings = await readSettings();
      const item = await getReplacement(settings);
      sendResponse({ ok: true, item });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Replacement unavailable'
      });
    }
  })();

  return true;
});
