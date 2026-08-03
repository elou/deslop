import * as vocabularyCore from '../vocabulary-core.mjs';

(function setUpOptions() {
  const core = globalThis.PangramGalleryCore;
  const STREAM_OPTIONS = [
    ['painting-classics', '🖼️ Art'],
    ['classic-poetry', '📜 Poetry'],
    ['modern-art', '🎨 Modern Art (experimental)'],
    ['deep-space', '🌌 Deep Space'],
    ['garros-gallery', '🎾 Garross Gallery'],
    ['baking-recipes', '🧁 Muffins + Desserts'],
    ['surprise-me', '✨ Surprise me'],
    ['hide-ai', '❌ Hide AI completely']
  ];
  const VOCABULARY_OPTION = ['vocabulary', '📚 Vocabulary'];
  const controls = {
    replaceMixed: document.querySelector('#replace-mixed'),
    replaceAssisted: document.querySelector('#replace-assisted'),
    hidePromoted: document.querySelector('#hide-promoted'),
    hideSuggested: document.querySelector('#hide-suggested'),
    platformLinkedIn: document.querySelector('#platform-linkedin'),
    platformX: document.querySelector('#platform-x'),
    vocabularySection: document.querySelector('.vocabulary-section'),
    vocabularyEnabled: document.querySelector('#vocabulary-enabled'),
    vocabularyStatus: document.querySelector('#vocabulary-status'),
    styleModeToggle: document.querySelector('#style-mode-toggle'),
    streamShared: document.querySelector('#stream-shared'),
    streamAi: document.querySelector('#stream-ai'),
    streamMixed: document.querySelector('#stream-mixed'),
    streamAssisted: document.querySelector('#stream-assisted'),
    streamPromoted: document.querySelector('#stream-promoted'),
    streamSuggested: document.querySelector('#stream-suggested'),
    closeOptions: document.querySelector('#close-options')
  };
  const verdictSelects = [
    controls.streamShared,
    controls.streamAi,
    controls.streamMixed,
    controls.streamAssisted
  ];
  const allSelects = [
    ...verdictSelects,
    controls.streamPromoted,
    controls.streamSuggested
  ];
  const cleanupBlocks = [
    controls.hidePromoted.closest('.cleanup-choice'),
    controls.hideSuggested.closest('.cleanup-choice')
  ];
  const verdictBlocks = [
    controls.streamAi.closest('.verdict-choice'),
    controls.streamMixed.closest('.verdict-choice'),
    controls.streamAssisted.closest('.verdict-choice')
  ];
  let styleMode = 'same';
  let vocabularyState = vocabularyCore.normalizeVocabularyState();
  controls.vocabularySection.hidden = !vocabularyCore.FEATURE_ENABLED;

  function storageGet(area, defaults) {
    return new Promise((resolve) => chrome.storage[area].get(defaults, resolve));
  }

  function storageSet(area, value) {
    return new Promise((resolve) => chrome.storage[area].set(value, resolve));
  }

  async function readState() {
    const [settingsValue, vocabularyValue] = await Promise.all([
      storageGet('sync', core.DEFAULT_SETTINGS),
      storageGet('local', { [vocabularyCore.STORAGE_KEY]: vocabularyState })
    ]);
    const localVocabulary = vocabularyCore.normalizeVocabularyState(
      vocabularyValue[vocabularyCore.STORAGE_KEY]
    );
    const originalSettings = core.normalizeSettings(settingsValue);
    const settings = core.normalizeSettings(
      vocabularyCore.repairVocabularyStreams(originalSettings, localVocabulary)
    );
    return {
      vocabulary: localVocabulary,
      settings,
      settingsChanged:
        JSON.stringify(settings.streams) !==
        JSON.stringify(originalSettings.streams)
    };
  }

  function appendOptions(select, options) {
    select.replaceChildren();
    for (const [value, label] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }

  function renderStreamOptions(vocabulary) {
    const liveOptions = vocabularyCore.isVocabularyAvailable(vocabulary)
      ? [...STREAM_OPTIONS.slice(0, -1), VOCABULARY_OPTION, STREAM_OPTIONS.at(-1)]
      : STREAM_OPTIONS;
    const cleanupOptions = liveOptions.filter(([value]) => value !== 'hide-ai');

    for (const select of verdictSelects) appendOptions(select, liveOptions);
    appendOptions(controls.streamPromoted, [
      ...cleanupOptions,
      ['hide-promoted', '❌ Hide all promoted']
    ]);
    appendOptions(controls.streamSuggested, [
      ...cleanupOptions,
      ['hide-suggested', '❌ Hide all suggested']
    ]);
  }

  function renderVocabularyStatus(vocabulary) {
    const count = vocabulary.entries.length;
    const defined = vocabulary.entries.filter(
      (entry) => entry.definitionStatus === 'defined'
    ).length;
    controls.vocabularyEnabled.checked = vocabulary.enabled;
    controls.vocabularyStatus.textContent = count
      ? `${count} saved locally · ${defined} defined`
      : 'No saved text yet. Select text on a page, then right-click to add it.';
  }

  function render(settings, vocabulary) {
    vocabularyState = vocabularyCore.normalizeVocabularyState(vocabulary);
    const safeSettings = core.normalizeSettings(
      vocabularyCore.repairVocabularyStreams(settings, vocabularyState)
    );
    styleMode = safeSettings.styleMode;
    renderStreamOptions(vocabularyState);
    renderVocabularyStatus(vocabularyState);
    controls.replaceMixed.checked = safeSettings.replaceMixed;
    controls.replaceAssisted.checked = safeSettings.replaceAssisted;
    controls.hidePromoted.checked = safeSettings.hidePromoted;
    controls.hideSuggested.checked = safeSettings.hideSuggested;
    controls.platformLinkedIn.checked = safeSettings.platforms.linkedin;
    controls.platformX.checked = safeSettings.platforms.x;
    cleanupBlocks[0].dataset.active = safeSettings.hidePromoted ? 'true' : 'false';
    cleanupBlocks[1].dataset.active = safeSettings.hideSuggested ? 'true' : 'false';
    verdictBlocks[0].dataset.active = 'true';
    verdictBlocks[1].dataset.active = safeSettings.replaceMixed ? 'true' : 'false';
    verdictBlocks[2].dataset.active = safeSettings.replaceAssisted ? 'true' : 'false';
    controls.streamShared.value = safeSettings.streams.ai;
    controls.streamAi.value = safeSettings.streams.ai;
    controls.streamMixed.value = safeSettings.streams.mixed;
    controls.streamAssisted.value = safeSettings.streams.assisted;
    controls.streamPromoted.value = safeSettings.streams.promoted;
    controls.streamSuggested.value = safeSettings.streams.suggested;
    controls.styleModeToggle.textContent =
      styleMode === 'same' ? 'Style each differently' : 'Style the same';
    document.body.dataset.styleMode = styleMode;
    return safeSettings;
  }

  async function saveSettings() {
    const settings = core.normalizeSettings({
      replaceMixed: controls.replaceMixed.checked,
      replaceAssisted: controls.replaceAssisted.checked,
      hidePromoted: controls.hidePromoted.checked,
      hideSuggested: controls.hideSuggested.checked,
      platforms: {
        linkedin: controls.platformLinkedIn.checked,
        x: controls.platformX.checked
      },
      styleMode,
      streams: {
        ai:
          styleMode === 'same'
            ? controls.streamShared.value
            : controls.streamAi.value,
        mixed: controls.streamMixed.value,
        assisted: controls.streamAssisted.value,
        promoted: controls.streamPromoted.value,
        suggested: controls.streamSuggested.value
      }
    });
    const safeSettings = core.normalizeSettings(
      vocabularyCore.repairVocabularyStreams(settings, vocabularyState)
    );
    await storageSet('sync', safeSettings);
    render(safeSettings, vocabularyState);
  }

  async function saveVocabularyEnabled() {
    vocabularyState = {
      ...vocabularyState,
      enabled: controls.vocabularyEnabled.checked
    };
    await storageSet('local', {
      [vocabularyCore.STORAGE_KEY]: vocabularyState
    });
    const { settings } = await readState();
    await storageSet('sync', settings);
    render(settings, vocabularyState);
  }

  for (const control of [
    controls.replaceMixed,
    controls.replaceAssisted,
    controls.hidePromoted,
    controls.hideSuggested,
    controls.platformLinkedIn,
    controls.platformX,
    ...allSelects
  ]) {
    control.addEventListener('change', () => void saveSettings());
  }

  controls.vocabularyEnabled.addEventListener(
    'change',
    () => void saveVocabularyEnabled()
  );

  controls.styleModeToggle.addEventListener('click', () => {
    if (styleMode === 'same') {
      controls.streamAi.value = controls.streamShared.value;
      controls.streamMixed.value = controls.streamShared.value;
      controls.streamAssisted.value = controls.streamShared.value;
      styleMode = 'different';
    } else {
      controls.streamShared.value = controls.streamAi.value;
      styleMode = 'same';
    }
    void saveSettings();
  });

  controls.closeOptions.addEventListener('click', () => window.close());

  chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName !== 'local') return;
    void readState().then(({ settings, vocabulary }) => render(settings, vocabulary));
  });

  void readState().then(async ({ settings, vocabulary, settingsChanged }) => {
    if (settingsChanged) await storageSet('sync', settings);
    render(settings, vocabulary);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        document.body.dataset.optionsReady = 'true';
      })
    );
  });
})();
