(function installPangramGalleryCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    replaceMixed: false,
    providers: Object.freeze({
      met: true,
      artic: true
    })
  });

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
    const inputProviders =
      input.providers && typeof input.providers === 'object'
        ? input.providers
        : {};

    const providers = {
      met:
        typeof inputProviders.met === 'boolean'
          ? inputProviders.met
          : DEFAULT_SETTINGS.providers.met,
      artic:
        typeof inputProviders.artic === 'boolean'
          ? inputProviders.artic
          : DEFAULT_SETTINGS.providers.artic
    };

    if (!providers.met && !providers.artic) {
      providers.met = true;
    }

    return {
      enabled:
        typeof input.enabled === 'boolean'
          ? input.enabled
          : DEFAULT_SETTINGS.enabled,
      replaceMixed:
        typeof input.replaceMixed === 'boolean'
          ? input.replaceMixed
          : DEFAULT_SETTINGS.replaceMixed,
      providers
    };
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
      if (
        record?.target?.nodeType === 1 &&
        typeof record.target.matches === 'function' &&
        record.target.matches('.pangram-feed-badge')
      ) {
        badges.add(record.target);
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
        host.closest?.('article, [role="article"], [role="listitem"]') || host
      );
    }

    return host.closest?.('article, [role="article"]') || host;
  }

  root.PangramGalleryCore = Object.freeze({
    DEFAULT_SETTINGS,
    classifyBadgeText,
    normalizeSettings,
    shouldReplace,
    collectBadgesFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget
  });
})(globalThis);
