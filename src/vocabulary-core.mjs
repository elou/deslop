export const FEATURE_ENABLED = false;
export const STORAGE_KEY = 'pangramGalleryVocabulary';
export const STREAM_ID = 'vocabulary';

const DEFINITION_STATUSES = new Set([
  'pending',
  'defined',
  'unavailable'
]);

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const id = cleanText(value.id);
  const term = cleanText(value.term);
  if (!id || !term) return null;

  const definition = cleanText(value.definition);
  const requestedStatus = DEFINITION_STATUSES.has(value.definitionStatus)
    ? value.definitionStatus
    : '';
  const definitionStatus = definition
    ? 'defined'
    : requestedStatus || 'pending';

  return {
    id,
    term,
    addedAt: cleanText(value.addedAt),
    definition,
    definitionStatus,
    definitionSource: definition ? cleanText(value.definitionSource) : '',
    definitionError:
      definitionStatus === 'unavailable' ? cleanText(value.definitionError) : ''
  };
}

export function normalizeVocabularyState(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const entries = Array.isArray(input.entries)
    ? input.entries.map(normalizeEntry).filter(Boolean)
    : [];
  return {
    enabled: input.enabled === true,
    entries
  };
}

export function addVocabularyEntry(
  stateValue,
  selectionText,
  {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    addedAt = new Date().toISOString()
  } = {}
) {
  const state = normalizeVocabularyState(stateValue);
  const term = cleanText(selectionText);
  if (!term) return state;

  return {
    ...state,
    entries: [
      ...state.entries,
      {
        id,
        term,
        addedAt,
        definition: '',
        definitionStatus: 'pending',
        definitionSource: '',
        definitionError: ''
      }
    ]
  };
}

export function applyVocabularyDefinition(stateValue, entryId, result = {}) {
  const state = normalizeVocabularyState(stateValue);
  const definition = cleanText(result.definition);
  const source = cleanText(result.source);
  const error = cleanText(result.error);

  return {
    ...state,
    entries: state.entries.map((entry) =>
      entry.id !== entryId
        ? entry
        : {
            ...entry,
            definition,
            definitionStatus: definition ? 'defined' : 'unavailable',
            definitionSource: definition ? source || 'macOS Dictionary' : '',
            definitionError: definition ? '' : error || 'No system dictionary match'
          }
    )
  };
}

export function isVocabularyAvailable(stateValue) {
  const state = normalizeVocabularyState(stateValue);
  return FEATURE_ENABLED && state.enabled && state.entries.length > 0;
}

export function pickVocabularyEntry(stateValue, random = Math.random) {
  const state = normalizeVocabularyState(stateValue);
  if (!isVocabularyAvailable(state)) {
    throw new Error('Vocabulary feed is not available');
  }
  const index = Math.min(
    state.entries.length - 1,
    Math.max(0, Math.floor(random() * state.entries.length))
  );
  return state.entries[index];
}

export function buildVocabularyReplacement(entryValue) {
  const entry = normalizeEntry(entryValue);
  if (!entry) throw new Error('Vocabulary entry is invalid');
  const definition = entry.definition || 'Definition unavailable';
  return {
    kind: 'poem',
    id: `vocabulary-${entry.id}`,
    title: entry.term,
    creator: 'Your vocabulary',
    date: '',
    location: entry.definitionSource || 'Saved locally',
    sourceUrl: '',
    rights: 'Local only',
    credit: entry.definitionSource || 'De-Slop vocabulary',
    provider: 'Vocabulary',
    lines: [definition],
    vocabularyEntryId: entry.id,
    definitionStatus: entry.definitionStatus
  };
}

export function repairVocabularyStreams(
  settingsValue,
  vocabularyState,
  fallback = 'painting-classics'
) {
  const settings = settingsValue && typeof settingsValue === 'object'
    ? settingsValue
    : {};
  const streams = settings.streams && typeof settings.streams === 'object'
    ? settings.streams
    : {};
  if (isVocabularyAvailable(vocabularyState)) {
    return { ...settings, streams: { ...streams } };
  }

  return {
    ...settings,
    streams: Object.fromEntries(
      Object.entries(streams).map(([slot, stream]) => [
        slot,
        stream === STREAM_ID ? fallback : stream
      ])
    )
  };
}
