(function installPangramGalleryCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    replaceMixed: false,
    replaceAssisted: false,
    hidePromoted: false,
    hideSuggested: false,
    styleMode: 'same',
    streams: Object.freeze({
      ai: 'painting-classics',
      mixed: 'painting-classics',
      assisted: 'painting-classics'
    })
  });

  const STREAM_IDS = Object.freeze([
    'painting-classics',
    'art-2',
    'classic-poetry',
    'modern-art',
    'deep-space',
    'newyorker-latest',
    'newyorker-cartoons',
    'far-side',
    'garros-gallery',
    'surprise-me',
    'hide-ai'
  ]);

  const VERDICTS = new Map([
    ['ai', 'ai'],
    ['mixed', 'mixed'],
    ['ai-assisted', 'ai-assisted'],
    ['human', 'human']
  ]);

  function classifyBadgeText(value) {
    if (typeof value !== 'string') return null;
    return VERDICTS.get(value.trim().toLowerCase()) || null;
  }

  function normalizeSettings(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    const inputStreams =
      input.streams && typeof input.streams === 'object' ? input.streams : {};
    return {
      enabled:
        typeof input.enabled === 'boolean'
          ? input.enabled
          : DEFAULT_SETTINGS.enabled,
      replaceMixed:
        typeof input.replaceMixed === 'boolean'
          ? input.replaceMixed
          : DEFAULT_SETTINGS.replaceMixed,
      replaceAssisted:
        typeof input.replaceAssisted === 'boolean'
          ? input.replaceAssisted
          : DEFAULT_SETTINGS.replaceAssisted,
      hidePromoted:
        typeof input.hidePromoted === 'boolean'
          ? input.hidePromoted
          : DEFAULT_SETTINGS.hidePromoted,
      hideSuggested:
        typeof input.hideSuggested === 'boolean'
          ? input.hideSuggested
          : DEFAULT_SETTINGS.hideSuggested,
      styleMode: input.styleMode === 'different' ? 'different' : 'same',
      streams: {
        ai: STREAM_IDS.includes(inputStreams.ai)
          ? inputStreams.ai
          : DEFAULT_SETTINGS.streams.ai,
        mixed: STREAM_IDS.includes(inputStreams.mixed)
          ? inputStreams.mixed
          : DEFAULT_SETTINGS.streams.mixed,
        assisted: STREAM_IDS.includes(inputStreams.assisted)
          ? inputStreams.assisted
          : DEFAULT_SETTINGS.streams.assisted
      }
    };
  }

  function getStreamForVerdict(settingsValue, verdict) {
    const settings = normalizeSettings(settingsValue);
    if (settings.styleMode === 'same') return settings.streams.ai;
    if (verdict === 'mixed') return settings.streams.mixed;
    if (verdict === 'ai-assisted') return settings.streams.assisted;
    return settings.streams.ai;
  }

  function shouldReplace(verdict, settingsValue) {
    const settings = normalizeSettings(settingsValue);
    if (!settings.enabled) return false;
    if (verdict === 'ai') return true;
    if (verdict === 'mixed') return settings.replaceMixed;
    return verdict === 'ai-assisted' && settings.replaceAssisted;
  }

  function clownifyText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\S+/gu, '🤡');
  }

  // Profile Featured items also use LinkedIn's generic impression wrapper, so
  // that wrapper is a candidate for inspection rather than proof of promotion.
  // Only an explicit promoted marker or the actor disclosure may hide a post.
  const PROMOTED_MARKER_SELECTOR =
    '.feed-shared-update-v2--promoted, [data-promoted="true"]';
  const PROMOTED_LABEL_SELECTOR =
    '.feed-shared-actor__sub-description, .update-components-actor__sub-description, [data-testid="promotedIndicator"], [data-test-id="promoted-indicator"]';
  const SUGGESTED_LABEL_SELECTOR =
    '.update-components-header__text-view, [data-testid="suggested-label"]';
  const GENERIC_LABEL_SELECTOR = 'p, span';
  const SCANNED_FEED_CONTEXT_SELECTOR = '[data-pangram-scanned="true"]';
  const FEED_SIGNAL_OWNER_SELECTOR =
    'article, [role="article"], [role="listitem"], .fie-impression-container, li[data-testid="carousel-child-container"]';
  const PROMOTED_SIGNAL_SELECTOR =
    `${PROMOTED_MARKER_SELECTOR}, ${PROMOTED_LABEL_SELECTOR}`;

  function hasPromotedLabelText(signal) {
    return Boolean(
      signal?.textContent?.trim().toLowerCase().startsWith('promoted')
    );
  }

  function hasExactPromotedLabelText(signal) {
    return signal?.textContent?.trim().toLowerCase() === 'promoted';
  }

  function hasSuggestedLabelText(signal) {
    return signal?.textContent?.trim().toLowerCase() === 'suggested';
  }

  function isPromotedSignal(signal) {
    if (signal?.matches?.(PROMOTED_MARKER_SELECTOR)) return true;
    return Boolean(
      signal?.matches?.(PROMOTED_LABEL_SELECTOR) &&
      hasPromotedLabelText(signal)
    );
  }

  function isSuggestedSignal(signal) {
    return Boolean(
      signal?.matches?.(SUGGESTED_LABEL_SELECTOR) &&
      hasSuggestedLabelText(signal)
    );
  }

  function isGenericFeedSignal(signal, hasLabelText) {
    return Boolean(
      signal?.matches?.(GENERIC_LABEL_SELECTOR) &&
      hasLabelText(signal) &&
      signal.closest?.(SCANNED_FEED_CONTEXT_SELECTOR)
    );
  }

  function isGenericPromotedSignal(signal) {
    return isGenericFeedSignal(signal, hasExactPromotedLabelText);
  }

  function isGenericSuggestedSignal(signal) {
    return isGenericFeedSignal(signal, hasSuggestedLabelText);
  }

  function findSignalOwner(signal, isSignal) {
    if (!isSignal(signal)) return null;
    return signal.closest?.(FEED_SIGNAL_OWNER_SELECTOR) || null;
  }

  function isSignalOwnedByTarget(target, signal, isSignal) {
    if (!isSignal(signal)) return false;
    const owner = signal.closest?.(FEED_SIGNAL_OWNER_SELECTOR);
    // DOM signals always support closest(). The fallback keeps this predicate
    // usable with small DOM-like objects in consumers and tests.
    return owner ? owner === target : typeof signal.closest !== 'function';
  }

  function isPromotedTarget(target) {
    if (
      target?.matches?.(PROMOTED_MARKER_SELECTOR) &&
      (!target.closest || target.closest(FEED_SIGNAL_OWNER_SELECTOR) === target)
    ) {
      return true;
    }
    const explicitLabel = Array.from(
      target?.querySelectorAll?.(PROMOTED_LABEL_SELECTOR) || []
    ).some((label) =>
      isSignalOwnedByTarget(target, label, hasPromotedLabelText)
    );
    if (explicitLabel) return true;

    // LinkedIn also renders these disclosures with generated class names. In
    // that layout only an exact standalone label is accepted, so ordinary post
    // copy that happens to start with "Promoted" cannot hide the post.
    return Array.from(
      target?.querySelectorAll?.(GENERIC_LABEL_SELECTOR) || []
    ).some((label) =>
      isSignalOwnedByTarget(target, label, hasExactPromotedLabelText)
    );
  }

  function isSuggestedTarget(target) {
    const explicitLabel = Array.from(
      target?.querySelectorAll?.(SUGGESTED_LABEL_SELECTOR) || []
    ).some((label) =>
      isSignalOwnedByTarget(target, label, hasSuggestedLabelText)
    );
    if (explicitLabel) return true;

    return Array.from(
      target?.querySelectorAll?.(GENERIC_LABEL_SELECTOR) || []
    ).some((label) =>
      isSignalOwnedByTarget(target, label, hasSuggestedLabelText)
    );
  }

  function collectGenericSignalTargets(root, isSignal) {
    const targets = new Set();
    const collectSignal = (signal) => {
      const owner = findSignalOwner(signal, isSignal);
      if (owner) targets.add(owner);
    };
    const inspectScannedContext = (context) => {
      if (context?.matches?.(GENERIC_LABEL_SELECTOR)) collectSignal(context);
      context?.querySelectorAll?.(GENERIC_LABEL_SELECTOR).forEach(collectSignal);
    };

    // Do not search every paragraph in the page. Pangram's scanned boundaries
    // provide a small, feed-only set of contexts for LinkedIn's classless labels.
    if (root?.nodeType === 1 && root.matches?.(SCANNED_FEED_CONTEXT_SELECTOR)) {
      inspectScannedContext(root);
    }
    root
      ?.querySelectorAll?.(SCANNED_FEED_CONTEXT_SELECTOR)
      .forEach(inspectScannedContext);
    return [...targets];
  }

  function collectSignalTargets(root, signalSelector, isSignal) {
    const targets = new Set();
    const collectSignal = (signal) => {
      const owner = findSignalOwner(signal, isSignal);
      if (owner) targets.add(owner);
    };

    if (root?.nodeType === 1 && root.matches?.(signalSelector)) {
      collectSignal(root);
    }
    root?.querySelectorAll?.(signalSelector).forEach(collectSignal);
    return [...targets];
  }

  function collectSignalTargetsFromMutationRecords(
    records,
    signalSelector,
    isSignal
  ) {
    const targets = new Set();
    const collectSignal = (signal) => {
      const owner = findSignalOwner(signal, isSignal);
      if (owner) targets.add(owner);
    };
    const inspectMutationTarget = (node) => {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (!element) return;
      if (element.matches?.(signalSelector)) {
        collectSignal(element);
        return;
      }
      const signal = element.closest?.(signalSelector);
      if (signal) collectSignal(signal);
    };
    const inspectAddedSubtree = (node) => {
      if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return;
      if (node.nodeType === 1 && node.matches?.(signalSelector)) {
        collectSignal(node);
      }
      node.querySelectorAll?.(signalSelector).forEach(collectSignal);
    };

    for (const record of records || []) {
      // Character data can hydrate an existing signal. Inspect its ancestor
      // chain, but never descend the existing mutation target's subtree.
      inspectMutationTarget(record?.target);
      for (const node of record?.addedNodes || []) inspectAddedSubtree(node);
    }
    return [...targets];
  }

  function collectGenericSignalTargetsFromMutationRecords(records, isSignal) {
    const targets = new Set();
    const collectSignal = (signal) => {
      const owner = findSignalOwner(signal, isSignal);
      if (owner) targets.add(owner);
    };
    const inspectMutationTarget = (node) => {
      const element = node?.nodeType === 1 ? node : node?.parentElement;
      if (!element) return;
      if (element.matches?.(GENERIC_LABEL_SELECTOR)) {
        collectSignal(element);
        return;
      }
      const signal = element.closest?.(GENERIC_LABEL_SELECTOR);
      if (signal) collectSignal(signal);
    };
    const inspectAddedSubtree = (node) => {
      if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return;
      if (node.nodeType === 1 && node.matches?.(GENERIC_LABEL_SELECTOR)) {
        collectSignal(node);
      }
      // Descend only newly added subtrees. Each candidate still has to live in
      // a Pangram-scanned feed context before it can produce a cleanup target.
      node.querySelectorAll?.(GENERIC_LABEL_SELECTOR).forEach(collectSignal);
    };

    for (const record of records || []) {
      inspectMutationTarget(record?.target);
      for (const node of record?.addedNodes || []) inspectAddedSubtree(node);
    }
    return [...targets];
  }

  function collectPromotedTargets(root) {
    return [
      ...new Set([
        ...collectSignalTargets(root, PROMOTED_SIGNAL_SELECTOR, isPromotedSignal),
        ...collectGenericSignalTargets(root, isGenericPromotedSignal)
      ])
    ];
  }

  function collectSuggestedTargets(root) {
    return [
      ...new Set([
        ...collectSignalTargets(root, SUGGESTED_LABEL_SELECTOR, isSuggestedSignal),
        ...collectGenericSignalTargets(root, isGenericSuggestedSignal)
      ])
    ];
  }

  function collectBadgesFromMutationRecords(records) {
    const badges = new Set();

    for (const record of records || []) {
      const target = record?.target;
      if (target?.nodeType === 1) {
        const badge =
          typeof target.matches === 'function' &&
          target.matches('.pangram-feed-badge')
            ? target
            : typeof target.closest === 'function'
              ? target.closest('.pangram-feed-badge')
              : null;
        if (badge) {
          badges.add(badge);
        }
      }

      for (const node of record.addedNodes || []) {
        if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) continue;

        if (node.nodeType === 1 && typeof node.matches === 'function' && node.matches('.pangram-feed-badge')) {
          badges.add(node);
        }

        if (typeof node.querySelectorAll !== 'function') continue;
        for (const badge of node.querySelectorAll('.pangram-feed-badge')) {
          badges.add(badge);
        }
      }
    }

    return [...badges];
  }

  function collectPromotedTargetsFromMutationRecords(records) {
    return [
      ...new Set([
        ...collectSignalTargetsFromMutationRecords(
          records,
          PROMOTED_SIGNAL_SELECTOR,
          isPromotedSignal
        ),
        ...collectGenericSignalTargetsFromMutationRecords(
          records,
          isGenericPromotedSignal
        )
      ])
    ];
  }

  function collectSuggestedTargetsFromMutationRecords(records) {
    return [
      ...new Set([
        ...collectSignalTargetsFromMutationRecords(
          records,
          SUGGESTED_LABEL_SELECTOR,
          isSuggestedSignal
        ),
        ...collectGenericSignalTargetsFromMutationRecords(
          records,
          isGenericSuggestedSignal
        )
      ])
    ];
  }

  function isOrphanedCard(card) {
    return Boolean(card?.pangramGalleryTarget && !card.pangramGalleryTarget.isConnected);
  }

  function findReplacementTarget(badge) {
    const commentHost = badge?.closest?.('[data-pangram-comment]');
    if (commentHost) return commentHost;

    const postHost = badge?.closest?.('[data-pangram-post-id]');
    const host =
      postHost || badge?.closest?.('[data-pangram-scanned="true"]');
    if (!host) return null;

    if (postHost) {
      return (
        host.closest?.(
          '.fie-impression-container, li[data-testid="carousel-child-container"]'
        ) ||
        host.closest?.('article, [role="article"], [role="listitem"]') ||
        host
      );
    }

    return host.closest?.('article, [role="article"]') || host;
  }

  function findCommentTarget(badge) {
    return badge?.closest?.('[data-pangram-comment]') || null;
  }

  root.PangramGalleryCore = Object.freeze({
    DEFAULT_SETTINGS,
    STREAM_IDS,
    classifyBadgeText,
    normalizeSettings,
    getStreamForVerdict,
    shouldReplace,
    clownifyText,
    isPromotedTarget,
    isSuggestedTarget,
    collectPromotedTargets,
    collectSuggestedTargets,
    collectBadgesFromMutationRecords,
    collectPromotedTargetsFromMutationRecords,
    collectSuggestedTargetsFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget,
    findCommentTarget
  });
})(globalThis);
