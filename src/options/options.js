(function setUpOptions() {
  const core = globalThis.PangramGalleryCore;
  const STREAM_OPTIONS = [
    ['art', 'Art'],
    ['poetry', 'Poetry'],
    ['nasa', 'NASA space'],
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
    artSources: document.querySelector('#art-sources'),
    met: document.querySelector('#provider-met'),
    artic: document.querySelector('#provider-artic'),
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
    controls.met.checked = settings.providers.met;
    controls.artic.checked = settings.providers.artic;
    controls.styleModeToggle.textContent =
      styleMode === 'same' ? 'Style each differently' : 'Style the same';
    document.body.dataset.styleMode = styleMode;

    const activeStreams =
      styleMode === 'same'
        ? [settings.streams.ai]
        : [settings.streams.ai, settings.streams.mixed];
    controls.artSources.hidden = !activeStreams.includes('art');
  }

  function showStatus(message) {
    window.clearTimeout(statusTimer);
    controls.status.textContent = message;
    statusTimer = window.setTimeout(() => {
      controls.status.textContent = 'Saved automatically';
    }, 1800);
  }

  async function save() {
    if (!controls.met.checked && !controls.artic.checked) {
      controls.met.checked = true;
      showStatus('Keep at least one source on');
    }

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
      },
      providers: {
        met: controls.met.checked,
        artic: controls.artic.checked
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
    controls.streamMixed,
    controls.met,
    controls.artic
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
