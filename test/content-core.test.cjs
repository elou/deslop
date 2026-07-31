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

test('replaces each visible comment word with one clown while preserving spacing', () => {
  const core = loadCore();

  assert.equal(core.clownifyText('This is AI.'), '🤡 🤡 🤡');
  assert.equal(core.clownifyText('Two\nlines'), '🤡\n🤡');
});

test('defaults to AI-only replacement', () => {
  const core = loadCore();
  const settings = core.normalizeSettings();

  assert.equal(settings.enabled, true);
  assert.equal(settings.replaceMixed, false);
  assert.equal(settings.replaceAssisted, false);
  assert.equal(settings.hidePromoted, false);
  assert.equal(settings.hideSuggested, false);
  assert.equal(settings.styleMode, 'same');
  assert.deepEqual(JSON.parse(JSON.stringify(settings.streams)), {
    ai: 'painting-classics',
    mixed: 'painting-classics',
    assisted: 'painting-classics'
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

test('can opt into hiding promoted impressions', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ hidePromoted: true });

  assert.equal(settings.hidePromoted, true);
  assert.equal(
    core.isPromotedTarget({
      matches: (selector) =>
        selector.startsWith('.feed-shared-update-v2--promoted')
    }),
    true
  );
});

test('does not treat a LinkedIn profile Featured item as promoted by its wrapper alone', () => {
  const core = loadCore();
  const featuredItem = {
    matches: (selector) => selector.startsWith('.fie-impression-container'),
    querySelectorAll: () => []
  };

  assert.equal(core.isPromotedTarget(featuredItem), false);
});

test('recognizes an explicit promoted marker without an actor disclosure', () => {
  const core = loadCore();
  const promotedItem = {
    matches: (selector) => selector.startsWith('.feed-shared-update-v2--promoted'),
    querySelectorAll: () => []
  };

  assert.equal(core.isPromotedTarget(promotedItem), true);
});

test('can opt into hiding suggested posts by their explicit LinkedIn header', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ hideSuggested: true });
  const suggestedHeader = { textContent: 'Suggested' };
  const feedItem = {
    querySelectorAll: (selector) =>
      selector === '.update-components-header__text-view, [data-testid="suggested-label"]'
        ? [suggestedHeader]
        : []
  };

  assert.equal(settings.hideSuggested, true);
  assert.equal(core.isSuggestedTarget(feedItem), true);
});

test('does not treat a recommendation module as a Suggested post', () => {
  const core = loadCore();
  const feedItem = {
    querySelectorAll: () => [{ textContent: 'Recommended for you' }]
  };

  assert.equal(core.isSuggestedTarget(feedItem), false);
});

test('recognizes a LinkedIn promoted label when the legacy impression wrapper is absent', () => {
  const core = loadCore();
  const promotedLabel = { textContent: 'Promoted' };
  const feedItem = {
    matches: () => false,
    querySelectorAll: (selector) =>
      selector ===
      '.feed-shared-actor__sub-description, .update-components-actor__sub-description, [data-testid="promotedIndicator"], [data-test-id="promoted-indicator"]'
        ? [promotedLabel]
        : []
  };

  assert.equal(core.isPromotedTarget(feedItem), true);
});

test('recognizes a LinkedIn partnership disclosure that starts with Promoted', () => {
  const core = loadCore();
  const promotedLabel = { textContent: 'Promoted · Partnership with Intuit' };
  const feedItem = {
    matches: () => false,
    querySelectorAll: (selector) =>
      selector ===
      '.feed-shared-actor__sub-description, .update-components-actor__sub-description, [data-testid="promotedIndicator"], [data-test-id="promoted-indicator"]'
        ? [promotedLabel]
        : []
  };

  assert.equal(core.isPromotedTarget(feedItem), true);
});

test('recognizes a current LinkedIn promoted paragraph with obfuscated classes', () => {
  const core = loadCore();
  const promotedLabel = { textContent: 'Promoted' };
  const feedItem = {
    matches: () => false,
    querySelectorAll: (selector) => (selector === 'p, span' ? [promotedLabel] : [])
  };

  assert.equal(core.isPromotedTarget(feedItem), true);
});

test('recognizes a current LinkedIn Suggested paragraph with obfuscated classes', () => {
  const core = loadCore();
  const suggestedLabel = { textContent: 'Suggested' };
  const feedItem = {
    querySelectorAll: (selector) => (selector === 'p, span' ? [suggestedLabel] : [])
  };

  assert.equal(core.isSuggestedTarget(feedItem), true);
});

test('collects an obfuscated promoted label from a Pangram-scanned feed context', () => {
  const core = loadCore();
  const feedItem = { id: 'live-promoted-post' };
  const scannedContext = {
    matches: () => false,
    querySelectorAll: (selector) =>
      selector === 'p, span' ? [promotedLabel] : []
  };
  const promotedLabel = {
    textContent: 'Promoted',
    matches: (selector) => selector === 'p, span',
    closest: (selector) => {
      if (selector === '[data-pangram-scanned="true"]') return scannedContext;
      if (selector.includes('[role="listitem"]')) return feedItem;
      return null;
    }
  };
  const documentRoot = {
    querySelectorAll: (selector) =>
      selector === '[data-pangram-scanned="true"]' ? [scannedContext] : []
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectPromotedTargets(documentRoot))),
    [{ id: 'live-promoted-post' }]
  );
});

test('collects an obfuscated Suggested label from a Pangram-scanned feed context', () => {
  const core = loadCore();
  const feedItem = { id: 'live-suggested-post' };
  const scannedContext = {
    matches: () => false,
    querySelectorAll: (selector) =>
      selector === 'p, span' ? [suggestedLabel] : []
  };
  const suggestedLabel = {
    textContent: 'Suggested',
    matches: (selector) => selector === 'p, span',
    closest: (selector) => {
      if (selector === '[data-pangram-scanned="true"]') return scannedContext;
      if (selector.includes('[role="listitem"]')) return feedItem;
      return null;
    }
  };
  const documentRoot = {
    querySelectorAll: (selector) =>
      selector === '[data-pangram-scanned="true"]' ? [scannedContext] : []
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectSuggestedTargets(documentRoot))),
    [{ id: 'live-suggested-post' }]
  );
});

test('collects a promoted post when Pangram marks an existing host as scanned', () => {
  const core = loadCore();
  const feedItem = { id: 'late-scanned-promoted-post' };
  const scannedContext = {
    nodeType: 1,
    matches: (selector) => selector === '[data-pangram-scanned="true"]',
    closest: () => null,
    querySelectorAll: (selector) =>
      selector === 'p, span' ? [promotedLabel] : []
  };
  const promotedLabel = {
    textContent: 'Promoted',
    matches: (selector) => selector === 'p, span',
    closest: (selector) => {
      if (selector === '[data-pangram-scanned="true"]') return scannedContext;
      if (selector.includes('[role="listitem"]')) return feedItem;
      return null;
    }
  };

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        core.collectPromotedTargetsFromMutationRecords([
          {
            type: 'attributes',
            attributeName: 'data-pangram-scanned',
            target: scannedContext,
            addedNodes: []
          }
        ])
      )
    ),
    [{ id: 'late-scanned-promoted-post' }]
  );
});

test('disabled mode never replaces a verdict', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ enabled: false, replaceMixed: true });

  assert.equal(core.shouldReplace('ai', settings), false);
  assert.equal(core.shouldReplace('mixed', settings), false);
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

test('collects promoted impressions from appended feed subtrees', () => {
  const core = loadCore();
  const promoted = { id: 'promoted' };
  const promotedLabel = {
    nodeType: 1,
    textContent: 'Promoted',
    matches: (selector) => selector.includes('.feed-shared-actor__sub-description'),
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"], .fie-impression-container, li[data-testid="carousel-child-container"]'
        ? promoted
        : null
  };
  let mutationTargetDescents = 0;
  const mutationTarget = {
    nodeType: 1,
    matches: () => false,
    closest: () => null,
    querySelectorAll: () => {
      mutationTargetDescents += 1;
      return [];
    }
  };
  const subtree = {
    nodeType: 1,
    matches: () => false,
    closest: () => null,
    querySelectorAll: (selector) =>
      selector.includes('.feed-shared-actor__sub-description')
        ? [promotedLabel]
        : []
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectPromotedTargetsFromMutationRecords([
      { target: mutationTarget, addedNodes: [subtree] }
    ]))),
    [{ id: 'promoted' }]
  );
  assert.equal(
    mutationTargetDescents,
    0,
    'an existing mutation target must not be descended'
  );
});

test('collects a promoted post when its disclosure text hydrates late', () => {
  const core = loadCore();
  const feedItem = { id: 'late-promoted-post' };
  const promotedLabel = {
    nodeType: 1,
    textContent: 'Promoted · Partnership with Intuit',
    matches: (selector) => selector.includes('.feed-shared-actor__sub-description'),
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"], .fie-impression-container, li[data-testid="carousel-child-container"]'
        ? feedItem
        : null,
    querySelectorAll: () => {
      throw new Error('late-hydrated signal should not be descended');
    }
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectPromotedTargetsFromMutationRecords([
      { target: promotedLabel, addedNodes: [{ nodeType: 3 }] }
    ]))),
    [{ id: 'late-promoted-post' }]
  );
});

test('collects only the Suggested signal owner from appended subtrees', () => {
  const core = loadCore();
  const suggestedPost = { id: 'suggested-post' };
  const suggestedLabel = {
    nodeType: 1,
    textContent: 'Suggested',
    matches: (selector) => selector.includes('.update-components-header__text-view'),
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"], .fie-impression-container, li[data-testid="carousel-child-container"]'
        ? suggestedPost
        : null
  };
  const mutationTarget = {
    nodeType: 1,
    matches: () => false,
    closest: () => null,
    querySelectorAll: () => {
      throw new Error('an existing feed root must not be descended');
    }
  };
  const addedSubtree = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: (selector) =>
      selector.includes('.update-components-header__text-view')
        ? [suggestedLabel]
        : []
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectSuggestedTargetsFromMutationRecords([
      { target: mutationTarget, addedNodes: [addedSubtree] }
    ]))),
    [{ id: 'suggested-post' }]
  );
});

test('does not assign a nested promoted signal to an outer feed item', () => {
  const core = loadCore();
  const outerFeedItem = { id: 'outer-feed-item' };
  const innerFeedItem = { id: 'inner-feed-item' };
  const promotedLabel = {
    textContent: 'Promoted',
    matches: (selector) => selector.includes('.feed-shared-actor__sub-description'),
    closest: () => innerFeedItem
  };
  outerFeedItem.matches = () => false;
  outerFeedItem.querySelectorAll = () => [promotedLabel];
  innerFeedItem.matches = () => false;
  innerFeedItem.querySelectorAll = () => [promotedLabel];

  assert.equal(core.isPromotedTarget(outerFeedItem), false);
  assert.equal(core.isPromotedTarget(innerFeedItem), true);
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

test('collects a badge when Pangram updates an existing verdict text node', () => {
  const core = loadCore();
  const badge = {
    nodeType: 1,
    id: 'character-data-verdict',
    matches: (selector) => selector === '.pangram-feed-badge'
  };
  const wrapper = {
    nodeType: 1,
    matches: () => false,
    closest: (selector) =>
      selector === '.pangram-feed-badge' ? badge : null
  };
  const textNode = {
    nodeType: 3,
    parentElement: wrapper
  };

  const badges = core.collectBadgesFromMutationRecords([
    { type: 'characterData', target: textNode, addedNodes: [] }
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(badges)),
    [{ nodeType: 1, id: 'character-data-verdict' }]
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
      if (selector.startsWith('.fie-impression-container')) {
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

test('keeps a Pangram comment inside its comment boundary when it also has a post id', () => {
  const core = loadCore();
  const feedItem = { id: 'human-linkedin-post' };
  const commentHost = {
    id: 'ai-linkedin-comment',
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"]'
        ? feedItem
        : null
  };
  const postHost = {
    closest: (selector) =>
      selector === 'article, [role="article"], [role="listitem"]'
        ? feedItem
        : null
  };
  const badge = {
    closest: (selector) => {
      if (selector === '[data-pangram-comment]') return commentHost;
      if (selector === '[data-pangram-post-id]') return postHost;
      return null;
    }
  };

  assert.equal(core.findReplacementTarget(badge), commentHost);
  assert.equal(core.findCommentTarget(badge), commentHost);
});
