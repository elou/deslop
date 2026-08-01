(function installPangramGalleryHistory(root) {
  const STORAGE_KEY = 'pangramGalleryHistoryV1';
  const VERSION = 1;
  const MAX_SEEN_POST_KEYS = 2000;

  function cleanText(value, maxLength = 240) {
    return typeof value === 'string'
      ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
      : '';
  }

  function cleanCount(value) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  function cleanTimestamp(value) {
    const text = cleanText(value, 40);
    return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : '';
  }

  function canonicalProfileKey(value) {
    try {
      const url = new URL(value);
      if (url.hostname.toLocaleLowerCase() !== 'www.linkedin.com') return '';
      const match = url.pathname.match(/^\/in\/([^/]+)\/?$/i);
      const slug = cleanText(match?.[1], 120).toLocaleLowerCase();
      return slug ? `linkedin:in:${slug}` : '';
    } catch (_error) {
      return '';
    }
  }

  function canonicalProfileUrl(value) {
    const key = canonicalProfileKey(value);
    if (!key) return '';
    return `https://www.linkedin.com/in/${key.slice('linkedin:in:'.length)}/`;
  }

  function derivePostKey(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    const activitySources = [input.permalink, input.activityUrn];
    for (const source of activitySources) {
      const text = cleanText(source, 500);
      const activityId = text.match(/(?:activity:|activity-)(\d+)/i)?.[1];
      if (activityId) return `activity:${activityId}`;
    }

    const pangramPostId = cleanText(input.pangramPostId, 200);
    return pangramPostId ? `pangram:${pangramPostId}` : '';
  }

  function emptyReasons() {
    return { posted: 0, liked: 0, commented: 0, reposted: 0 };
  }

  function normalizeReasons(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      posted: cleanCount(input.posted),
      liked: cleanCount(input.liked),
      commented: cleanCount(input.commented),
      reposted: cleanCount(input.reposted)
    };
  }

  function normalizeActor(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    const profileUrl = canonicalProfileUrl(input.profileUrl);
    const name = cleanText(input.name, 120);
    if (!profileUrl || !name) return null;
    return {
      name,
      profileUrl,
      hiddenCount: cleanCount(input.hiddenCount),
      firstSeen: cleanTimestamp(input.firstSeen),
      lastSeen: cleanTimestamp(input.lastSeen),
      reasons: normalizeReasons(input.reasons)
    };
  }

  function normalizeHistory(value = {}) {
    const input = value && typeof value === 'object' ? value : {};
    const actors = {};
    if (input.actors && typeof input.actors === 'object') {
      for (const actorValue of Object.values(input.actors)) {
        const actor = normalizeActor(actorValue);
        const key = canonicalProfileKey(actor?.profileUrl);
        if (key) actors[key] = actor;
      }
    }
    const verdicts = input.verdicts && typeof input.verdicts === 'object'
      ? input.verdicts
      : {};
    const seenPostKeys = Array.isArray(input.seenPostKeys)
      ? [...new Set(input.seenPostKeys.map((key) => cleanText(key, 240)).filter(Boolean))]
          .slice(-MAX_SEEN_POST_KEYS)
      : [];
    return {
      version: VERSION,
      totalHidden: cleanCount(input.totalHidden),
      unattributedHidden: cleanCount(input.unattributedHidden),
      verdicts: {
        ai: cleanCount(verdicts.ai),
        mixed: cleanCount(verdicts.mixed),
        assisted: cleanCount(verdicts.assisted)
      },
      actors,
      seenPostKeys
    };
  }

  function reasonKey(action) {
    const normalized = cleanText(action, 40).toLocaleLowerCase();
    if (normalized === 'likes this') return 'liked';
    if (normalized === 'commented') return 'commented';
    if (normalized === 'reposted this' || normalized === 'reposted') return 'reposted';
    if (normalized === 'posted') return 'posted';
    return '';
  }

  function verdictKey(verdict) {
    if (verdict === 'ai') return 'ai';
    if (verdict === 'mixed') return 'mixed';
    if (verdict === 'ai-assisted') return 'assisted';
    return '';
  }

  function recordHiddenPost(historyValue, event = {}, options = {}) {
    const history = normalizeHistory(historyValue);
    const postKey = cleanText(event.postKey, 240);
    const verdict = verdictKey(event.verdict);
    if (!postKey || !verdict || history.seenPostKeys.includes(postKey)) return history;

    const seenAt = cleanTimestamp(event.seenAt) || new Date().toISOString();
    const maxSeenPostKeys = Math.max(
      1,
      cleanCount(options.maxSeenPostKeys) || MAX_SEEN_POST_KEYS
    );
    const next = {
      ...history,
      totalHidden: history.totalHidden + 1,
      verdicts: {
        ...history.verdicts,
        [verdict]: history.verdicts[verdict] + 1
      },
      actors: { ...history.actors },
      seenPostKeys: [...history.seenPostKeys, postKey].slice(-maxSeenPostKeys)
    };

    const actorValue = event.sourceActor;
    const actorKey = canonicalProfileKey(actorValue?.href);
    const actorName = cleanText(actorValue?.name, 120);
    const actorProfileUrl = canonicalProfileUrl(actorValue?.href);
    const actorReason = reasonKey(actorValue?.action);
    if (!actorKey || !actorName || !actorProfileUrl || !actorReason) {
      next.unattributedHidden += 1;
      return next;
    }

    const previous = next.actors[actorKey] || {
      name: actorName,
      profileUrl: actorProfileUrl,
      hiddenCount: 0,
      firstSeen: seenAt,
      lastSeen: seenAt,
      reasons: emptyReasons()
    };
    next.actors[actorKey] = {
      name: actorName,
      profileUrl: actorProfileUrl,
      hiddenCount: previous.hiddenCount + 1,
      firstSeen: previous.firstSeen && previous.firstSeen < seenAt
        ? previous.firstSeen
        : seenAt,
      lastSeen: previous.lastSeen && previous.lastSeen > seenAt
        ? previous.lastSeen
        : seenAt,
      reasons: {
        ...previous.reasons,
        [actorReason]: previous.reasons[actorReason] + 1
      }
    };
    return next;
  }

  function sortedActors(historyValue) {
    const history = normalizeHistory(historyValue);
    return Object.values(history.actors).sort(
      (left, right) =>
        right.hiddenCount - left.hiddenCount ||
        right.lastSeen.localeCompare(left.lastSeen) ||
        left.name.localeCompare(right.name)
    );
  }

  root.PangramGalleryHistory = Object.freeze({
    STORAGE_KEY,
    VERSION,
    MAX_SEEN_POST_KEYS,
    canonicalProfileKey,
    derivePostKey,
    normalizeHistory,
    recordHiddenPost,
    sortedActors
  });
})(globalThis);
