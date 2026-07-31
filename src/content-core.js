(function installPangramGalleryCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    replaceMixed: false,
    styleMode: 'same',
    streams: Object.freeze({
      ai: 'painting-classics',
      mixed: 'painting-classics'
    })
  });

  const STREAM_IDS = Object.freeze([
    'painting-classics',
    'classic-poetry',
    'modern-art',
    'deep-space',
    'newyorker-latest',
    'newyorker-cartoons'
  ]);

  const VERDICTS = new Map([
    ['ai', 'ai'],
    ['mixed', 'mixed'],
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
      styleMode: input.styleMode === 'different' ? 'different' : 'same',
      streams: {
        ai: STREAM_IDS.includes(inputStreams.ai)
          ? inputStreams.ai
          : DEFAULT_SETTINGS.streams.ai,
        mixed: STREAM_IDS.includes(inputStreams.mixed)
          ? inputStreams.mixed
          : DEFAULT_SETTINGS.streams.mixed
      }
    };
  }

  function getStreamForVerdict(settingsValue, verdict) {
    const settings = normalizeSettings(settingsValue);
    if (settings.styleMode === 'same') return settings.streams.ai;
    return verdict === 'mixed' ? settings.streams.mixed : settings.streams.ai;
  }

  function shouldReplace(verdict, settingsValue) {
    const settings = normalizeSettings(settingsValue);
    if (!settings.enabled) return false;
    if (verdict === 'ai') return true;
    return verdict === 'mixed' && settings.replaceMixed;
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
    shouldReplace,
    collectBadgesFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget
  });
})(globalThis);
