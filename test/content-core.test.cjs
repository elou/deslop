const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCore() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'content-core.js'),
    'utf8'
  );
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.PangramGalleryCore;
}

test('reads only Pangram verdict labels', () => {
  const core = loadCore();

  assert.equal(core.classifyBadgeText(' AI '), 'ai');
  assert.equal(core.classifyBadgeText('Mixed'), 'mixed');
  assert.equal(core.classifyBadgeText('AI-Assisted'), 'ai-assisted');
  assert.equal(core.classifyBadgeText('Human'), 'human');
  assert.equal(core.classifyBadgeText('AI Product Designer'), null);
  assert.equal(core.classifyBadgeText(''), null);
});

test('parses the person whose activity caused a post to appear in the feed', () => {
  const core = loadCore();

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.parseFeedSourceContext('Charles L Mauro CHFP likes this'))),
    { name: 'Charles L Mauro CHFP', action: 'likes this' }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.parseFeedSourceContext('David Hoang commented'))),
    { name: 'David Hoang', action: 'commented' }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(core.parseFeedSourceContext('Priya Shah reposted this'))),
    { name: 'Priya Shah', action: 'reposted this' }
  );
  assert.equal(core.parseFeedSourceContext('Senior Design Director at Example'), null);
  assert.equal(core.parseFeedSourceContext('Acme Corp promoted this'), null);
});

test('matches only the native unfollow action for the exact feed-source actor', () => {
  const core = loadCore();

  assert.equal(
    core.isMatchingUnfollowLabel('Unfollow Charles L Mauro CHFP', 'Charles L Mauro CHFP'),
    true
  );
  assert.equal(
    core.isMatchingUnfollowLabel('Unfollow Matthew Holloway', 'Charles L Mauro CHFP'),
    false
  );
  assert.equal(core.isMatchingUnfollowLabel('Follow Charles L Mauro CHFP', 'Charles L Mauro CHFP'), false);
  assert.equal(core.isMatchingUnfollowLabel('Unfollow', ''), false);
});

test('formats the shared artwork and poetry metadata line without repeated details', () => {
  const core = loadCore();

  assert.equal(
    core.formatCardDetails({
      creator: 'Vincent van Gogh',
      date: '1889',
      location: 'Museum of Modern Art'
    }),
    'Vincent van Gogh · 1889 · Museum of Modern Art'
  );
  assert.equal(
    core.formatCardDetails({
      creator: 'Emily Dickinson',
      location: 'Emily Dickinson',
      provider: 'Freeverse'
    }),
    'Emily Dickinson'
  );
  assert.equal(
    core.formatCardDetails({
      creator: 'NASA',
      date: '2024-12-13T00:00:00Z',
      location: 'NASA · 2024-12-13'
    }),
    'NASA · 2024-12-13'
  );
});

test('keeps Painting Classics metadata compact when Wikimedia credit is raw catalogue prose', () => {
  const core = loadCore();

  assert.equal(
    core.formatCardDetails({
      provider: 'Painting Classics',
      creator: 'Pierre-Auguste Renoir',
      date: '1876-01-01',
      location:
        'The Yorck Project (2002) 10.000 Meisterwerke der Malerei (DVD-ROM), distributed by DIRECTMEDIA Publishing GmbH. ISBN: 3936122202.'
    }),
    'Pierre-Auguste Renoir · 1876'
  );
});

test('uses a concise provider fallback instead of raw credit or identifier-heavy metadata', () => {
  const core = loadCore();

  assert.equal(
    core.formatCardDetails({
      location: 'maderix/farsidecomics-blip-captions · ISBN 978-0-000000-00-0',
      credit: 'Dataset record 508_17 from a noncommercial research mirror',
      provider: 'Far Side (experimental)'
    }),
    'Far Side (experimental)'
  );
  assert.equal(
    core.formatCardDetails({
      creator: 'Unknown artist',
      location: 'Rijksmuseum Amsterdam'
    }),
    'Unknown artist · Rijksmuseum Amsterdam'
  );
  assert.equal(
    core.formatCardDetails({
      location: 'Record Plant, New York',
      provider: 'maderix/farsidecomics-blip-captions'
    }),
    'Record Plant, New York'
  );
  assert.equal(
    core.formatCardDetails({
      provider: 'maderix/farsidecomics-blip-captions'
    }),
    ''
  );
});

test('replaces every visible comment word with one clown while preserving whitespace', () => {
  const core = loadCore();

  assert.equal(core.clownifyText('This is AI.'), '🤡 🤡 🤡');
  assert.equal(core.clownifyText('Two\nlines\tremain'), '🤡\n🤡\t🤡');
  assert.equal(core.clownifyText(''), '');
  assert.equal(core.clownifyText(null), '');
});

test('defaults to AI-only replacement', () => {
  const core = loadCore();
  const settings = core.normalizeSettings();

  assert.equal(settings.enabled, true);
  assert.equal(settings.replaceMixed, false);
  assert.equal(settings.replaceAssisted, false);
  assert.equal(settings.hidePromoted, false);
  assert.equal(settings.styleMode, 'same');
  assert.deepEqual(JSON.parse(JSON.stringify(settings.streams)), {
    ai: 'painting-classics',
    mixed: 'painting-classics',
    assisted: 'painting-classics',
    promoted: 'hide-promoted',
    suggested: 'hide-suggested'
  });
  assert.equal(core.shouldReplace('ai', settings), true);
  assert.equal(core.shouldReplace('mixed', settings), false);
  assert.equal(core.shouldReplace('ai-assisted', settings), false);
  assert.equal(core.shouldReplace('human', settings), false);
});

test('routes one shared stream or separate streams per verdict', () => {
  const core = loadCore();
  const shared = core.normalizeSettings({
    streams: {
      ai: 'classic-poetry',
      mixed: 'deep-space',
      assisted: 'art-2'
    }
  });
  const separate = core.normalizeSettings({
    styleMode: 'different',
    streams: {
      ai: 'classic-poetry',
      mixed: 'deep-space',
      assisted: 'art-2'
    }
  });

  assert.equal(core.getStreamForVerdict(shared, 'mixed'), 'classic-poetry');
  assert.equal(core.getStreamForVerdict(separate, 'ai'), 'classic-poetry');
  assert.equal(core.getStreamForVerdict(separate, 'mixed'), 'deep-space');
  assert.equal(core.getStreamForVerdict(shared, 'ai-assisted'), 'classic-poetry');
  assert.equal(core.getStreamForVerdict(separate, 'ai-assisted'), 'art-2');
});

test('falls back to Painting Classics for unknown stream choices', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({
    styleMode: 'surprise',
    streams: { ai: 'unknown', mixed: 'newyorker-cartoons' }
  });

  assert.equal(settings.styleMode, 'same');
  assert.equal(settings.streams.ai, 'painting-classics');
  assert.equal(settings.streams.mixed, 'newyorker-cartoons');
});

test('can opt into Mixed verdicts', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({
    replaceMixed: true
  });

  assert.equal(core.shouldReplace('mixed', settings), true);
});

test('can opt into AI-Assisted verdicts', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ replaceAssisted: true });

  assert.equal(core.shouldReplace('ai-assisted', settings), true);
});

test('can opt into hiding promoted impressions with a separate stream', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({
    hidePromoted: true,
    streams: { promoted: 'hide-promoted' }
  });

  assert.equal(settings.hidePromoted, true);
  assert.equal(core.getStreamForCleanup(settings, 'promoted'), 'hide-promoted');
  assert.equal(
    core.isPromotedTarget({
      matches: (selector) => selector.startsWith('.feed-shared-update-v2--promoted'),
      closest: () => ({})
    }),
    true
  );
});

test('can opt into hiding explicit Suggested impressions with a separate stream', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({
    hideSuggested: true,
    streams: { suggested: 'hide-suggested' }
  });

  assert.equal(settings.hideSuggested, true);
  assert.equal(core.getStreamForCleanup(settings, 'suggested'), 'hide-suggested');
  assert.equal(
    core.isSuggestedTarget({
      matches: () => false,
      querySelectorAll: (selector) =>
        selector.includes('update-components-header__text-view')
          ? [{ textContent: 'Suggested' }]
          : []
    }),
    true
  );
});

test('does not treat a Featured/profile wrapper as a promoted impression', () => {
  const core = loadCore();
  const featuredItem = {
    matches: (selector) => selector.startsWith('.fie-impression-container'),
    querySelectorAll: () => []
  };

  assert.equal(core.isPromotedTarget(featuredItem), false);
});

test('recognizes explicit promoted markers and LinkedIn disclosure text', () => {
  const core = loadCore();
  assert.equal(
    core.isPromotedTarget({
      matches: (selector) => selector.startsWith('.feed-shared-update-v2--promoted'),
      querySelectorAll: () => []
    }),
    true
  );

  const disclosure = { textContent: 'Promoted · Partnership with Intuit' };
  assert.equal(
    core.isPromotedTarget({
      matches: () => false,
      querySelectorAll: (selector) =>
        selector.includes('feed-shared-actor__sub-description') ? [disclosure] : []
    }),
    true
  );
});

test('treats LinkedIn Learning popular-course cards as promoted', () => {
  const core = loadCore();
  const courseHeader = { textContent: 'Popular course on LinkedIn Learning' };
  const editorialHeader = { textContent: 'Popular post on LinkedIn' };

  assert.equal(
    core.isPromotedTarget({
      matches: () => false,
      querySelectorAll: (selector) =>
        selector.includes('update-components-header__text-view') ? [courseHeader] : []
    }),
    true
  );
  assert.equal(
    core.isPromotedTarget({
      matches: () => false,
      querySelectorAll: (selector) =>
        selector.includes('update-components-header__text-view') ? [editorialHeader] : []
    }),
    false
  );
});

test('does not assign a nested LinkedIn Learning course header to an outer feed item', () => {
  const core = loadCore();
  const inner = { matches: () => false, querySelectorAll: () => [] };
  const courseHeader = {
    textContent: 'Popular course on LinkedIn Learning',
    closest: () => inner
  };
  const outer = {
    matches: () => false,
    querySelectorAll: (selector) =>
      selector.includes('update-components-header__text-view') ? [courseHeader] : []
  };

  assert.equal(core.isPromotedTarget(outer), false);
});

test('does not assign a nested promoted disclosure to an outer feed item', () => {
  const core = loadCore();
  const inner = { matches: () => false, querySelectorAll: () => [] };
  const disclosure = {
    textContent: 'Promoted',
    closest: () => inner
  };
  const outer = {
    matches: () => false,
    querySelectorAll: () => [disclosure]
  };

  assert.equal(core.isPromotedTarget(outer), false);
});

test('does not infer Suggested from generic content or a nested feed item', () => {
  const core = loadCore();
  const inner = { matches: () => false, querySelectorAll: () => [] };
  const nestedSuggested = { textContent: 'Suggested', closest: () => inner };
  const outer = {
    matches: () => false,
    querySelectorAll: () => [nestedSuggested]
  };

  assert.equal(core.isSuggestedTarget(outer), false);
  assert.equal(
    core.isSuggestedTarget({ matches: () => false, querySelectorAll: () => [{ textContent: 'Suggested for you' }] }),
    false
  );
});

test('does not rescan a mutation parent when a replacement card mounts', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'content-core.js'),
    'utf8'
  );
  const start = source.indexOf('function collectPromotedTargetsFromMutationRecords');
  const end = source.indexOf('\n  function collectBadgesFromMutationRecords', start);
  const functionSource = source.slice(start, end);

  assert.doesNotMatch(functionSource, /roots\.add\(record\?\.target\)/);
  assert.match(functionSource, /const owner = getFeedOwner\(record\?\.target\)/);
});

test('legacy disabled settings cannot turn replacement off', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ enabled: false, replaceMixed: true });

  assert.equal(settings.enabled, true);
  assert.equal(core.shouldReplace('ai', settings), true);
  assert.equal(core.shouldReplace('mixed', settings), true);
  assert.equal(core.shouldReplace('ai-assisted', settings), false);
});

test('collects Pangram badges only from added mutation subtrees', () => {
  const core = loadCore();
  const nestedBadge = { id: 'nested-badge' };
  const unrelatedNode = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: () => []
  };
  const pangramSubtree = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: (selector) =>
      selector === '.pangram-feed-badge' ? [nestedBadge] : []
  };

  const badges = core.collectBadgesFromMutationRecords([
    { target: unrelatedNode, addedNodes: [unrelatedNode] },
    { target: unrelatedNode, addedNodes: [pangramSubtree] }
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(badges)),
    [{ id: 'nested-badge' }]
  );
});

test('identifies cards whose original feed item was removed', () => {
  const core = loadCore();

  assert.equal(
    core.isOrphanedCard({ pangramGalleryTarget: { isConnected: false } }),
    true
  );
  assert.equal(
    core.isOrphanedCard({ pangramGalleryTarget: { isConnected: true } }),
    false
  );
});

test('collects a badge when Pangram adds its verdict text after the badge shell', () => {
  const core = loadCore();
  const badge = {
    nodeType: 1,
    id: 'late-verdict',
    matches: (selector) => selector === '.pangram-feed-badge'
  };

  const badges = core.collectBadgesFromMutationRecords([
    { target: badge, addedNodes: [{ nodeType: 3 }] }
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(badges)),
    [{ nodeType: 1, id: 'late-verdict' }]
  );
});

test('collects a suggested-post badge when its nested verdict text hydrates late', () => {
  const core = loadCore();
  const badge = {
    nodeType: 1,
    id: 'suggested-post-badge',
    matches: (selector) => selector === '.pangram-feed-badge'
  };
  const verdictLabel = {
    nodeType: 1,
    matches: () => false,
    closest: (selector) =>
      selector === '.pangram-feed-badge' ? badge : null
  };

  const badges = core.collectBadgesFromMutationRecords([
    { target: verdictLabel, addedNodes: [{ nodeType: 3 }] }
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(badges)),
    [{ nodeType: 1, id: 'suggested-post-badge' }]
  );
});

test('replaces the full feed item for a Pangram post badge', () => {
  const core = loadCore();
  const feedItem = { id: 'linkedin-feed-item' };
  const postHost = {
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"]'
        ? feedItem
        : null
  };
  const badge = {
    closest: (selector) => {
      if (selector === '[data-pangram-post-id]') return postHost;
      return null;
    }
  };

  assert.equal(core.findReplacementTarget(badge), feedItem);
});

test('replaces the full promoted impression for a Pangram badge', () => {
  const core = loadCore();
  const promotedImpression = { id: 'linkedin-promoted-impression' };
  const postHost = {
    closest: (selector) => {
      if (
        selector ===
        '.fie-impression-container, li[data-testid="carousel-child-container"]'
      ) {
        return promotedImpression;
      }
      return null;
    }
  };
  const badge = {
    closest: (selector) =>
      selector === '[data-pangram-post-id]' ? postHost : null
  };

  assert.equal(core.findReplacementTarget(badge), promotedImpression);
});

test('does not expand a comment-only Pangram badge to the surrounding feed item', () => {
  const core = loadCore();
  const scannedHost = {
    id: 'comment-host',
    closest: () => null
  };
  const badge = {
    closest: (selector) => {
      if (selector === '[data-pangram-scanned="true"]') return scannedHost;
      return null;
    }
  };

  assert.equal(core.findReplacementTarget(badge), scannedHost);
});

test('keeps an explicit Pangram comment boundary out of post replacement', () => {
  const core = loadCore();
  const feedItem = { id: 'human-linkedin-post' };
  const postHost = {
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"]'
        ? feedItem
        : null
  };
  const commentHost = { id: 'ai-linkedin-comment' };
  const badge = {
    closest: (selector) => {
      if (selector === '[data-pangram-comment]') return commentHost;
      if (selector === '[data-pangram-post-id]') return postHost;
      return null;
    }
  };

  assert.equal(core.findCommentTarget(badge), commentHost);
  assert.equal(core.findReplacementTarget(badge), null);
});
