(function startPangramGallery() {
  const core = globalThis.PangramGalleryCore;
  if (!core || !globalThis.chrome?.runtime?.id) return;

  const CARD_CLASS = 'pangram-gallery-card';
  const HIDDEN_CLASS = 'pangram-gallery-original-hidden';
  const STATE_ATTRIBUTE = 'data-pangram-gallery-state';
  let settings = core.normalizeSettings();
  let scanTimer = null;
  let generation = 0;
  const residencyObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const card = entry.target;
              const image = card.querySelector('.pangram-gallery-card__image');
              if (!image) continue;

              if (entry.isIntersecting) {
                restoreCardImage(image);
              } else {
                unloadCardImage(image);
              }
            }
          },
          { rootMargin: '900px 0px' }
        )
      : null;

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(core.DEFAULT_SETTINGS, (value) => {
        resolve(core.normalizeSettings(value));
      });
    });
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function unloadCardImage(image) {
    if (!image.dataset.pangramGallerySrc || !image.getAttribute('src')) return;
    image.dataset.pangramGalleryUnloaded = 'true';
    image.removeAttribute('src');
  }

  function restoreCardImage(image) {
    const source = image.dataset.pangramGallerySrc;
    if (!source || image.getAttribute('src')) return;
    delete image.dataset.pangramGalleryUnloaded;
    image.src = source;
  }

  function disposeCard(card) {
    if (!card) return;
    residencyObserver?.unobserve(card);

    const target = card.pangramGalleryTarget;
    if (target?.pangramGalleryCard === card) {
      target.pangramGalleryCard = null;
    }
    card.pangramGalleryTarget = null;

    const image = card.querySelector?.('.pangram-gallery-card__image');
    if (image) unloadCardImage(image);
    card.remove();
  }

  function createCard(verdict, target) {
    const card = document.createElement('aside');
    card.className = `${CARD_CLASS} pangram-gallery-card--loading`;
    card.setAttribute(
      'role',
      target.getAttribute('role') === 'listitem' ? 'listitem' : 'region'
    );
    card.setAttribute('aria-label', `${verdict === 'mixed' ? 'Mixed' : 'AI'} post replaced`);
    card.setAttribute('aria-busy', 'true');

    const image = document.createElement('img');
    image.className = 'pangram-gallery-card__image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.loading = 'lazy';

    const toggle = document.createElement('button');
    toggle.className = 'pangram-gallery-card__toggle';
    toggle.type = 'button';
    toggle.textContent = 'Show original';
    toggle.addEventListener('click', () => {
      const isHidden = target.classList.toggle(HIDDEN_CLASS);
      card.classList.toggle('pangram-gallery-card--original-visible', !isHidden);
      toggle.textContent = isHidden ? 'Show original' : 'Hide original';
      toggle.setAttribute('aria-expanded', String(!isHidden));
    });
    toggle.setAttribute('aria-expanded', 'false');

    const imageFrame = document.createElement('div');
    imageFrame.className = 'pangram-gallery-card__image-frame';
    imageFrame.append(image, toggle);

    const imageStage = document.createElement('div');
    imageStage.className = 'pangram-gallery-card__image-stage';
    imageStage.append(imageFrame);

    const body = document.createElement('div');
    body.className = 'pangram-gallery-card__body';
    const title = createText('p', 'pangram-gallery-card__title', '');
    const location = createText('p', 'pangram-gallery-card__location', '');
    body.append(title, location);

    const source = document.createElement('a');
    source.className = 'pangram-gallery-card__source';
    source.target = '_blank';
    source.rel = 'noreferrer';
    body.append(source);

    card.append(imageStage, body);

    image.addEventListener(
      'error',
      () => {
        // Removing src for offscreen cards is intentional, not a provider failure.
        if (image.dataset.pangramGalleryUnloaded === 'true' || !card.isConnected) return;
        disposeCard(card);
        target.classList.remove(HIDDEN_CLASS);
        target.removeAttribute(STATE_ATTRIBUTE);
      }
    );

    card.pangramGalleryTarget = target;
    target.pangramGalleryCard = card;
    residencyObserver?.observe(card);

    return card;
  }

  function hydrateCard(card, item) {
    const image = card.querySelector('.pangram-gallery-card__image');
    const title = card.querySelector('.pangram-gallery-card__title');
    const location = card.querySelector('.pangram-gallery-card__location');
    const source = card.querySelector('.pangram-gallery-card__source');
    if (!image || !title || !location || !source) return false;

    image.dataset.pangramGallerySrc = item.assetUrl;
    image.alt = item.title ? `${item.title} by ${item.creator}` : 'Public-domain artwork';
    image.removeAttribute('aria-hidden');
    title.textContent = item.title;
    location.textContent = item.location || item.provider;
    source.href = item.sourceUrl;
    source.textContent = `${item.provider} · ${item.rights}`;
    card.classList.remove('pangram-gallery-card--loading');
    card.removeAttribute('aria-busy');
    restoreCardImage(image);
    return true;
  }

  function restoreTarget(target) {
    const state = target.getAttribute(STATE_ATTRIBUTE);
    if (!state) return;
    const previous = target.previousElementSibling;
    const card =
      target.pangramGalleryCard ||
      (previous?.classList.contains(CARD_CLASS) ? previous : null);
    if (card) disposeCard(card);
    target.classList.remove(HIDDEN_CLASS);
    target.removeAttribute(STATE_ATTRIBUTE);
  }

  async function replaceTarget(target, verdict, activeGeneration) {
    if (target.getAttribute(STATE_ATTRIBUTE)) return;
    target.setAttribute(STATE_ATTRIBUTE, 'pending');
    const card = createCard(verdict, target);
    target.before(card);
    target.classList.add(HIDDEN_CLASS);

    try {
      const response = await sendMessage({
        type: 'PANGRAM_GALLERY_GET_REPLACEMENT'
      });
      if (activeGeneration !== generation || !target.isConnected) {
        disposeCard(card);
        return;
      }
      if (!response?.ok || !response.item) throw new Error('No replacement available');

      if (!hydrateCard(card, response.item)) {
        throw new Error('Replacement card is unavailable');
      }
      target.setAttribute(STATE_ATTRIBUTE, 'replaced');
    } catch (_error) {
      disposeCard(card);
      target.classList.remove(HIDDEN_CLASS);
      target.removeAttribute(STATE_ATTRIBUTE);
    }
  }

  function processBadges(badges) {
    const activeGeneration = generation;
    for (const badge of badges) {
      if (!badge.isConnected) continue;
      const verdict = core.classifyBadgeText(badge.textContent || '');
      if (!verdict) continue;
      const target = core.findReplacementTarget(badge);
      if (!target) continue;

      if (core.shouldReplace(verdict, settings)) {
        void replaceTarget(target, verdict, activeGeneration);
      } else {
        restoreTarget(target);
      }
    }
  }

  function scanInitialDocument() {
    scanTimer = null;
    processBadges(document.querySelectorAll('.pangram-feed-badge'));
  }

  function removeOrphanedCardsFromRemovedSubtrees(records) {
    for (const record of records) {
      for (const node of record.removedNodes || []) {
        if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) continue;

        const cards = [];
        if (node.nodeType === 1 && node.matches?.(`.${CARD_CLASS}`)) cards.push(node);
        if (typeof node.querySelectorAll === 'function') {
          cards.push(...node.querySelectorAll(`.${CARD_CLASS}`));
        }
        for (const card of cards) {
          const target = card.pangramGalleryTarget;
          disposeCard(card);
          if (target?.isConnected) {
            target.classList.remove(HIDDEN_CLASS);
            target.removeAttribute(STATE_ATTRIBUTE);
          }
        }

        const targets = [];
        if (node.nodeType === 1) targets.push(node);
        if (typeof node.querySelectorAll === 'function') {
          targets.push(...node.querySelectorAll(`[${STATE_ATTRIBUTE}]`));
        }

        for (const target of targets) {
          const card = target.pangramGalleryCard;
          if (card && core.isOrphanedCard(card)) disposeCard(card);
          target.pangramGalleryCard = null;
        }
      }
    }
  }

  function scheduleInitialScan() {
    if (scanTimer !== null) return;
    scanTimer = window.setTimeout(scanInitialDocument, 80);
  }

  function restoreAll() {
    document.querySelectorAll(`.${CARD_CLASS}`).forEach(disposeCard);
    document.querySelectorAll(`[${STATE_ATTRIBUTE}]`).forEach((target) => {
      target.classList.remove(HIDDEN_CLASS);
      target.removeAttribute(STATE_ATTRIBUTE);
    });
  }

  async function refreshSettings() {
    generation += 1;
    settings = await loadSettings();
    restoreAll();
    scheduleInitialScan();
  }

  function handleMutations(records) {
    removeOrphanedCardsFromRemovedSubtrees(records);
    processBadges(core.collectBadgesFromMutationRecords(records));
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === 'sync') void refreshSettings();
  });

  void refreshSettings();
})();
