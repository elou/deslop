(function setUpOptions() {
  const core = globalThis.PangramGalleryCore;
  const STREAM_OPTIONS = [
    ['painting-classics', '🖼️ Art'],
    ['art-2', '🖼️ Art 2'],
    ['classic-poetry', '📜 Poetry'],
    ['modern-art', '🎨 Modern Art (experimental)'],
    ['deep-space', '🌌 Deep Space'],
    ['newyorker-latest', '🗞️ Publisher feeds'],
    ['newyorker-cartoons', '🃏 New Yorker cartoons'],
    ['far-side', '🃏 Far Side (experimental)'],
    ['garros-gallery', '🎾 Garross Gallery'],
    ['surprise-me', '✨ Surprise me'],
    ['hide-ai', '❌ Hide AI completely']
  ];
  const PROMOTED_STREAM_OPTIONS = [
    ...STREAM_OPTIONS.filter(([value]) => value !== 'hide-ai'),
    ['hide-promoted', '❌ Hide all promoted']
  ];
  const SUGGESTED_STREAM_OPTIONS = [
    ...STREAM_OPTIONS.filter(([value]) => value !== 'hide-ai'),
    ['hide-suggested', '❌ Hide all suggested']
  ];
  const controls = {
    replaceMixed: document.querySelector('#replace-mixed'),
    replaceAssisted: document.querySelector('#replace-assisted'),
    hidePromoted: document.querySelector('#hide-promoted'),
    hideSuggested: document.querySelector('#hide-suggested'),
    platformLinkedIn: document.querySelector('#platform-linkedin'),
    platformX: document.querySelector('#platform-x'),
    styleModeToggle: document.querySelector('#style-mode-toggle'),
    streamShared: document.querySelector('#stream-shared'),
    streamAi: document.querySelector('#stream-ai'),
    streamMixed: document.querySelector('#stream-mixed'),
    streamAssisted: document.querySelector('#stream-assisted'),
    streamPromoted: document.querySelector('#stream-promoted'),
    streamSuggested: document.querySelector('#stream-suggested'),
    closeOptions: document.querySelector('#close-options'),
    status: document.querySelector('#save-status')
  };
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
  let statusTimer = null;

  for (const select of [
    controls.streamShared,
    controls.streamAi,
    controls.streamMixed,
    controls.streamAssisted
  ]) {
    for (const [value, label] of STREAM_OPTIONS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }
  for (const [value, label] of PROMOTED_STREAM_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    controls.streamPromoted.append(option);
  }
  for (const [value, label] of SUGGESTED_STREAM_OPTIONS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    controls.streamSuggested.append(option);
  }

  function readSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(core.DEFAULT_SETTINGS, (value) => {
        resolve(core.normalizeSettings(value));
      });
    });
  }

  function setSettings(value) {
    return new Promise((resolve) => chrome.storage.sync.set(value, resolve));
  }

  function render(settings) {
    styleMode = settings.styleMode;
    controls.replaceMixed.checked = settings.replaceMixed;
    controls.replaceAssisted.checked = settings.replaceAssisted;
    controls.hidePromoted.checked = settings.hidePromoted;
    controls.hideSuggested.checked = settings.hideSuggested;
    controls.platformLinkedIn.checked = settings.platforms.linkedin;
    controls.platformX.checked = settings.platforms.x;
    cleanupBlocks[0].dataset.active = settings.hidePromoted ? 'true' : 'false';
    cleanupBlocks[1].dataset.active = settings.hideSuggested ? 'true' : 'false';
    verdictBlocks[0].dataset.active = 'true';
    verdictBlocks[1].dataset.active = settings.replaceMixed ? 'true' : 'false';
    verdictBlocks[2].dataset.active = settings.replaceAssisted ? 'true' : 'false';
    controls.streamShared.value = settings.streams.ai;
    controls.streamAi.value = settings.streams.ai;
    controls.streamMixed.value = settings.streams.mixed;
    controls.streamAssisted.value = settings.streams.assisted;
    controls.streamPromoted.value = settings.streams.promoted;
    controls.streamSuggested.value = settings.streams.suggested;
    controls.styleModeToggle.textContent =
      styleMode === 'same' ? 'Style each differently' : 'Style the same';
    document.body.dataset.styleMode = styleMode;
  }

  function showStatus(message) {
    if (!controls.status) return;
    window.clearTimeout(statusTimer);
    controls.status.textContent = message;
    statusTimer = window.setTimeout(() => {
      controls.status.textContent = 'Saved automatically';
    }, 1800);
  }

  async function save() {
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
        promoted: controls.streamPromoted.value
        ,suggested: controls.streamSuggested.value
      }
    });
    await setSettings(settings);
    render(settings);
    showStatus('Saved');
  }

  for (const control of [
    controls.replaceMixed,
    controls.replaceAssisted,
    controls.hidePromoted,
    controls.hideSuggested,
    controls.platformLinkedIn,
    controls.platformX,
    controls.streamShared,
    controls.streamAi,
    controls.streamMixed,
    controls.streamAssisted,
    controls.streamPromoted
    ,controls.streamSuggested
  ]) {
    control.addEventListener('change', () => void save());
  }

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
    void save();
  });

  controls.closeOptions.addEventListener('click', () => window.close());

  void readSettings().then((settings) => {
    render(settings);
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        document.body.dataset.optionsReady = 'true';
      })
    );
  });
})();
