(function setUpOptions() {
  const core = globalThis.PangramGalleryCore;
  const STREAM_OPTIONS = [
    ['painting-classics', 'Painting Classics'],
    ['classic-poetry', 'Classic Poetry'],
    ['modern-art', 'Modern Art (experimental)'],
    ['deep-space', 'Deep Space'],
    ['newyorker-latest', 'New Yorker latest'],
    ['newyorker-cartoons', 'New Yorker cartoons']
  ];
  const controls = {
    enabled: document.querySelector('#enabled'),
    replaceMixed: document.querySelector('#replace-mixed'),
    styleModeToggle: document.querySelector('#style-mode-toggle'),
    streamShared: document.querySelector('#stream-shared'),
    streamAi: document.querySelector('#stream-ai'),
    streamMixed: document.querySelector('#stream-mixed'),
    status: document.querySelector('#save-status')
  };
  let styleMode = 'same';
  let statusTimer = null;

  for (const select of [
    controls.streamShared,
    controls.streamAi,
    controls.streamMixed
  ]) {
    for (const [value, label] of STREAM_OPTIONS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
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
    controls.enabled.checked = settings.enabled;
    controls.replaceMixed.checked = settings.replaceMixed;
    controls.streamShared.value = settings.streams.ai;
    controls.streamAi.value = settings.streams.ai;
    controls.streamMixed.value = settings.streams.mixed;
    controls.styleModeToggle.textContent =
      styleMode === 'same' ? 'Style each differently' : 'Style the same';
    document.body.dataset.styleMode = styleMode;
  }

  function showStatus(message) {
    window.clearTimeout(statusTimer);
    controls.status.textContent = message;
    statusTimer = window.setTimeout(() => {
      controls.status.textContent = 'Saved automatically';
    }, 1800);
  }

  async function save() {
    const settings = core.normalizeSettings({
      enabled: controls.enabled.checked,
      replaceMixed: controls.replaceMixed.checked,
      styleMode,
      streams: {
        ai:
          styleMode === 'same'
            ? controls.streamShared.value
            : controls.streamAi.value,
        mixed: controls.streamMixed.value
      }
    });
    await setSettings(settings);
    render(settings);
    showStatus('Saved');
  }

  for (const control of [
    controls.enabled,
    controls.replaceMixed,
    controls.streamShared,
    controls.streamAi,
    controls.streamMixed
  ]) {
    control.addEventListener('change', () => void save());
  }

  controls.styleModeToggle.addEventListener('click', () => {
    if (styleMode === 'same') {
      controls.streamAi.value = controls.streamShared.value;
      styleMode = 'different';
    } else {
      controls.streamShared.value = controls.streamAi.value;
      styleMode = 'same';
    }
    void save();
  });

  void readSettings().then(render);
})();
