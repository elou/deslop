(function setUpOptions() {
  const core = globalThis.PangramGalleryCore;
  const controls = {
    enabled: document.querySelector('#enabled'),
    replaceMixed: document.querySelector('#replace-mixed'),
    met: document.querySelector('#provider-met'),
    artic: document.querySelector('#provider-artic'),
    status: document.querySelector('#save-status')
  };
  let statusTimer = null;

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
    controls.enabled.checked = settings.enabled;
    controls.replaceMixed.checked = settings.replaceMixed;
    controls.met.checked = settings.providers.met;
    controls.artic.checked = settings.providers.artic;
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
    controls.met,
    controls.artic
  ]) {
    control.addEventListener('change', () => void save());
  }

  void readSettings().then(render);
})();
