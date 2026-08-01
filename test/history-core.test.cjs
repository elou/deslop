const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadHistoryCore() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'history-core.js'),
    'utf8'
  );
  const context = { globalThis: {}, URL };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.PangramGalleryHistory;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('normalizes a privacy-contained empty history', () => {
  const history = loadHistoryCore();

  assert.deepEqual(plain(history.normalizeHistory()), {
    version: 1,
    totalHidden: 0,
    unattributedHidden: 0,
    verdicts: { ai: 0, mixed: 0, assisted: 0 },
    actors: {},
    seenPostKeys: []
  });
});

test('uses only canonical LinkedIn person profiles as roll-up keys', () => {
  const history = loadHistoryCore();

  assert.equal(
    history.canonicalProfileKey('https://www.linkedin.com/in/Emily-Campbell/?trk=feed'),
    'linkedin:in:emily-campbell'
  );
  assert.equal(history.canonicalProfileKey('https://www.linkedin.com/company/example/'), '');
  assert.equal(history.canonicalProfileKey('https://example.com/in/emily-campbell/'), '');
  assert.equal(history.canonicalProfileKey(''), '');
});

test('derives a stable opaque post key without storing post content', () => {
  const history = loadHistoryCore();

  assert.equal(
    history.derivePostKey({
      permalink: 'https://www.linkedin.com/feed/update/urn:li:activity:7489226303389216768/'
    }),
    'activity:7489226303389216768'
  );
  assert.equal(
    history.derivePostKey({
      permalink: 'https://www.linkedin.com/posts/example_activity-7489226303389216768-abcd/'
    }),
    'activity:7489226303389216768'
  );
  assert.equal(
    history.derivePostKey({ pangramPostId: 'urn:li:share:12345' }),
    'pangram:urn:li:share:12345'
  );
  assert.equal(history.derivePostKey({ activityUrn: 'urn:li:activity:999' }), 'activity:999');
  assert.equal(history.derivePostKey({}), '');
});

test('records a unique hidden post against the feed-source actor, not the original author', () => {
  const history = loadHistoryCore();
  const next = history.recordHiddenPost(undefined, {
    postKey: 'activity:123',
    verdict: 'ai',
    seenAt: '2026-08-01T18:00:00.000Z',
    sourceActor: {
      name: 'Charles L Mauro CHFP',
      href: 'https://www.linkedin.com/in/charleslmauro/',
      action: 'likes this'
    },
    originalAuthor: {
      name: 'Matthew Holloway',
      href: 'https://www.linkedin.com/in/matthewholloway/'
    }
  });

  assert.equal(next.totalHidden, 1);
  assert.equal(next.verdicts.ai, 1);
  assert.equal(next.unattributedHidden, 0);
  assert.deepEqual(plain(next.actors['linkedin:in:charleslmauro']), {
    name: 'Charles L Mauro CHFP',
    profileUrl: 'https://www.linkedin.com/in/charleslmauro/',
    hiddenCount: 1,
    firstSeen: '2026-08-01T18:00:00.000Z',
    lastSeen: '2026-08-01T18:00:00.000Z',
    reasons: { posted: 0, liked: 1, commented: 0, reposted: 0 }
  });
  assert.equal(next.actors['linkedin:in:matthewholloway'], undefined);
});

test('does not count the same opaque post key twice', () => {
  const history = loadHistoryCore();
  const event = {
    postKey: 'activity:123',
    verdict: 'mixed',
    seenAt: '2026-08-01T18:00:00.000Z',
    sourceActor: {
      name: 'David Hoang',
      href: 'https://www.linkedin.com/in/dhoang/',
      action: 'commented'
    }
  };
  const once = history.recordHiddenPost(undefined, event);
  const twice = history.recordHiddenPost(once, {
    ...event,
    seenAt: '2026-08-02T18:00:00.000Z'
  });

  assert.deepEqual(plain(twice), plain(once));
});

test('aggregates reasons and first/last seen for one feed-source actor', () => {
  const history = loadHistoryCore();
  const first = history.recordHiddenPost(undefined, {
    postKey: 'activity:1',
    verdict: 'ai-assisted',
    seenAt: '2026-08-01T18:00:00.000Z',
    sourceActor: {
      name: 'David Hoang',
      href: 'https://www.linkedin.com/in/dhoang/',
      action: 'commented'
    }
  });
  const second = history.recordHiddenPost(first, {
    postKey: 'activity:2',
    verdict: 'ai',
    seenAt: '2026-08-03T18:00:00.000Z',
    sourceActor: {
      name: 'David Hoang',
      href: 'https://www.linkedin.com/in/dhoang/',
      action: 'reposted this'
    }
  });

  const actor = second.actors['linkedin:in:dhoang'];
  assert.equal(actor.hiddenCount, 2);
  assert.equal(actor.firstSeen, '2026-08-01T18:00:00.000Z');
  assert.equal(actor.lastSeen, '2026-08-03T18:00:00.000Z');
  assert.deepEqual(plain(actor.reasons), {
    posted: 0,
    liked: 0,
    commented: 1,
    reposted: 1
  });
});

test('counts an unattributed hidden post without inventing an actor', () => {
  const history = loadHistoryCore();
  const next = history.recordHiddenPost(undefined, {
    postKey: 'activity:unknown',
    verdict: 'ai',
    seenAt: '2026-08-01T18:00:00.000Z',
    sourceActor: null
  });

  assert.equal(next.totalHidden, 1);
  assert.equal(next.unattributedHidden, 1);
  assert.deepEqual(plain(next.actors), {});
});

test('bounds opaque deduplication keys while preserving aggregate counts', () => {
  const history = loadHistoryCore();
  let current;
  for (let index = 1; index <= 4; index += 1) {
    current = history.recordHiddenPost(
      current,
      {
        postKey: `activity:${index}`,
        verdict: 'ai',
        seenAt: `2026-08-0${index}T18:00:00.000Z`,
        sourceActor: null
      },
      { maxSeenPostKeys: 3 }
    );
  }

  assert.equal(current.totalHidden, 4);
  assert.deepEqual(plain(current.seenPostKeys), [
    'activity:2',
    'activity:3',
    'activity:4'
  ]);
});

test('sorts actors by hidden count and then recency for the report', () => {
  const history = loadHistoryCore();
  const normalized = history.normalizeHistory({
    actors: {
      a: { name: 'Alpha', profileUrl: 'https://www.linkedin.com/in/a/', hiddenCount: 1, firstSeen: '2026-08-01T00:00:00.000Z', lastSeen: '2026-08-03T00:00:00.000Z' },
      b: { name: 'Beta', profileUrl: 'https://www.linkedin.com/in/b/', hiddenCount: 3, firstSeen: '2026-08-01T00:00:00.000Z', lastSeen: '2026-08-02T00:00:00.000Z' },
      c: { name: 'Gamma', profileUrl: 'https://www.linkedin.com/in/c/', hiddenCount: 1, firstSeen: '2026-08-01T00:00:00.000Z', lastSeen: '2026-08-04T00:00:00.000Z' }
    }
  });

  assert.deepEqual(
    plain(history.sortedActors(normalized).map((actor) => actor.name)),
    ['Beta', 'Gamma', 'Alpha']
  );
});
