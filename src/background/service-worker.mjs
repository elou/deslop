import { getReplacement } from './providers.mjs';

const DEFAULT_SETTINGS = {
  enabled: true,
  replaceMixed: false,
  styleMode: 'same',
  streams: { ai: 'painting-classics', mixed: 'painting-classics' }
};

const STREAM_IDS = new Set([
  'painting-classics',
  'classic-poetry',
  'modern-art',
  'deep-space',
  'newyorker-latest',
  'newyorker-cartoons'
]);

function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (value) => {
      resolve({
        enabled: value.enabled !== false,
        replaceMixed: value.replaceMixed === true,
        styleMode: value.styleMode === 'different' ? 'different' : 'same',
        streams: {
          ai: STREAM_IDS.has(value.streams?.ai)
            ? value.streams.ai
            : 'painting-classics',
          mixed: STREAM_IDS.has(value.streams?.mixed)
            ? value.streams.mixed
            : 'painting-classics'
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
      styleMode: current.styleMode === 'different' ? 'different' : 'same',
      streams: {
        ai: STREAM_IDS.has(current.streams?.ai)
          ? current.streams.ai
          : 'painting-classics',
        mixed: STREAM_IDS.has(current.streams?.mixed)
          ? current.streams.mixed
          : 'painting-classics'
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PANGRAM_GALLERY_GET_REPLACEMENT') return false;

  (async () => {
    try {
      const settings = await readSettings();
      const verdict = message.verdict === 'mixed' ? 'mixed' : 'ai';
      const item = await getReplacement(settings, verdict);
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
