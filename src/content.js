(function startPangramGallery() {
  const documentRoot = globalThis.document?.documentElement;
  documentRoot?.setAttribute('data-pangram-gallery-boot', 'starting');
  const core = globalThis.PangramGalleryCore;
  if (!core) {
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'missing-core');
    return;
  }
  if (!globalThis.chrome?.storage?.sync || !globalThis.chrome?.storage?.onChanged) {
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'missing-storage-api');
    return;
  }
  if (!globalThis.chrome?.runtime?.sendMessage) {
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'missing-runtime-api');
    return;
  }

  const CARD_CLASS = 'pangram-gallery-card';
  const HIDDEN_CLASS = 'pangram-gallery-original-hidden';
  const STATE_ATTRIBUTE = 'data-pangram-gallery-state';
  const COMMENT_STATE_ATTRIBUTE = 'data-pangram-gallery-comment-state';
  const COMMENT_ORIGINAL_CLASS = 'pangram-gallery-comment-original';
  const COMMENT_CLOWNS_CLASS = 'pangram-gallery-comment-clowns';
  const STARTUP_CATCH_UP_DELAYS = Object.freeze([800, 2400]);
  let settings = core.normalizeSettings();
  let scanTimer = null;
  let generation = 0;
  const residencyObserver =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const card = entry.target;
              card.pangramGalleryResident = entry.isIntersecting && card.isConnected;
              const image = card.querySelector('.pangram-gallery-card__image');
              if (!image) continue;

              if (card.pangramGalleryResident) {
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

  function getOriginalPostAuthor(target) {
    const authorLink = target.querySelector?.(
      '.update-components-actor__title a, .feed-shared-actor__title a, a[href*="/in/"], a[href*="/company/"]'
    );
    const name = authorLink?.textContent?.trim().replace(/\s+/g, ' ');
    const href = authorLink?.href;
    return name && href ? { name, href } : null;
  }

  function formatVerdict(verdict) {
    if (verdict === 'mixed') return '🤖 Mixed';
    if (verdict === 'ai-assisted') return '🤖 AI-Assisted';
    if (verdict === 'promoted') return '💸 Promoted';
    if (verdict === 'suggested') return '🤓 Suggested';
    return '🤖 AI';
  }

  function getDescription(item) {
    const details = [item.creator, item.date].filter(Boolean);
    return details.join(' · ') || item.credit || item.location || item.provider;
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
    card.pangramGalleryResident = false;

    if (
      card.pangramGalleryRemountTimer !== null &&
      card.pangramGalleryRemountTimer !== undefined
    ) {
      window.clearTimeout(card.pangramGalleryRemountTimer);
    }
    card.pangramGalleryRemountTimer = null;
    card.pangramGalleryRemountPending = false;

    const target = card.pangramGalleryTarget;
    if (target?.pangramGalleryCard === card) {
      target.pangramGalleryCard = null;
    }
    card.pangramGalleryTarget = null;

    const image = card.querySelector?.('.pangram-gallery-card__image');
    if (image) unloadCardImage(image);
    card.remove();
  }

  function releaseCardTarget(card, target) {
    const ownsTarget = target?.pangramGalleryCard === card;
    disposeCard(card);
    if (!ownsTarget) return;
    target.classList.remove(HIDDEN_CLASS);
    target.removeAttribute(STATE_ATTRIBUTE);
  }

  function createCard(verdict, target) {
    const card = document.createElement('aside');
    card.className = `${CARD_CLASS} pangram-gallery-card--loading`;
    card.pangramGalleryRemountCount = 0;
    card.pangramGalleryRemountTimer = null;
    card.pangramGalleryRemountPending = false;
    card.setAttribute('role', 'region');
    const verdictLabel = verdict === 'mixed'
      ? 'Mixed'
      : verdict === 'ai-assisted'
        ? 'AI-assisted'
        : verdict === 'promoted'
          ? 'Promoted'
          : verdict === 'suggested'
            ? 'Suggested'
            : 'AI';
    card.setAttribute('aria-label', `${verdictLabel} post replaced`);
    card.setAttribute('aria-busy', 'true');

    const image = document.createElement('img');
    image.className = 'pangram-gallery-card__image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.loading = 'lazy';

    const poem = document.createElement('blockquote');
    poem.className = 'pangram-gallery-card__poem';
    poem.hidden = true;

    const toggle = document.createElement('button');
    toggle.className = 'pangram-gallery-card__toggle';
    toggle.type = 'button';
    toggle.textContent = 'Unhide';
    toggle.addEventListener('click', () => {
      const isHidden = target.classList.toggle(HIDDEN_CLASS);
      card.classList.toggle('pangram-gallery-card--original-visible', !isHidden);
      toggle.textContent = isHidden ? 'Unhide' : 'Hide';
      toggle.setAttribute('aria-expanded', String(!isHidden));
    });
    toggle.setAttribute('aria-expanded', 'false');

    const imageFrame = document.createElement('div');
    imageFrame.className = 'pangram-gallery-card__image-frame';
    imageFrame.append(image, poem);

    const imageStage = document.createElement('div');
    imageStage.className = 'pangram-gallery-card__image-stage';
    imageStage.append(imageFrame);

    const body = document.createElement('div');
    body.className = 'pangram-gallery-card__body';
    const notice = createText('p', 'pangram-gallery-card__notice', '');
    notice.hidden = true;
    const title = createText('p', 'pangram-gallery-card__title', '');
    const description = createText('p', 'pangram-gallery-card__description', '');
    const postMeta = document.createElement('div');
    postMeta.className = 'pangram-gallery-card__post-meta';
    const byline = document.createElement('span');
    byline.className = 'pangram-gallery-card__byline';
    const author = document.createElement('a');
    author.className = 'pangram-gallery-card__author';
    author.target = '_blank';
    author.rel = 'noreferrer';
    const verdictChip = createText(
      'span',
      'pangram-gallery-card__verdict',
      formatVerdict(verdict)
    );
    verdictChip.setAttribute('aria-label', `Pangram verdict: ${verdictLabel}`);
    postMeta.append(byline, toggle, verdictChip);
    body.append(notice, title, description, postMeta);

    card.append(imageStage, body);

    image.addEventListener(
      'error',
      () => {
        // Removing src for offscreen cards is intentional, not a provider failure.
        if (
          image.dataset.pangramGalleryUnloaded === 'true' ||
          (!card.isConnected && !card.pangramGalleryRemountPending)
        ) return;
        releaseCardTarget(card, target);
      }
    );

    card.pangramGalleryTarget = target;
    card.pangramGalleryAuthor = getOriginalPostAuthor(target);
    card.pangramGalleryResident = residencyObserver ? null : true;
    target.pangramGalleryCard = card;
    residencyObserver?.observe(card);

    return card;
  }

  function hydrateCard(card, item) {
    const image = card.querySelector('.pangram-gallery-card__image');
    const poem = card.querySelector('.pangram-gallery-card__poem');
    const title = card.querySelector('.pangram-gallery-card__title');
    const description = card.querySelector('.pangram-gallery-card__description');
    const byline = card.querySelector('.pangram-gallery-card__byline');
    const author = card.querySelector('.pangram-gallery-card__author');
    const notice = card.querySelector('.pangram-gallery-card__notice');
    const toggle = card.querySelector('.pangram-gallery-card__toggle');
    const verdict = card.querySelector('.pangram-gallery-card__verdict');
    if (!image || !poem || !title || !description || !byline || !author || !notice || !toggle || !verdict) return false;

    if (item.kind === 'notice') {
      notice.textContent = item.title || '☢️ De-slopped your feed';
      notice.hidden = false;
      title.hidden = true;
      description.hidden = true;
      byline.hidden = true;
      verdict.hidden = true;
      image.hidden = true;
      poem.hidden = true;
      toggle.hidden = false;
      card.classList.add('pangram-gallery-card--notice');
    } else if (item.kind === 'poem') {
      const lines = Array.isArray(item.lines) ? item.lines : [];
      if (!lines.length) return false;
      poem.textContent = lines.slice(0, 12).join('\n');
      poem.hidden = false;
      card.classList.add('pangram-gallery-card--poem');
    } else {
      if (!item.assetUrl) return false;
      image.dataset.pangramGallerySrc = item.assetUrl;
      image.alt = item.title
        ? `${item.title}${item.creator ? ` by ${item.creator}` : ''}`
        : 'Replacement image';
      image.removeAttribute('aria-hidden');
    }
    if (item.kind !== 'notice') {
      title.textContent = item.title;
      description.textContent = getDescription(item);
      const postAuthor = card.pangramGalleryAuthor;
      if (postAuthor) {
        byline.textContent = 'Original post by ';
        author.href = postAuthor.href;
        author.textContent = postAuthor.name;
        byline.append(author);
      } else {
        byline.textContent = 'Original post';
      }
    }
    card.classList.remove('pangram-gallery-card--loading');
    card.removeAttribute('aria-busy');
    if (item.kind !== 'poem') {
      if (card.pangramGalleryResident !== false) restoreCardImage(image);
    }
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

  async function replaceTarget(target, verdict, activeGeneration, stream = null) {
    if (target.getAttribute(STATE_ATTRIBUTE)) return;
    target.setAttribute(STATE_ATTRIBUTE, 'pending');
    const card = createCard(verdict, target);
    target.before(card);
    target.classList.add(HIDDEN_CLASS);

    try {
      const response = await sendMessage({
        type: 'PANGRAM_GALLERY_GET_REPLACEMENT',
        verdict,
        stream
      });
      if (
        activeGeneration !== generation ||
        !target.isConnected ||
        (!card.isConnected && !card.pangramGalleryRemountPending) ||
        target.pangramGalleryCard !== card
      ) {
        releaseCardTarget(card, target);
        return;
      }
      if (!response?.ok || !response.item) throw new Error('No replacement available');

      if (!hydrateCard(card, response.item)) {
        throw new Error('Replacement card is unavailable');
      }
      target.setAttribute(STATE_ATTRIBUTE, 'replaced');
    } catch (_error) {
      releaseCardTarget(card, target);
    }
  }

  function restoreCommentTarget(target) {
    if (!target?.hasAttribute?.(COMMENT_STATE_ATTRIBUTE)) return;
    const treatment = target.pangramGalleryCommentTreatment;
    treatment?.original?.classList?.remove(COMMENT_ORIGINAL_CLASS);
    treatment?.clowns?.remove?.();
    target.querySelectorAll?.(`.${COMMENT_ORIGINAL_CLASS}`).forEach((element) => {
      element.classList.remove(COMMENT_ORIGINAL_CLASS);
    });
    target.querySelectorAll?.(`.${COMMENT_CLOWNS_CLASS}`).forEach((element) => {
      element.remove();
    });
    target.pangramGalleryCommentTreatment = null;
    target.removeAttribute(COMMENT_STATE_ATTRIBUTE);
  }

  function isCommentTextExcluded(textNode, root) {
    const parent = textNode.parentElement;
    if (!parent || !textNode.textContent?.trim()) return true;
    if (parent.closest?.(`.${COMMENT_CLOWNS_CLASS}, .pangram-feed-badge, .${CARD_CLASS}`)) {
      return true;
    }
    if (parent.closest?.('script, style, noscript, template, svg, button, input, textarea, select, option, [contenteditable="true"]')) {
      return true;
    }
    return !root.contains(textNode);
  }

  function getCommentTreatmentRoot(commentTarget, badge) {
    const pangramText = commentTarget.querySelector?.('[data-pangram-text-id]');
    if (pangramText) return pangramText;
    const scannedHost = badge?.closest?.('[data-pangram-scanned="true"]');
    if (scannedHost && scannedHost !== commentTarget) return scannedHost;
    return null;
  }

  function clownCommentTarget(commentTarget, badge) {
    restoreTarget(commentTarget);
    restoreCommentTarget(commentTarget);

    const root = getCommentTreatmentRoot(commentTarget, badge);
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const visibleText = [];
    let node = walker.nextNode();
    while (node) {
      if (!isCommentTextExcluded(node, root)) visibleText.push(node.textContent || '');
      node = walker.nextNode();
    }
    if (!visibleText.length) return;

    const clowns = document.createElement('span');
    clowns.className = COMMENT_CLOWNS_CLASS;
    clowns.setAttribute('aria-hidden', 'true');
    clowns.textContent = core.clownifyText(visibleText.join(''));
    root.classList.add(COMMENT_ORIGINAL_CLASS);
    root.after(clowns);

    commentTarget.pangramGalleryCommentTreatment = { original: root, clowns };
    commentTarget.setAttribute(COMMENT_STATE_ATTRIBUTE, 'clowned');
  }

  function processBadges(badges) {
    const activeGeneration = generation;
    for (const badge of badges) {
      if (!badge.isConnected) continue;
      const verdict = core.classifyBadgeText(badge.textContent || '');
      if (!verdict) continue;
      const commentTarget = core.findCommentTarget(badge);
      if (commentTarget) {
        if (core.shouldReplace(verdict, settings)) {
          clownCommentTarget(commentTarget, badge);
        } else {
          restoreCommentTarget(commentTarget);
        }
        continue;
      }
      const target = core.findReplacementTarget(badge);
      if (!target) continue;

      if (settings.hidePromoted && core.isPromotedTarget(target)) {
        void replaceCleanupTarget(target, 'promoted', activeGeneration);
        continue;
      }

      if (settings.hideSuggested && core.isSuggestedTarget(target)) {
        void replaceCleanupTarget(target, 'suggested', activeGeneration);
        continue;
      }

      if (core.shouldReplace(verdict, settings)) {
        void replaceTarget(target, verdict, activeGeneration);
      } else {
        restoreTarget(target);
      }
    }
  }

  function scanInitialDocument() {
    scanTimer = null;
    if (settings.hidePromoted || settings.hideSuggested) {
      processCleanupTargets(
        settings.hidePromoted ? core.collectPromotedTargets(document) : [],
        settings.hideSuggested ? core.collectSuggestedTargets(document) : []
      );
    }
    processBadges(document.querySelectorAll('.pangram-feed-badge'));
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'initial-scan-complete');
  }

  function replaceCleanupTarget(target, cleanupType, activeGeneration) {
    if (!target?.isConnected || target.getAttribute(STATE_ATTRIBUTE)) return;
    void replaceTarget(
      target,
      cleanupType,
      activeGeneration,
      core.getStreamForCleanup(settings, cleanupType)
    );
  }

  function processCleanupTargets(promotedTargetValues, suggestedTargetValues) {
    const activeGeneration = generation;
    const promotedTargets = new Set(promotedTargetValues || []);
    const suggestedTargets = new Set(suggestedTargetValues || []);
    const targets = new Set([...promotedTargets, ...suggestedTargets]);

    for (const target of targets) {
      if (!target?.isConnected) continue;
      if (settings.hidePromoted && promotedTargets.has(target)) {
        replaceCleanupTarget(target, 'promoted', activeGeneration);
      } else if (settings.hideSuggested && suggestedTargets.has(target)) {
        replaceCleanupTarget(target, 'suggested', activeGeneration);
      }
    }
  }

  function scheduleCardRemount(card, target) {
    if (card?.pangramGalleryRemountPending) return true;
    if (
      !card ||
      !target?.isConnected ||
      target.pangramGalleryCard !== card ||
      !target.hasAttribute(STATE_ATTRIBUTE) ||
      !target.classList.contains(HIDDEN_CLASS) ||
      card.pangramGalleryRemountCount >= 2
    ) {
      return false;
    }

    card.pangramGalleryRemountCount += 1;
    card.pangramGalleryRemountPending = true;
    card.pangramGalleryRemountTimer = window.setTimeout(() => {
      card.pangramGalleryRemountTimer = null;
      if (
        !target.isConnected ||
        target.pangramGalleryCard !== card ||
        !target.hasAttribute(STATE_ATTRIBUTE) ||
        !target.classList.contains(HIDDEN_CLASS)
      ) {
        releaseCardTarget(card, target);
        return;
      }

      target.before(card);
      card.pangramGalleryRemountPending = false;
    }, 80);
    return true;
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
          if (card.isConnected) continue;
          const target = card.pangramGalleryTarget;
          if (scheduleCardRemount(card, target)) continue;
          releaseCardTarget(card, target);
        }

        const targets = [];
        if (node.nodeType === 1) targets.push(node);
        if (typeof node.querySelectorAll === 'function') {
          targets.push(...node.querySelectorAll(`[${STATE_ATTRIBUTE}]`));
        }

        for (const target of targets) {
          if (target.isConnected) continue;
          const card = target.pangramGalleryCard;
          if (card && core.isOrphanedCard(card)) releaseCardTarget(card, target);
        }
      }
    }
  }

  function scheduleInitialScan() {
    if (scanTimer !== null) return;
    scanTimer = window.setTimeout(scanInitialDocument, 80);
  }

  function scheduleStartupCatchUpScans() {
    for (const delay of STARTUP_CATCH_UP_DELAYS) {
      window.setTimeout(() => {
        scanInitialDocument();
        documentRoot?.setAttribute(
          'data-pangram-gallery-boot',
          'catch-up-scan-complete'
        );
      }, delay);
    }
  }

  function restoreAll() {
    document.querySelectorAll(`.${CARD_CLASS}`).forEach(disposeCard);
    document.querySelectorAll(`[${STATE_ATTRIBUTE}]`).forEach((target) => {
      target.classList.remove(HIDDEN_CLASS);
      target.removeAttribute(STATE_ATTRIBUTE);
    });
    document.querySelectorAll(`[${COMMENT_STATE_ATTRIBUTE}]`).forEach(
      restoreCommentTarget
    );
  }

  async function refreshSettings() {
    generation += 1;
    settings = await loadSettings();
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'settings-loaded');
    restoreAll();
    scheduleInitialScan();
  }

  function handleMutations(records) {
    removeOrphanedCardsFromRemovedSubtrees(records);
    if (settings.hidePromoted || settings.hideSuggested) {
      processCleanupTargets(
        settings.hidePromoted
          ? core.collectPromotedTargetsFromMutationRecords(records)
          : [],
        settings.hideSuggested
          ? core.collectSuggestedTargetsFromMutationRecords(records)
          : []
      );
    }
    processBadges(core.collectBadgesFromMutationRecords(records));
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-pangram-scanned'],
    characterData: true
  });
  documentRoot?.setAttribute('data-pangram-gallery-boot', 'ready');
  scheduleStartupCatchUpScans();

  chrome.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === 'sync') void refreshSettings();
  });

  void refreshSettings().catch((error) => {
    documentRoot?.setAttribute('data-pangram-gallery-boot', 'boot-error');
    console.error('De-Slop failed to start', error);
  });
})();
