import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORAGE_KEY,
  addVocabularyEntry,
  applyVocabularyDefinition,
  buildVocabularyReplacement,
  isVocabularyAvailable,
  normalizeVocabularyState,
  pickVocabularyEntry,
  repairVocabularyStreams
} from '../src/vocabulary-core.mjs';

test('uses a dedicated local storage key and defaults to an unavailable feed', () => {
  assert.equal(STORAGE_KEY, 'pangramGalleryVocabulary');
  assert.deepEqual(normalizeVocabularyState(), { enabled: false, entries: [] });
  assert.equal(isVocabularyAvailable({ enabled: true, entries: [] }), false);
});

test('accepts arbitrary selected text without splitting or word validation', () => {
  const state = addVocabularyEntry(
    { enabled: false, entries: [] },
    '  accidental multiple words  ',
    { id: 'entry-1', addedAt: '2026-08-01T20:00:00.000Z' }
  );

  assert.equal(state.entries.length, 1);
  assert.equal(state.entries[0].term, 'accidental multiple words');
  assert.equal(state.entries[0].definitionStatus, 'pending');
  assert.equal(state.entries[0].definition, '');
});

test('preserves duplicate selections as separate learnable entries', () => {
  const first = addVocabularyEntry({}, 'liminal', { id: 'one', addedAt: '2026-08-01T20:00:00.000Z' });
  const second = addVocabularyEntry(first, 'liminal', { id: 'two', addedAt: '2026-08-01T20:01:00.000Z' });

  assert.deepEqual(second.entries.map((entry) => entry.id), ['one', 'two']);
});

test('applies a system definition without changing the selected term', () => {
  const state = addVocabularyEntry({}, 'serendipity', { id: 'entry-1', addedAt: '2026-08-01T20:00:00.000Z' });
  const defined = applyVocabularyDefinition(state, 'entry-1', {
    definition: 'The occurrence of events by chance in a beneficial way.',
    source: 'macOS Dictionary'
  });

  assert.equal(defined.entries[0].term, 'serendipity');
  assert.equal(defined.entries[0].definitionStatus, 'defined');
  assert.equal(defined.entries[0].definitionSource, 'macOS Dictionary');
});

test('keeps a renderable entry when definition lookup fails', () => {
  const state = addVocabularyEntry({}, 'made up phrase', { id: 'entry-1', addedAt: '2026-08-01T20:00:00.000Z' });
  const unavailable = applyVocabularyDefinition(state, 'entry-1', {
    error: 'No system dictionary match'
  });
  const card = buildVocabularyReplacement(unavailable.entries[0]);

  assert.equal(unavailable.entries[0].definitionStatus, 'unavailable');
  assert.equal(card.kind, 'poem');
  assert.equal(card.title, 'made up phrase');
  assert.deepEqual(card.lines, ['Definition unavailable']);
});

test('only exposes and samples vocabulary when enabled and nonempty', () => {
  const populated = addVocabularyEntry({}, 'one', { id: 'one', addedAt: '2026-08-01T20:00:00.000Z' });
  assert.equal(isVocabularyAvailable(populated), false);
  assert.throws(() => pickVocabularyEntry(populated), /not available/i);

  const enabled = { ...populated, enabled: true };
  assert.equal(isVocabularyAvailable(enabled), true);
  assert.equal(pickVocabularyEntry(enabled, () => 0).term, 'one');
});

test('repairs every stale vocabulary routing slot to Painting Classics', () => {
  const settings = {
    streams: {
      ai: 'vocabulary',
      mixed: 'classic-poetry',
      assisted: 'vocabulary',
      promoted: 'vocabulary',
      suggested: 'vocabulary'
    }
  };
  const repaired = repairVocabularyStreams(settings, { enabled: false, entries: [] });

  assert.deepEqual(repaired.streams, {
    ai: 'painting-classics',
    mixed: 'classic-poetry',
    assisted: 'painting-classics',
    promoted: 'painting-classics',
    suggested: 'painting-classics'
  });
});
