(function installPangramGalleryCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    replaceMixed: false,
    replaceAssisted: false,
    hidePromoted: false,
    styleMode: 'same',
    streams: Object.freeze({
      ai: 'painting-classics',
      mixed: 'painting-classics',
      assisted: 'painting-classics',
      promoted: 'hide-promoted'
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
    'hide-ai',
    'hide-promoted'
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
          : DEFAULT_SETTINGS.streams.assisted,
        promoted: STREAM_IDS.includes(inputStreams.promoted)
          ? inputStreams.promoted
          : DEFAULT_SETTINGS.streams.promoted
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

  function getStreamForCleanup(settingsValue, cleanupType) {
    const settings = normalizeSettings(settingsValue);
    return cleanupType === 'promoted'
      ? settings.streams.promoted
      : 'painting-classics';
  }

  const FEED_OWNER_SELECTOR =
    '.fie-impression-container, li[data-testid="carousel-child-container"], article, [role="article"], [role="listitem"]';
  const PROMOTED_MARKER_SELECTOR =
    '.feed-shared-update-v2--promoted, [data-promoted="true"]';
  const PROMOTED_LABEL_SELECTOR =
    '.feed-shared-actor__sub-description, .update-components-actor__sub-description, [data-testid="promotedIndicator"], [data-test-id="promoted-indicator"]';

  function getFeedOwner(node) {
    return node?.closest?.(FEED_OWNER_SELECTOR) || null;
  }

  function isPromotedTarget(target) {
    if (!target || typeof target.matches !== 'function') return false;
    if (target.matches(PROMOTED_MARKER_SELECTOR)) return true;

    for (const label of target.querySelectorAll?.(PROMOTED_LABEL_SELECTOR) || []) {
      const owner = getFeedOwner(label);
      if (owner && owner !== target) continue;
      if (/^promoted(?:\s|$|·)/i.test(label.textContent?.trim() || '')) return true;
    }

    // LinkedIn sometimes emits the label in a plain paragraph, without a
    // marker class. Restrict it to the exact label and this exact feed owner.
    for (const label of target.querySelectorAll?.('p, span') || []) {
      const owner = getFeedOwner(label);
      if (owner && owner !== target) continue;
      if ((label.textContent || '').trim().toLowerCase() === 'promoted') return true;
    }
    return false;
  }

  function collectPromotedTargets(rootNode) {
    const candidates = new Set();
    const root = rootNode?.nodeType === 9 ? rootNode.documentElement : rootNode;
    if (!root) return [];
    if (root.nodeType === 1 && root.matches?.(FEED_OWNER_SELECTOR)) candidates.add(root);
    for (const element of root.querySelectorAll?.(FEED_OWNER_SELECTOR) || []) candidates.add(element);
    return [...candidates].filter(isPromotedTarget);
  }

  function collectPromotedTargetsFromMutationRecords(records) {
    const roots = new Set();
    const owners = new Set();
    for (const record of records || []) {
      const owner = getFeedOwner(record?.target);
      if (owner) owners.add(owner);
      for (const node of record?.addedNodes || []) {
        if (node?.nodeType === 1 || node?.nodeType === 11) roots.add(node);
      }
    }
    const targets = new Set();
    for (const root of roots) {
      for (const target of collectPromotedTargets(root)) targets.add(target);
    }
    for (const owner of owners) if (isPromotedTarget(owner)) targets.add(owner);
    return [...targets];
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

  function isOrphanedCard(card) {
    return Boolean(card?.pangramGalleryTarget && !card.pangramGalleryTarget.isConnected);
  }

  function findReplacementTarget(badge) {
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

  root.PangramGalleryCore = Object.freeze({
    DEFAULT_SETTINGS,
    STREAM_IDS,
    classifyBadgeText,
    normalizeSettings,
    getStreamForVerdict,
    getStreamForCleanup,
    shouldReplace,
    collectBadgesFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget,
    isPromotedTarget,
    collectPromotedTargets,
    collectPromotedTargetsFromMutationRecords
  });
})(globalThis);
