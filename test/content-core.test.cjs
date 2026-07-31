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

test('defaults to AI-only replacement', () => {
  const core = loadCore();
  const settings = core.normalizeSettings();

  assert.equal(settings.enabled, true);
  assert.equal(settings.replaceMixed, false);
  assert.equal(settings.replaceAssisted, false);
  assert.equal(settings.hidePromoted, undefined);
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

test('core QA baseline ignores a previously saved promoted setting', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({ hidePromoted: true });

  assert.equal(
    settings.hidePromoted,
    undefined,
    'cleanup is deliberately absent from the core replacement QA baseline'
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
