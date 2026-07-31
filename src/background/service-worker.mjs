import { getReplacement } from './providers.mjs';

const DEFAULT_SETTINGS = {
  enabled: true,
  replaceMixed: false,
  replaceAssisted: false,
  hidePromoted: false,
  hideSuggested: false,
  styleMode: 'same',
  streams: {
    ai: 'painting-classics',
    mixed: 'painting-classics',
    assisted: 'painting-classics',
    promoted: 'hide-promoted',
    suggested: 'hide-suggested'
  }
};

const STREAM_IDS = new Set([
  'painting-classics',
  'art-2',
  'classic-poetry',
  'modern-art',
  'deep-space',
  'newyorker-latest',
  'newyorker-cartoons',
  'far-side',
  'garros-gallery',
  'surprise-me',
  'hide-ai',
  'hide-promoted',
  'hide-suggested'
]);

function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (value) => {
      resolve({
        enabled: value.enabled !== false,
        replaceMixed: value.replaceMixed === true,
        replaceAssisted: value.replaceAssisted === true,
        hidePromoted: value.hidePromoted === true,
        hideSuggested: value.hideSuggested === true,
        styleMode: value.styleMode === 'different' ? 'different' : 'same',
        streams: {
          ai: STREAM_IDS.has(value.streams?.ai)
            ? value.streams.ai
            : 'painting-classics',
          mixed: STREAM_IDS.has(value.streams?.mixed)
            ? value.streams.mixed
            : 'painting-classics',
          assisted: STREAM_IDS.has(value.streams?.assisted)
            ? value.streams.assisted
            : 'painting-classics',
          promoted: STREAM_IDS.has(value.streams?.promoted)
            ? value.streams.promoted
            : 'hide-promoted',
          suggested: STREAM_IDS.has(value.streams?.suggested)
            ? value.streams.suggested
            : 'hide-suggested'
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
      replaceAssisted:
        typeof current.replaceAssisted === 'boolean'
          ? current.replaceAssisted
          : DEFAULT_SETTINGS.replaceAssisted,
      hidePromoted:
        typeof current.hidePromoted === 'boolean'
          ? current.hidePromoted
          : DEFAULT_SETTINGS.hidePromoted,
      hideSuggested:
        typeof current.hideSuggested === 'boolean'
          ? current.hideSuggested
          : DEFAULT_SETTINGS.hideSuggested,
      styleMode: current.styleMode === 'different' ? 'different' : 'same',
      streams: {
        ai: STREAM_IDS.has(current.streams?.ai)
          ? current.streams.ai
          : 'painting-classics',
        mixed: STREAM_IDS.has(current.streams?.mixed)
          ? current.streams.mixed
          : 'painting-classics',
        assisted: STREAM_IDS.has(current.streams?.assisted)
          ? current.streams.assisted
          : 'painting-classics',
        promoted: STREAM_IDS.has(current.streams?.promoted)
          ? current.streams.promoted
          : 'hide-promoted',
        suggested: STREAM_IDS.has(current.streams?.suggested)
          ? current.streams.suggested
          : 'hide-suggested'
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PANGRAM_GALLERY_GET_REPLACEMENT') return false;

  (async () => {
    try {
      const settings = await readSettings();
      const verdict = ['ai', 'mixed', 'ai-assisted', 'promoted', 'suggested'].includes(message.verdict)
        ? message.verdict
        : 'ai';
      const stream = STREAM_IDS.has(message.stream) ? message.stream : null;
      const item = await getReplacement(settings, verdict, fetch, Math.random, stream);
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
