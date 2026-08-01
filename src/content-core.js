(function installPangramGalleryCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    replaceMixed: false,
    replaceAssisted: false,
    hidePromoted: false,
    hideSuggested: false,
    platforms: Object.freeze({
      linkedin: true,
      x: false
    }),
    styleMode: 'same',
    streams: Object.freeze({
      ai: 'painting-classics',
      mixed: 'painting-classics',
      assisted: 'painting-classics',
      promoted: 'hide-promoted',
      suggested: 'hide-suggested'
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
    'hide-promoted',
    'hide-suggested'
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

  function normalizeCardDetail(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  function parseFeedSourceContext(value) {
    const text = normalizeCardDetail(value);
    if (!text) return null;

    const actions = [
      { suffix: /\s+likes this$/i, action: 'likes this' },
      { suffix: /\s+commented$/i, action: 'commented' },
      { suffix: /\s+reposted(?: this)?$/i, action: 'reposted this' }
    ];
    for (const candidate of actions) {
      if (!candidate.suffix.test(text)) continue;
      const name = normalizeCardDetail(text.replace(candidate.suffix, ''));
      if (!name || name.length > 120) return null;
      return { name, action: candidate.action };
    }
    return null;
  }

  function isMatchingUnfollowLabel(value, sourceActorName) {
    const label = normalizeCardDetail(value).toLocaleLowerCase();
    const actor = normalizeCardDetail(sourceActorName).toLocaleLowerCase();
    return Boolean(actor && label === `unfollow ${actor}`);
  }

  function formatCardDate(value) {
    return /^\d{4}-01-01(?:T00:00:00(?:\.000)?Z?)?$/.test(value)
      ? value.slice(0, 4)
      : value;
  }

  function isRawAttribution(value) {
    return /\b(?:isbn(?:-1[03])?|issn|catalog(?:ue)?|credit|courtesy|copyright|distributed by|dvd-rom|dataset|mirror|corpus|wikimedia(?: commons)?|wikidata)\b|\brecord\s*(?:#|no\.?|id)?\s*[\w-]*\d[\w-]*\b|(?:\b[\w.-]+\/)+[\w.-]+\b/i.test(
      value
    );
  }

  function formatCardDetails(item = {}) {
    const location = normalizeCardDetail(item.location);
    const cleanLocation = isRawAttribution(location) ? '' : location;
    const locationKey = cleanLocation.toLowerCase();
    const creator = normalizeCardDetail(item.creator);
    const date = formatCardDate(normalizeCardDetail(item.date));
    const dateKey = date.slice(0, 10).toLowerCase();
    const details = [];

    if (creator && !locationKey.includes(creator.toLowerCase())) details.push(creator);
    if (date && (!dateKey || !locationKey.includes(dateKey))) details.push(date);
    if (cleanLocation) details.push(cleanLocation);

    return (
      details.join(' · ') ||
      (isRawAttribution(normalizeCardDetail(item.credit))
        ? ''
        : normalizeCardDetail(item.credit)) ||
      (isRawAttribution(normalizeCardDetail(item.provider))
        ? ''
        : normalizeCardDetail(item.provider))
    );
  }

  function normalizeSettings(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    const inputStreams =
      input.streams && typeof input.streams === 'object' ? input.streams : {};
    const inputPlatforms =
      input.platforms && typeof input.platforms === 'object' ? input.platforms : {};
    return {
      // Replacement is always on; the former global switch is intentionally
      // ignored so an old saved `enabled: false` value cannot disable the UI.
      enabled: true,
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
      platforms: {
        linkedin:
          typeof inputPlatforms.linkedin === 'boolean'
            ? inputPlatforms.linkedin
            : DEFAULT_SETTINGS.platforms.linkedin,
        x:
          typeof inputPlatforms.x === 'boolean'
            ? inputPlatforms.x
            : DEFAULT_SETTINGS.platforms.x
      },
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
          : DEFAULT_SETTINGS.streams.promoted,
        suggested: STREAM_IDS.includes(inputStreams.suggested)
          ? inputStreams.suggested
          : DEFAULT_SETTINGS.streams.suggested
      }
    };
  }

  function isPlatformEnabled(settingsValue, hostnameValue) {
    const settings = normalizeSettings(settingsValue);
    const hostname = String(hostnameValue || '').trim().toLocaleLowerCase();
    if (/(^|\.)linkedin\.com$/.test(hostname)) return settings.platforms.linkedin;
    if (/(^|\.)x\.com$/.test(hostname)) return settings.platforms.x;
    return false;
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
      : cleanupType === 'suggested'
        ? settings.streams.suggested
        : 'painting-classics';
  }

  const FEED_OWNER_SELECTOR =
    '.fie-impression-container, li[data-testid="carousel-child-container"], article, [role="article"], [role="listitem"]';
  const PROMOTED_MARKER_SELECTOR =
    '.feed-shared-update-v2--promoted, [data-promoted="true"]';
  const PROMOTED_LABEL_SELECTOR =
    '.feed-shared-actor__sub-description, .update-components-actor__sub-description, [data-testid="promotedIndicator"], [data-test-id="promoted-indicator"]';
  const SUGGESTED_LABEL_SELECTOR =
    '.update-components-header__text-view, [data-testid="suggested-label"]';

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

  function isSuggestedTarget(target) {
    if (!target || typeof target.matches !== 'function') return false;
    for (const label of target.querySelectorAll?.(SUGGESTED_LABEL_SELECTOR) || []) {
      const owner = getFeedOwner(label);
      if (owner && owner !== target) continue;
      if ((label.textContent || '').trim().toLowerCase() === 'suggested') return true;
    }
    for (const label of target.querySelectorAll?.('p, span') || []) {
      const owner = getFeedOwner(label);
      if (owner && owner !== target) continue;
      if ((label.textContent || '').trim().toLowerCase() === 'suggested') return true;
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

  function collectSuggestedTargets(rootNode) {
    const candidates = new Set();
    const root = rootNode?.nodeType === 9 ? rootNode.documentElement : rootNode;
    if (!root) return [];
    if (root.nodeType === 1 && root.matches?.(FEED_OWNER_SELECTOR)) candidates.add(root);
    for (const element of root.querySelectorAll?.(FEED_OWNER_SELECTOR) || []) candidates.add(element);
    return [...candidates].filter(isSuggestedTarget);
  }

  function collectLinkedInSidebarTargets(rootNode) {
    const root = rootNode?.nodeType === 9 ? rootNode : rootNode?.ownerDocument || rootNode;
    if (!root?.querySelector) return [];
    const targets = new Set();
    const menuAnchors = [
      'a[href*="/me/profile-views/"]',
      'a[href*="/premium/my-premium/"]',
      'a[href*="/company/"][href*="/admin/"]'
    ];
    for (const selector of menuAnchors) {
      const menu = root.querySelector(selector)?.closest?.('[role="menu"]');
      const visualShell = menu?.parentElement?.parentElement || menu;
      if (visualShell) targets.add(visualShell);
    }

    const newsAnchor = root.querySelector('a[href*="/news/story/"]');
    let candidate = newsAnchor?.parentElement || null;
    while (candidate && candidate !== root.documentElement) {
      const newsLinks = candidate.querySelectorAll?.('a[href*="/news/story/"]') || [];
      const gameLink = candidate.querySelector?.('a[href*="/games/"]');
      if (newsLinks.length >= 2 && gameLink) {
        targets.add(candidate.parentElement || candidate);
        break;
      }
      candidate = candidate.parentElement;
    }

    return [...targets];
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

  function collectSuggestedTargetsFromMutationRecords(records) {
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
      for (const target of collectSuggestedTargets(root)) targets.add(target);
    }
    for (const owner of owners) if (isSuggestedTarget(owner)) targets.add(owner);
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
    parseFeedSourceContext,
    isMatchingUnfollowLabel,
    formatCardDetails,
    normalizeSettings,
    isPlatformEnabled,
    getStreamForVerdict,
    getStreamForCleanup,
    shouldReplace,
    collectBadgesFromMutationRecords,
    isOrphanedCard,
    findReplacementTarget,
    isPromotedTarget,
    collectPromotedTargets,
    collectPromotedTargetsFromMutationRecords,
    isSuggestedTarget,
    collectSuggestedTargets,
    collectSuggestedTargetsFromMutationRecords,
    collectLinkedInSidebarTargets
  });
})(globalThis);
