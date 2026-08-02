import { getReplacement } from './providers.mjs';
import {
  FEATURE_ENABLED as VOCABULARY_FEATURE_ENABLED,
  STORAGE_KEY as VOCABULARY_STORAGE_KEY,
  STREAM_ID as VOCABULARY_STREAM_ID,
  addVocabularyEntry,
  applyVocabularyDefinition,
  buildVocabularyReplacement,
  isVocabularyAvailable,
  normalizeVocabularyState,
  pickVocabularyEntry,
  repairVocabularyStreams
} from '../vocabulary-core.mjs';

const VOCABULARY_MENU_ID = 'deslop-add-vocabulary';
const DICTIONARY_HOST = 'com.elou.deslop.dictionary';

const DEFAULT_SETTINGS = {
  enabled: true,
  replaceMixed: false,
  replaceAssisted: false,
  hidePromoted: false,
  hideSuggested: false,
  platforms: {
    linkedin: true,
    x: false
  },
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
  'classic-poetry',
  'modern-art',
  'deep-space',
  'garros-gallery',
  'surprise-me',
  VOCABULARY_STREAM_ID,
  'hide-ai',
  'hide-promoted',
  'hide-suggested'
]);

function storageGet(area, defaults) {
  return new Promise((resolve) => chrome.storage[area].get(defaults, resolve));
}

function storageSet(area, value) {
  return new Promise((resolve) => chrome.storage[area].set(value, resolve));
}

async function readVocabulary() {
  const value = await storageGet('local', {
    [VOCABULARY_STORAGE_KEY]: normalizeVocabularyState()
  });
  return normalizeVocabularyState(value[VOCABULARY_STORAGE_KEY]);
}

function writeVocabulary(value) {
  return storageSet('local', {
    [VOCABULARY_STORAGE_KEY]: normalizeVocabularyState(value)
  });
}

function getSelectedStream(settings, verdict) {
  if (settings.styleMode !== 'different') return settings.streams.ai;
  if (verdict === 'mixed') return settings.streams.mixed;
  if (verdict === 'ai-assisted') return settings.streams.assisted;
  return settings.streams.ai;
}

function lookUpSystemDefinition(term) {
  return new Promise((resolve) => {
    chrome.runtime.sendNativeMessage(
      DICTIONARY_HOST,
      { type: 'define', term },
      (response) => {
        const runtimeError = chrome.runtime.lastError?.message;
        if (runtimeError) {
          resolve({ error: runtimeError });
          return;
        }
        if (!response?.ok || !response.definition) {
          resolve({ error: response?.error || 'No system dictionary match' });
          return;
        }
        resolve({
          definition: response.definition,
          source: response.source || 'macOS Dictionary'
        });
      }
    );
  });
}

async function saveVocabularySelection(selectionText) {
  const before = await readVocabulary();
  const after = addVocabularyEntry(before, selectionText);
  const entry = after.entries.at(-1);
  if (!entry || after.entries.length === before.entries.length) return;
  await writeVocabulary(after);

  const definition = await lookUpSystemDefinition(entry.term);
  const latest = await readVocabulary();
  await writeVocabulary(applyVocabularyDefinition(latest, entry.id, definition));
}

let vocabularyWriteQueue = Promise.resolve();

function queueVocabularySelection(selectionText) {
  vocabularyWriteQueue = vocabularyWriteQueue
    .then(() => saveVocabularySelection(selectionText))
    .catch(() => undefined);
  return vocabularyWriteQueue;
}

async function repairStoredVocabularyRouting(vocabulary) {
  if (isVocabularyAvailable(vocabulary)) return;
  const current = await storageGet('sync', DEFAULT_SETTINGS);
  const repaired = repairVocabularyStreams(current, vocabulary);
  if (JSON.stringify(repaired.streams) !== JSON.stringify(current.streams)) {
    await storageSet('sync', repaired);
  }
}

function readSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (value) => {
      resolve({
        enabled: true,
        replaceMixed: value.replaceMixed === true,
        replaceAssisted: value.replaceAssisted === true,
        hidePromoted: value.hidePromoted === true,
        hideSuggested: value.hideSuggested === true,
        platforms: {
          linkedin: value.platforms?.linkedin !== false,
          x: value.platforms?.x === true
        },
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
  if (VOCABULARY_FEATURE_ENABLED && chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: VOCABULARY_MENU_ID,
        title: 'Add “%s” to De-Slop vocabulary',
        contexts: ['selection']
      });
    });
  }
  chrome.storage.local
    .setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })
    ?.catch?.(() => undefined);
  chrome.storage.sync.get(DEFAULT_SETTINGS, (current) => {
    chrome.storage.sync.set({
      enabled: true,
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
      platforms: {
        linkedin:
          typeof current.platforms?.linkedin === 'boolean'
            ? current.platforms.linkedin
            : DEFAULT_SETTINGS.platforms.linkedin,
        x:
          typeof current.platforms?.x === 'boolean'
            ? current.platforms.x
            : DEFAULT_SETTINGS.platforms.x
      },
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
  void readVocabulary().then(repairStoredVocabularyRouting);
});

if (VOCABULARY_FEATURE_ENABLED && chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== VOCABULARY_MENU_ID) return;
    void queueVocabularySelection(info.selectionText || '');
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[VOCABULARY_STORAGE_KEY]) return;
  const vocabulary = normalizeVocabularyState(
    changes[VOCABULARY_STORAGE_KEY].newValue
  );
  void repairStoredVocabularyRouting(vocabulary);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'PANGRAM_GALLERY_GET_REPLACEMENT') return false;

  (async () => {
    try {
      const settings = await readSettings();
      const verdict = ['ai', 'mixed', 'ai-assisted'].includes(message.verdict)
        ? message.verdict
        : 'ai';
      const stream = STREAM_IDS.has(message.stream) ? message.stream : '';
      const selectedStream = stream || getSelectedStream(settings, verdict);
      const vocabulary = selectedStream === VOCABULARY_STREAM_ID
        ? await readVocabulary()
        : null;
      const item = selectedStream === VOCABULARY_STREAM_ID &&
        isVocabularyAvailable(vocabulary)
        ? buildVocabularyReplacement(pickVocabularyEntry(vocabulary))
        : await getReplacement(
            {
              ...settings,
              styleMode: 'same',
              streams: {
                ...settings.streams,
                ai:
                  selectedStream === VOCABULARY_STREAM_ID
                    ? 'painting-classics'
                    : selectedStream
              }
            },
            verdict
          );
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
