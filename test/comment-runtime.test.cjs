const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

function makeCommentHarness({ initialBadge = true } = {}) {
  const attributes = new Map();
  const createdTags = [];
  const originalText = 'I think AI has not changed good design.';
  const parentElement = { closest: () => null };
  const textNode = { textContent: originalText, parentElement };
  let clownNode = null;
  let observedMutations = null;
  let badge = null;

  const textRoot = {
    textContent: originalText,
    classList: makeClassList(),
    contains: (node) => node === textNode,
    after: (node) => {
      clownNode = node;
    }
  };

  const commentTarget = {
    isConnected: true,
    classList: makeClassList(),
    matches: () => false,
    querySelector: (selector) =>
      selector === '[data-pangram-text-id]' ? textRoot : null,
    querySelectorAll: (selector) =>
      selector === '.pangram-feed-badge' && badge?.isConnected ? [badge] : [],
    hasAttribute: (name) => attributes.has(name),
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name)
  };
  parentElement.closest = (selector) =>
    selector === '[data-pangram-comment]' ? commentTarget : null;

  const postHost = { id: 'human-parent-post' };
  badge = {
    nodeType: 1,
    isConnected: true,
    textContent: 'AI',
    matches: (selector) => selector === '.pangram-feed-badge',
    closest: (selector) => {
      if (selector === '[data-pangram-comment]') return commentTarget;
      if (selector === '[data-pangram-post-id]') return postHost;
      return null;
    },
    querySelectorAll: () => []
  };

  const documentElement = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: () => []
  };
  const document = {
    documentElement,
    addEventListener() {},
    querySelectorAll: (selector) => {
      if (selector === '.pangram-feed-badge') return initialBadge ? [badge] : [];
      if (selector === '[data-pangram-gallery-comment-state]') {
        return attributes.has('data-pangram-gallery-comment-state')
          ? [commentTarget]
          : [];
      }
      return [];
    },
    createElement: (tag) => {
      createdTags.push(tag);
      const nodeAttributes = new Map();
      const element = {
        className: '',
        textContent: '',
        setAttribute: (name, value) => nodeAttributes.set(name, value),
        getAttribute: (name) => nodeAttributes.get(name),
        remove: () => {
          if (clownNode === element) clownNode = null;
        }
      };
      return element;
    },
    createTreeWalker: () => {
      let used = false;
      return {
        nextNode: () => {
          if (used) return null;
          used = true;
          return textNode;
        }
      };
    }
  };

  class MutationObserver {
    constructor(callback) {
      observedMutations = callback;
    }
    observe() {}
  }

  const context = {
    chrome: {
      runtime: { id: 'comment-test' },
      storage: {
        sync: { get: (_defaults, callback) => callback({}) },
        onChanged: { addListener() {} }
      }
    },
    document,
    MutationObserver,
    NodeFilter: { SHOW_TEXT: 4 },
    window: {
      location: { href: 'https://www.linkedin.com/feed/', origin: 'https://www.linkedin.com' },
      setTimeout: (callback) => {
        callback();
        return 1;
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);

  return {
    context,
    badge,
    commentTarget,
    createdTags,
    getClownNode: () => clownNode,
    getMutationCallback: () => observedMutations,
    originalText,
    textNode,
    textRoot
  };
}

async function startHarness(harness) {
  const coreSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'content-core.js'),
    'utf8'
  );
  const contentSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'content.js'),
    'utf8'
  );
  vm.runInContext(coreSource, harness.context);
  vm.runInContext(contentSource, harness.context);
  await new Promise(setImmediate);
}

test('masks an AI comment without replacing its human parent and restores it when the badge is removed', async () => {
  const harness = makeCommentHarness();
  await startHarness(harness);

  const clowns = harness.getClownNode();
  assert.ok(clowns, 'the AI comment should render a clown treatment');
  assert.equal(clowns.textContent, '🤡 🤡 🤡 🤡 🤡 🤡 🤡 🤡');
  assert.equal(clowns.getAttribute('aria-hidden'), 'true');
  assert.equal(harness.textRoot.textContent, harness.originalText);
  assert.equal(harness.textRoot.classList.contains('pangram-gallery-comment-original'), true);
  assert.deepEqual(harness.createdTags, ['span'], 'no replacement card should be created');

  harness.badge.isConnected = false;
  harness.getMutationCallback()([
    { target: harness.commentTarget, addedNodes: [], removedNodes: [harness.badge] }
  ]);

  assert.equal(harness.getClownNode(), null);
  assert.equal(harness.textRoot.classList.contains('pangram-gallery-comment-original'), false);
});

test('refreshes the clown count when an existing AI comment expands', async () => {
  const harness = makeCommentHarness();
  await startHarness(harness);

  harness.textNode.textContent = 'Now the comment has more words';
  harness.textRoot.textContent = harness.textNode.textContent;
  harness.getMutationCallback()([
    { target: harness.textNode, addedNodes: [{ nodeType: 3 }], removedNodes: [] }
  ]);

  assert.equal(harness.getClownNode()?.textContent, '🤡 🤡 🤡 🤡 🤡 🤡');
  assert.deepEqual(harness.createdTags, ['span'], 'refreshing should reuse the treatment');
});

test('masks an AI comment added after the initial feed scan', async () => {
  const harness = makeCommentHarness({ initialBadge: false });
  await startHarness(harness);
  assert.equal(harness.getClownNode(), null);

  const addedComment = {
    nodeType: 1,
    matches: () => false,
    querySelectorAll: (selector) =>
      selector === '.pangram-feed-badge' ? [harness.badge] : []
  };
  harness.getMutationCallback()([
    {
      target: harness.context.document.documentElement,
      addedNodes: [addedComment],
      removedNodes: []
    }
  ]);

  assert.equal(
    harness.getClownNode()?.textContent,
    '🤡 🤡 🤡 🤡 🤡 🤡 🤡 🤡'
  );
  assert.deepEqual(harness.createdTags, ['span'], 'the parent post should remain untouched');
});
