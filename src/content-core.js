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

  // These are the LinkedIn impression containers Pangram already recognizes
  // as promoted. Keeping the selector here lets initial and infinite-scroll
  // scans share the same target contract.
  const PROMOTED_SELECTOR =
    '.fie-impression-container, li[data-testid="carousel-child-container"]';

  function isPromotedTarget(target) {
    return Boolean(target?.matches?.(PROMOTED_SELECTOR));
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
    const targets = new Set();
    const collect = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (node.matches?.(PROMOTED_SELECTOR)) targets.add(node);
      const ancestor = node.closest?.(PROMOTED_SELECTOR);
      if (ancestor) targets.add(ancestor);
      node.querySelectorAll?.(PROMOTED_SELECTOR).forEach((target) => {
        targets.add(target);
      });
    };

    for (const record of records || []) {
      collect(record?.target);
      for (const node of record?.addedNodes || []) collect(node);
    }
    return [...targets];
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
    shouldReplace,
    isPromotedTarget,
    collectBadgesFromMutationRecords,
    collectPromotedTargetsFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget
  });
})(globalThis);
