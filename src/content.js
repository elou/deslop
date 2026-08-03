(function startPangramGallery() {
  if (window.top !== window) return;

  const core = globalThis.PangramGalleryCore;
  const historyCore = globalThis.PangramGalleryHistory;
  if (!core || !globalThis.chrome?.runtime?.id) return;

  const CARD_CLASS = 'pangram-gallery-card';
  const HIDDEN_CLASS = 'pangram-gallery-original-hidden';
  const SIDEBAR_HIDDEN_CLASS = 'pangram-gallery-sidebar-hidden';
  const STATE_ATTRIBUTE = 'data-pangram-gallery-state';
  const COMMENT_STATE_ATTRIBUTE = 'data-pangram-gallery-comment-state';
  const COMMENT_ORIGINAL_CLASS = 'pangram-gallery-comment-original';
  const COMMENT_CLOWNS_CLASS = 'pangram-gallery-comment-clowns';
  const REPLACEMENT_RESPONSE_TTL_MS = 10 * 60 * 1000;
  const REPLACEMENT_RESPONSE_MAX_ENTRIES = 200;
  let settings = core.normalizeSettings();
  let scanTimer = null;
  let generation = 0;
  let historyWriteQueue = Promise.resolve();
  const replacementResponseCache = new Map();
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

  function replacementResponseKey(message) {
    const postKey = typeof message.postKey === 'string' ? message.postKey.trim() : '';
    return postKey
      ? `${postKey}\u0000${message.verdict || ''}\u0000${message.stream || ''}`
      : '';
  }

  function requestReplacement(message) {
    const key = replacementResponseKey(message);
    if (!key) return sendMessage(message);

    const now = Date.now();
    for (const [cachedKey, entry] of replacementResponseCache) {
      if (entry.expiresAt <= now) replacementResponseCache.delete(cachedKey);
    }
    const cached = replacementResponseCache.get(key);
    if (cached) return cached.promise;

    let pending;
    pending = sendMessage(message)
      .then((response) => {
        const entry = replacementResponseCache.get(key);
        if (!response?.ok || !response.item) {
          if (entry?.promise === pending) replacementResponseCache.delete(key);
          return response;
        }
        if (entry?.promise === pending) {
          entry.expiresAt = Date.now() + REPLACEMENT_RESPONSE_TTL_MS;
        }
        return response;
      })
      .catch((error) => {
        if (replacementResponseCache.get(key)?.promise === pending) {
          replacementResponseCache.delete(key);
        }
        throw error;
      });
    replacementResponseCache.set(key, { promise: pending, expiresAt: Infinity });
    while (replacementResponseCache.size > REPLACEMENT_RESPONSE_MAX_ENTRIES) {
      replacementResponseCache.delete(replacementResponseCache.keys().next().value);
    }
    return pending;
  }

  function invalidateReplacementResponse({ postKey, verdict, stream }) {
    const message = {
      type: 'PANGRAM_GALLERY_INVALIDATE_REPLACEMENT',
      postKey,
      verdict,
      stream
    };
    const key = replacementResponseKey(message);
    if (!key) return;
    replacementResponseCache.delete(key);
    void sendMessage(message).catch(() => undefined);
  }

  function readLocalHistory() {
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

  function writeLocalHistory(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [historyCore.STORAGE_KEY]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function createText(tag, className, value) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function getPostScope(target) {
    return target.querySelector?.('[data-pangram-post-id]') || target;
  }

  function getOpaquePostKey(target) {
    if (!historyCore || !target) return '';
    const scope = getPostScope(target);
    const pangramHost = scope.matches?.('[data-pangram-post-id]')
      ? scope
      : scope.querySelector?.('[data-pangram-post-id]');
    const activityHost = scope.matches?.('[data-urn*="activity:"]')
      ? scope
      : scope.querySelector?.('[data-urn*="activity:"]');
    return historyCore.derivePostKey({
      permalink: getOriginalPostPermalink(target),
      pangramPostId: pangramHost?.getAttribute('data-pangram-post-id'),
      activityUrn: activityHost?.getAttribute('data-urn')
    });
  }

  async function getReplacementPostKey(target) {
    const opaquePostKey = getOpaquePostKey(target);
    if (opaquePostKey) return opaquePostKey;

    const scope = getPostScope(target);
    const stableLinks = [...new Set(
      [...scope.querySelectorAll?.('a[href]') || []]
        .map((link) => {
          try {
            const url = new URL(link.href, window.location.origin);
            const platformPostLink = /(?:activity:|activity-|\/status\/)(\d+)/i.test(
              url.pathname
            );
            const externalLink = url.hostname !== window.location.hostname;
            const localContentLink =
              !/^\/(?:in|company|school|feed|mynetwork|jobs|messaging|notifications)(?:\/|$)/i
                .test(url.pathname) &&
              url.pathname !== '/';
            return platformPostLink || externalLink || localContentLink
              ? `${url.origin}${url.pathname}`
              : '';
          } catch (_error) {
            return '';
          }
        })
        .filter(Boolean)
    )]
      .sort()
      .slice(0, 20);
    const fingerprintText = stableLinks.length ? '' : cleanName(
      scope.innerText || scope.textContent
    )
      .replace(
        /\b\d+(?:[.,]\d+)?[kmb]?\s*(?:reactions?|likes?|comments?|reposts?|views?)\b/gi,
        ''
      )
      .replace(/\b\d+\s*(?:s|m|h|d|w|mo|y)\b/gi, '')
      .replace(/\b(?:see|show)?\s*more\b/gi, '')
      .trim()
      .slice(0, 512);
    const fingerprintSource = [
      window.location.hostname,
      stableLinks.join('\n'),
      fingerprintText
    ].join('\n');
    if (!fingerprintText && !stableLinks.length) return '';

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(fingerprintSource)
    );
    return `fingerprint:${[...new Uint8Array(digest)]
      .slice(0, 16)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  function getHistoryPostKey(card) {
    const target = card?.pangramGalleryTarget;
    return target ? getOpaquePostKey(target) : '';
  }

  function recordHiddenPangramPost(card, verdict) {
    if (!historyCore || !['ai', 'mixed', 'ai-assisted'].includes(verdict)) return;
    if (window.top !== window || !/(^|\.)linkedin\.com$/i.test(window.location.hostname)) return;

    card.pangramGalleryPermalink ||= getOriginalPostPermalink(card.pangramGalleryTarget);
    card.pangramGalleryAuthor ||= getOriginalPostAuthor(card.pangramGalleryTarget);
    card.pangramGallerySourceActor ||= getFeedSourceActor(
      card.pangramGalleryTarget,
      card.pangramGalleryAuthor,
      verdict
    );
    const postKey = getHistoryPostKey(card);
    if (!postKey) return;

    historyWriteQueue = historyWriteQueue.catch(() => {}).then(async () => {
      const current = await readLocalHistory();
      const next = historyCore.recordHiddenPost(current, {
        postKey,
        verdict,
        seenAt: new Date().toISOString(),
        sourceActor: card.pangramGallerySourceActor,
        originalAuthor: card.pangramGalleryAuthor
      });
      if (next.totalHidden === current.totalHidden) return;
      await writeLocalHistory(next);
    })
      .catch(() => {});
  }

  function cleanName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function isOriginalPostPermalink(value) {
    try {
      const url = new URL(value, window.location.origin);
      const isFeedUpdate = /^\/feed\/update\/urn:li:activity:\d+\/?$/.test(url.pathname);
      const isPostPage = /^\/posts\/[^/?#]*-activity-\d+(?:-[^/?#]+)?\/?$/.test(url.pathname);
      return (
        url.origin === window.location.origin &&
        url.href !== window.location.href &&
        (isFeedUpdate || isPostPage)
      );
    } catch (_error) {
      return false;
    }
  }

  function isOriginalAuthorProfile(value) {
    try {
      const url = new URL(value, window.location.origin);
      return (
        url.origin === window.location.origin &&
        url.href !== window.location.href &&
        /^\/(in|company|school)\//.test(url.pathname)
      );
    } catch (_error) {
      return false;
    }
  }

  function isPersonProfile(value) {
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin && /^\/in\//.test(url.pathname);
    } catch (_error) {
      return false;
    }
  }

  function getOriginalPostPermalink(target) {
    const scope = getPostScope(target);
    for (const link of scope.querySelectorAll('a[href]')) {
      if (isOriginalPostPermalink(link.href)) return link.href;
    }

    const activityUrn = scope
      .querySelector('[data-urn*="activity:"]')
      ?.getAttribute('data-urn')
      ?.match(/activity:(\d+)/)?.[1];
    return activityUrn ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityUrn}/` : '';
  }

  function getControlMenuAuthorName(scope) {
    const control = scope.querySelector(
      'button[aria-label^="Open control menu for post by "]'
    );
    const label = control?.getAttribute('aria-label') || '';
    return cleanName(label.replace(/^Open control menu for post by\s+/i, ''));
  }

  function getPangramAuthorHandle(scope) {
    const host = scope.matches?.('[data-pangram-author-handle]')
      ? scope
      : scope.querySelector?.('[data-pangram-author-handle]');
    return cleanName(host?.getAttribute?.('data-pangram-author-handle')).toLowerCase();
  }

  function getActorFallbackName(scope) {
    const actors = scope.querySelectorAll(
      '.update-components-actor, .feed-shared-actor, .update-components-actor__title, .feed-shared-actor__title'
    );
    for (const actor of actors) {
      if (
        actor.closest(
          '[role="comment"], .comments-comment-item, .comments-comment-social-activity'
        )
      ) {
        continue;
      }
      const title = actor.matches(
        '.update-components-actor__title, .feed-shared-actor__title'
      )
        ? actor
        : actor.querySelector('.update-components-actor__title, .feed-shared-actor__title');
      const name = cleanName(
        title?.querySelector('[aria-hidden="true"]')?.textContent || title?.textContent
      );
      if (!name || /^view:/i.test(name) || name.length > 120) continue;
      return name;
    }
    return '';
  }

  function getOriginalPostAuthor(target) {
    const scope = getPostScope(target);
    const name = getControlMenuAuthorName(scope) || getActorFallbackName(scope);
    if (!name) return null;

    const handle = getPangramAuthorHandle(scope);
    const normalizedName = name.toLowerCase();
    const candidates = [...scope.querySelectorAll('a[href]')]
      .filter((link) => isOriginalAuthorProfile(link.href))
      .map((link) => {
        const url = new URL(link.href, window.location.origin);
        const pathHandle = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '')
          .toLowerCase();
        const linkName = cleanName(link.textContent).toLowerCase();
        const score =
          (handle && pathHandle === handle ? 100 : 0) +
          (linkName === normalizedName || linkName.includes(normalizedName) ? 20 : 0) +
          (link.closest('.update-components-actor, .feed-shared-actor') ? 5 : 0);
        return { href: url.href, score };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score);

    return { name, href: candidates[0]?.href || '' };
  }

  function getFeedSourceActor(target, postAuthor, verdict) {
    if (['promoted', 'suggested', 'liked', 'commented'].includes(verdict)) return null;
    if (
      target.matches?.(
        '[role="comment"], .comments-comment-item, .comments-comment-social-activity'
      ) ||
      target.closest?.(
        '[role="comment"], .comments-comment-item, .comments-comment-social-activity'
      )
    ) {
      return null;
    }

    for (const link of target.querySelectorAll('a[href]')) {
      if (!isPersonProfile(link.href)) continue;
      if (
        link.closest(
          '[role="comment"], .comments-comment-item, .comments-comment-social-activity'
        )
      ) {
        continue;
      }

      const linkName = cleanName(
        link.querySelector?.('[aria-hidden="true"]')?.textContent || link.textContent
      );
      let context = link.parentElement;
      for (let depth = 0; context && context !== target && depth < 4; depth += 1) {
        const parsed = core.parseFeedSourceContext(context.textContent || '');
        if (parsed) {
          const parsedName = cleanName(parsed.name);
          const normalizedLinkName = linkName.toLocaleLowerCase();
          const normalizedParsedName = parsedName.toLocaleLowerCase();
          const namesAgree =
            normalizedLinkName &&
            (normalizedParsedName.includes(normalizedLinkName) ||
              normalizedLinkName.includes(normalizedParsedName));
          if (namesAgree) {
            return {
              name: linkName,
              href: new URL(link.href, window.location.origin).href,
              action: parsed.action
            };
          }
        }
        context = context.parentElement;
      }
    }

    if (postAuthor?.name && isPersonProfile(postAuthor.href)) {
      return { name: postAuthor.name, href: postAuthor.href, action: 'posted' };
    }
    return null;
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
    const verdictLabel = verdict === 'mixed'
      ? 'Mixed'
      : verdict === 'ai-assisted'
        ? 'AI-assisted'
        : verdict === 'promoted'
          ? 'Promoted'
            : verdict === 'suggested'
              ? 'Suggested'
              : verdict === 'liked'
                ? 'Like'
                : verdict === 'commented'
                  ? 'Comment'
            : 'AI';
    card.setAttribute('aria-label', `${verdictLabel} post replaced`);
    card.setAttribute('aria-busy', 'true');

    const image = document.createElement('img');
    image.className = 'pangram-gallery-card__image';
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.loading = 'lazy';

    const imageLink = document.createElement('a');
    imageLink.className = 'pangram-gallery-card__image-link';
    imageLink.target = '_blank';
    imageLink.rel = 'noreferrer';
    imageLink.hidden = true;
    imageLink.append(image);

    const poem = document.createElement('blockquote');
    poem.className = 'pangram-gallery-card__poem';
    poem.tabIndex = 0;
    poem.setAttribute('aria-label', 'Full poem');
    poem.hidden = true;

    const toggle = document.createElement('button');
    toggle.className = 'pangram-gallery-card__toggle';
    toggle.type = 'button';
    toggle.textContent = 'Show original';
    toggle.addEventListener('click', () => {
      const isHidden = target.classList.toggle(HIDDEN_CLASS);
      card.classList.toggle('pangram-gallery-card--original-visible', !isHidden);
      const hiddenLabel = card.classList.contains('pangram-gallery-card--notice')
        ? 'Unhide'
        : 'Show original';
      toggle.textContent = isHidden ? hiddenLabel : 'Hide original';
      toggle.setAttribute('aria-expanded', String(!isHidden));
    });
    toggle.setAttribute('aria-expanded', 'false');

    const imageFrame = document.createElement('div');
    imageFrame.className = 'pangram-gallery-card__image-frame';
    imageFrame.append(imageLink, poem);

    const imageStage = document.createElement('div');
    imageStage.className = 'pangram-gallery-card__image-stage';
    imageStage.append(imageFrame);

    const body = document.createElement('div');
    body.className = 'pangram-gallery-card__body';
    const notice = createText('p', 'pangram-gallery-card__notice', '');
    notice.hidden = true;
    const title = createText('a', 'pangram-gallery-card__title', '');
    title.target = '_blank';
    title.rel = 'noreferrer';
    const location = createText('p', 'pangram-gallery-card__location', '');
    body.append(notice, title, location, toggle);

    const source = document.createElement('span');
    source.className = 'pangram-gallery-card__source';
    const author = document.createElement('a');
    author.className = 'pangram-gallery-card__author';
    author.target = '_blank';
    author.rel = 'noreferrer';
    source.append(author);
    const verdictEmoji = verdict === 'suggested'
      ? '🫥'
      : verdict === 'promoted'
        ? '💸'
        : verdict === 'liked'
          ? '💔'
          : verdict === 'commented'
            ? '💬'
        : '🤖';
    const verdictChip = createText(
      'span',
      'pangram-gallery-card__verdict',
      `${verdictEmoji} ${verdictLabel}`
    );
    verdictChip.classList.add(`pangram-gallery-card__verdict--${verdict}`);
    verdictChip.setAttribute('aria-label', `Pangram verdict: ${verdictLabel}`);
    body.append(source, verdictChip);

    card.append(imageStage, body);

    image.addEventListener(
      'error',
      () => {
        // Removing src for offscreen cards is intentional, not a provider failure.
        if (image.dataset.pangramGalleryUnloaded === 'true' || !card.isConnected) return;
        invalidateReplacementResponse({
          postKey: card.pangramGalleryPostKey,
          verdict: card.pangramGalleryVerdict,
          stream: card.pangramGalleryStream
        });
        disposeCard(card);
        target.classList.remove(HIDDEN_CLASS);
        target.removeAttribute(STATE_ATTRIBUTE);
      }
    );

    card.pangramGalleryTarget = target;
    card.pangramGalleryPermalink = getOriginalPostPermalink(target);
    card.pangramGalleryAuthor = getOriginalPostAuthor(target);
    card.pangramGalleryVerdict = verdict;
    card.pangramGallerySourceActor = getFeedSourceActor(
      target,
      card.pangramGalleryAuthor,
      verdict
    );
    target.pangramGalleryCard = card;
    residencyObserver?.observe(card);

    return card;
  }

  function renderOriginalPostAuthor(card) {
    const source = card.querySelector('.pangram-gallery-card__source');
    const author = card.querySelector('.pangram-gallery-card__author');
    const postAuthor = card.pangramGalleryAuthor;
    if (!source || !author) return;

    source.hidden = false;
    source.textContent = postAuthor ? 'Original post by ' : 'Original post';
    author.textContent = '';
    author.removeAttribute('href');
    if (!postAuthor) return;
    const authorDestination = card.pangramGalleryPermalink || postAuthor.href;
    if (authorDestination) {
      author.href = authorDestination;
    } else {
      author.removeAttribute('href');
    }
    author.textContent = postAuthor.name;
    source.append(author);
  }

  function scheduleOriginalMetadataRefresh(card) {
    if (
      card.dataset.pangramGalleryMetadataRefresh ||
      (card.pangramGalleryPermalink && card.pangramGalleryAuthor?.href)
    ) {
      return;
    }
    card.dataset.pangramGalleryMetadataRefresh = 'scheduled';
    window.setTimeout(() => {
      const target = card.pangramGalleryTarget;
      if (!card.isConnected || !target?.isConnected || target.pangramGalleryCard !== card) return;
      card.pangramGalleryPermalink ||= getOriginalPostPermalink(target);
      const refreshedAuthor = getOriginalPostAuthor(target);
      if (refreshedAuthor?.name) card.pangramGalleryAuthor = refreshedAuthor;
      card.pangramGallerySourceActor ||= getFeedSourceActor(
        target,
        card.pangramGalleryAuthor,
        card.pangramGalleryVerdict
      );
      renderOriginalPostAuthor(card);
    }, 250);
  }

  function hydrateCard(card, item) {
    const image = card.querySelector('.pangram-gallery-card__image');
    const imageLink = card.querySelector('.pangram-gallery-card__image-link');
    const poem = card.querySelector('.pangram-gallery-card__poem');
    const title = card.querySelector('.pangram-gallery-card__title');
    const location = card.querySelector('.pangram-gallery-card__location');
    const source = card.querySelector('.pangram-gallery-card__source');
    const author = card.querySelector('.pangram-gallery-card__author');
    const verdictChip = card.querySelector('.pangram-gallery-card__verdict');
    const notice = card.querySelector('.pangram-gallery-card__notice');
    const toggle = card.querySelector('.pangram-gallery-card__toggle');
    if (!image || !imageLink || !poem || !title || !location || !source || !author || !verdictChip || !notice || !toggle) return false;

    if (item.kind === 'notice') {
      notice.textContent = item.title || '☢️ AI post hidden';
      notice.hidden = false;
      title.hidden = true;
      location.hidden = true;
      source.hidden = true;
      verdictChip.hidden = true;
      image.hidden = true;
      poem.hidden = true;
      toggle.textContent = 'Unhide';
      toggle.hidden = false;
      card.classList.add('pangram-gallery-card--notice');
    } else if (item.kind === 'poem') {
      const lines = Array.isArray(item.lines) ? item.lines : [];
      if (!lines.length) return false;
      poem.textContent = lines.join('\n');
      poem.setAttribute(
        'aria-label',
        item.title ? `${item.title}, full poem` : 'Full poem'
      );
      poem.hidden = false;
      card.classList.add('pangram-gallery-card--poem');
    } else {
      if (!item.assetUrl) return false;
      image.dataset.pangramGallerySrc = item.assetUrl;
      imageLink.href = item.sourceUrl;
      imageLink.hidden = false;
      image.alt = item.title
        ? `${item.title}${item.creator ? ` by ${item.creator}` : ''}`
        : 'Replacement image';
      image.removeAttribute('aria-hidden');
    }
    if (item.kind !== 'notice') {
      title.textContent = item.title;
      if (item.sourceUrl) {
        title.href = item.sourceUrl;
      } else {
        title.removeAttribute('href');
        title.removeAttribute('target');
        title.removeAttribute('rel');
      }
      location.textContent = core.formatCardDetails(item);
      renderOriginalPostAuthor(card);
      scheduleOriginalMetadataRefresh(card);
    }
    card.classList.remove('pangram-gallery-card--loading');
    card.removeAttribute('aria-busy');
    if (item.kind !== 'poem') restoreCardImage(image);
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

  async function replaceTarget(target, verdict, activeGeneration, stream) {
    if (target.getAttribute(STATE_ATTRIBUTE)) return;
    target.setAttribute(STATE_ATTRIBUTE, 'pending');
    const card = createCard(verdict, target);
    target.before(card);
    target.classList.add(HIDDEN_CLASS);

    try {
      const postKey = await getReplacementPostKey(target);
      const selectedStream = stream || core.getStreamForVerdict(settings, verdict);
      card.pangramGalleryPostKey = postKey;
      card.pangramGalleryStream = selectedStream;
      const response = await requestReplacement({
        type: 'PANGRAM_GALLERY_GET_REPLACEMENT',
        postKey,
        verdict,
        stream: selectedStream
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
      void recordHiddenPangramPost(card, verdict);
    } catch (_error) {
      disposeCard(card);
      target.classList.remove(HIDDEN_CLASS);
      target.removeAttribute(STATE_ATTRIBUTE);
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
    if (
      parent.closest?.(
        'script, style, noscript, template, svg, button, input, textarea, select, option, [contenteditable="true"]'
      )
    ) {
      return true;
    }
    return !root.contains(textNode);
  }

  function getCommentTreatmentRoot(commentTarget) {
    return commentTarget.querySelector?.('[data-pangram-text-id]') || null;
  }

  function getCommentClownText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const visibleText = [];
    let node = walker.nextNode();
    while (node) {
      if (!isCommentTextExcluded(node, root)) visibleText.push(node.textContent || '');
      node = walker.nextNode();
    }
    return core.clownifyText(visibleText.join(''));
  }

  function clownCommentTarget(commentTarget, badge) {
    restoreTarget(commentTarget);
    restoreCommentTarget(commentTarget);

    const root = getCommentTreatmentRoot(commentTarget, badge);
    if (!root) return;
    const clownText = getCommentClownText(root);
    if (!clownText.trim()) return;

    const clowns = document.createElement('span');
    clowns.className = COMMENT_CLOWNS_CLASS;
    clowns.setAttribute('aria-hidden', 'true');
    clowns.textContent = clownText;
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

      if (core.shouldReplace(verdict, settings)) {
        void replaceTarget(target, verdict, activeGeneration);
      } else {
        restoreTarget(target);
      }
    }
  }

  function reconcileChangedCommentTreatments(records) {
    const changedComments = new Set();
    for (const record of records || []) {
      const target =
        record?.target?.nodeType === 1
          ? record.target
          : record?.target?.parentElement || record?.target;
      if (target?.hasAttribute?.(COMMENT_STATE_ATTRIBUTE)) {
        changedComments.add(target);
        continue;
      }
      const commentTarget = target?.closest?.('[data-pangram-comment]');
      if (commentTarget?.hasAttribute?.(COMMENT_STATE_ATTRIBUTE)) {
        changedComments.add(commentTarget);
      }
    }

    for (const commentTarget of changedComments) {
      const replaceableBadge = [
        ...(commentTarget.querySelectorAll?.('.pangram-feed-badge') || [])
      ].find((badge) => {
        const verdict = core.classifyBadgeText(badge.textContent || '');
        return verdict && core.shouldReplace(verdict, settings);
      });
      if (!replaceableBadge) {
        restoreCommentTarget(commentTarget);
        continue;
      }

      const root = getCommentTreatmentRoot(commentTarget);
      const treatment = commentTarget.pangramGalleryCommentTreatment;
      if (!root || !treatment?.clowns || treatment.original !== root) {
        clownCommentTarget(commentTarget, replaceableBadge);
        continue;
      }

      const clownText = getCommentClownText(root);
      if (!clownText.trim()) {
        restoreCommentTarget(commentTarget);
      } else if (treatment.clowns.textContent !== clownText) {
        treatment.clowns.textContent = clownText;
      }
    }
  }

  function processPromotedTargets(targets) {
    if (!settings.hidePromoted) return;
    const activeGeneration = generation;
    for (const target of targets) {
      if (!target.isConnected) continue;
      void replaceTarget(
        target,
        'promoted',
        activeGeneration,
        core.getStreamForCleanup(settings, 'promoted')
      );
    }
  }

  function processSuggestedTargets(targets) {
    if (!settings.hideSuggested) return;
    const activeGeneration = generation;
    for (const target of targets) {
      if (!target.isConnected) continue;
      void replaceTarget(
        target,
        'suggested',
        activeGeneration,
        core.getStreamForCleanup(settings, 'suggested')
      );
    }
  }

  function processLikedTargets(targets) {
    if (!settings.hideLiked) return;
    const activeGeneration = generation;
    for (const target of targets) {
      if (!target.isConnected) continue;
      void replaceTarget(target, 'liked', activeGeneration, core.getStreamForCleanup(settings, 'liked'));
    }
  }

  function processCommentedTargets(targets) {
    if (!settings.hideCommented) return;
    const activeGeneration = generation;
    for (const target of targets) {
      if (!target.isConnected) continue;
      void replaceTarget(target, 'commented', activeGeneration, core.getStreamForCleanup(settings, 'commented'));
    }
  }

  function currentPlatformIsEnabled() {
    return core.isPlatformEnabled(settings, window.location.hostname);
  }

  function processLinkedInSidebarTargets() {
    if (!settings.platforms.linkedin || !/(^|\.)linkedin\.com$/i.test(window.location.hostname)) {
      return;
    }
    for (const target of core.collectLinkedInSidebarTargets(document)) {
      target.classList.add(SIDEBAR_HIDDEN_CLASS);
    }
  }

  function scanInitialDocument() {
    scanTimer = null;
    if (!core.isPlatformEnabled(settings, window.location.hostname)) return;
    processBadges(document.querySelectorAll('.pangram-feed-badge'));
    processPromotedTargets(core.collectPromotedTargets(document));
    processSuggestedTargets(core.collectSuggestedTargets(document));
    processLikedTargets(core.collectLikedTargets(document));
    processCommentedTargets(core.collectCommentedTargets(document));
    processLinkedInSidebarTargets();
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
    document.querySelectorAll(`.${SIDEBAR_HIDDEN_CLASS}`).forEach((target) => {
      target.classList.remove(SIDEBAR_HIDDEN_CLASS);
    });
    document.querySelectorAll(`[${COMMENT_STATE_ATTRIBUTE}]`).forEach(
      restoreCommentTarget
    );
  }

  async function refreshSettings() {
    generation += 1;
    settings = await loadSettings();
    restoreAll();
    scheduleInitialScan();
  }

  function handleMutations(records) {
    removeOrphanedCardsFromRemovedSubtrees(records);
    if (!currentPlatformIsEnabled()) return;
    processBadges(core.collectBadgesFromMutationRecords(records));
    reconcileChangedCommentTreatments(records);
    processPromotedTargets(core.collectPromotedTargetsFromMutationRecords(records));
    processSuggestedTargets(core.collectSuggestedTargetsFromMutationRecords(records));
    processLikedTargets(core.collectLikedTargetsFromMutationRecords(records));
    processCommentedTargets(core.collectCommentedTargetsFromMutationRecords(records));
    processLinkedInSidebarTargets();
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
