(function setUpHiddenFeedReport() {
  const historyCore = globalThis.PangramGalleryHistory;
  const controls = {
    status: document.querySelector('#report-status'),
    content: document.querySelector('#report-content'),
    error: document.querySelector('#error-state'),
    empty: document.querySelector('#empty-state'),
    actorList: document.querySelector('#actor-list'),
    total: document.querySelector('#total-hidden'),
    ai: document.querySelector('#total-ai'),
    mixed: document.querySelector('#total-mixed'),
    assisted: document.querySelector('#total-assisted'),
    unattributed: document.querySelector('#total-unattributed'),
    reset: document.querySelector('#reset-history'),
    retry: document.querySelector('#retry-report')
  };

  function readHistory() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        { [historyCore.STORAGE_KEY]: historyCore.normalizeHistory() },
        (value) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(historyCore.normalizeHistory(value[historyCore.STORAGE_KEY]));
        }
      );
    });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat().format(value);
  }

  function formatDate(value) {
    if (!value) return 'Unavailable';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(value));
  }

  function formatReasons(reasons) {
    const labels = [
      ['posted', 'posted'],
      ['liked', 'liked'],
      ['commented', 'commented'],
      ['reposted', 'reposted']
    ];
    const parts = labels
      .filter(([key]) => reasons[key] > 0)
      .map(([key, label]) => `${formatNumber(reasons[key])} ${label}`);
    return parts.join(' · ') || 'Source activity unavailable';
  }

  function createActorRow(actor) {
    const row = document.createElement('li');
    row.className = 'actor-row';

    const profile = document.createElement('a');
    profile.className = 'actor-profile';
    profile.href = actor.profileUrl;
    profile.target = '_blank';
    profile.rel = 'noreferrer';
    profile.textContent = actor.name;

    const count = document.createElement('div');
    count.className = 'actor-count';
    const countValue = document.createElement('strong');
    countValue.textContent = formatNumber(actor.hiddenCount);
    const countLabel = document.createElement('span');
    countLabel.textContent = actor.hiddenCount === 1 ? 'post hidden' : 'posts hidden';
    count.append(countValue, countLabel);

    const reasons = document.createElement('p');
    reasons.className = 'actor-reasons';
    reasons.textContent = formatReasons(actor.reasons);

    const dates = document.createElement('div');
    dates.className = 'actor-dates';
    const first = document.createElement('span');
    first.textContent = `First seen ${formatDate(actor.firstSeen)}`;
    const last = document.createElement('span');
    last.textContent = `Last seen ${formatDate(actor.lastSeen)}`;
    dates.append(first, last);

    row.append(profile, count, reasons, dates);
    return row;
  }

  function render(historyValue) {
    const history = historyCore.normalizeHistory(historyValue);
    const actors = historyCore.sortedActors(history);
    controls.total.textContent = formatNumber(history.totalHidden);
    controls.ai.textContent = formatNumber(history.verdicts.ai);
    controls.mixed.textContent = formatNumber(history.verdicts.mixed);
    controls.assisted.textContent = formatNumber(history.verdicts.assisted);
    controls.unattributed.textContent = formatNumber(history.unattributedHidden);
    controls.actorList.replaceChildren(...actors.map(createActorRow));

    controls.empty.hidden = actors.length > 0;
    if (actors.length === 0) {
      const title = controls.empty.querySelector('.empty-state__title');
      const detail = controls.empty.querySelector('p:last-child');
      if (history.totalHidden > 0) {
        title.textContent = 'No source profiles available';
        detail.textContent =
          'The hidden posts were counted, but LinkedIn did not expose a person profile for their feed source.';
      } else {
        title.textContent = 'No hidden posts yet';
        detail.textContent =
          'When De-Slop replaces an AI-labeled post, its feed source will appear here.';
      }
    }

    document.body.dataset.state = 'ready';
    controls.status.textContent = `${history.totalHidden} hidden posts loaded.`;
    controls.error.hidden = true;
    controls.content.hidden = false;
  }

  function showError() {
    document.body.dataset.state = 'error';
    controls.status.textContent = 'Hidden feed history could not be loaded.';
    controls.content.hidden = true;
    controls.error.hidden = false;
  }

  async function loadReport() {
    document.body.dataset.state = 'loading';
    controls.status.textContent = 'Loading hidden feed history…';
    controls.error.hidden = true;
    try {
      render(await readHistory());
    } catch (_error) {
      showError();
    }
  }

  controls.retry.addEventListener('click', () => void loadReport());
  controls.reset.addEventListener('click', () => {
    const confirmed = window.confirm(
      'Clear De-Slop’s hidden feed history from this browser? Filter settings will not change.'
    );
    if (!confirmed) return;
    chrome.storage.local.remove(historyCore.STORAGE_KEY, () => {
      if (chrome.runtime.lastError) {
        showError();
        return;
      }
      render(historyCore.normalizeHistory());
      controls.status.textContent = 'Hidden feed history cleared.';
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[historyCore.STORAGE_KEY]) return;
    render(changes[historyCore.STORAGE_KEY].newValue);
  });

  void loadReport();
})();
