const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadCore() {
  const source = fs.readFileSync(path.join(root, 'src', 'content-core.js'), 'utf8');
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.PangramGalleryCore;
}

test('enables LinkedIn and disables X by default', () => {
  const core = loadCore();
  const settings = core.normalizeSettings();

  assert.deepEqual(JSON.parse(JSON.stringify(settings.platforms)), {
    linkedin: true,
    x: false
  });
  assert.equal(core.isPlatformEnabled(settings, 'www.linkedin.com'), true);
  assert.equal(core.isPlatformEnabled(settings, 'linkedin.com'), true);
  assert.equal(core.isPlatformEnabled(settings, 'x.com'), false);
  assert.equal(core.isPlatformEnabled(settings, 'example.com'), false);
});

test('honors explicit platform choices', () => {
  const core = loadCore();
  const settings = core.normalizeSettings({
    platforms: { linkedin: false, x: true }
  });

  assert.equal(core.isPlatformEnabled(settings, 'www.linkedin.com'), false);
  assert.equal(core.isPlatformEnabled(settings, 'x.com'), true);
  assert.equal(core.isPlatformEnabled(settings, 'mobile.x.com'), true);
});

test('adds an initially collapsed Configure section with platform checkboxes', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'options', 'options.html'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'src', 'options', 'options.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src', 'options', 'options.css'), 'utf8');

  assert.match(html, /<details class="configure-section">/);
  assert.doesNotMatch(html, /<details class="configure-section"\s+open/);
  assert.match(html, /<summary[^>]*>[\s\S]*<h2[^>]*>Configure<\/h2>[\s\S]*<svg/);
  assert.match(html, /id="platform-linkedin"[^>]*checked/);
  assert.match(html, /id="platform-x"/);
  assert.doesNotMatch(html, /id="platform-x"[^>]*checked/);
  assert.match(source, /platforms:\s*\{[\s\S]*linkedin:\s*controls\.platformLinkedIn\.checked[\s\S]*x:\s*controls\.platformX\.checked/);
  assert.match(css, /\.configure-chevron/);
  assert.match(css, /\.configure-section\[open\]/);
});

test('gates all content rules by platform and hides the requested LinkedIn sidebar modules', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'content.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src', 'content.css'), 'utf8');

  assert.match(source, /core\.isPlatformEnabled\(settings, window\.location\.hostname\)/);
  assert.match(source, /function processLinkedInSidebarTargets/);
  assert.match(source, /core\.collectLinkedInSidebarTargets\(document\)/);
  assert.match(source, /pangram-gallery-sidebar-hidden/);
  assert.match(css, /\.pangram-gallery-sidebar-hidden\s*\{[\s\S]*display:\s*none\s*!important/);
});

test('finds sidebar modules through semantic roles and stable destinations, not hashed classes', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'content-core.js'), 'utf8');

  assert.match(source, /function collectLinkedInSidebarTargets/);
  assert.match(source, /\/me\/profile-views\//);
  assert.match(source, /\/premium\/my-premium\//);
  assert.match(source, /\/admin\//);
  assert.match(source, /\/news\/story\//);
  assert.match(source, /\/games\//);
  assert.doesNotMatch(source, /LinkedIn News|Profile viewers|Your Premium features|My pages/);
});

test('hides the outer LinkedIn shells so dividers and blank bars do not remain', () => {
  const core = loadCore();
  const menuShell = { id: 'left-divider-shell' };
  const menuParent = { parentElement: menuShell };
  const menu = { parentElement: menuParent };
  const menuAnchor = { closest: (selector) => (selector === '[role="menu"]' ? menu : null) };

  const newsShell = { id: 'right-news-shell' };
  const newsCandidate = {
    parentElement: newsShell,
    querySelectorAll: (selector) =>
      selector.includes('/news/story/') ? [{}, {}] : [],
    querySelector: (selector) => (selector.includes('/games/') ? {} : null)
  };
  const newsAnchor = { parentElement: newsCandidate };
  const documentElement = {};
  const rootNode = {
    nodeType: 9,
    documentElement,
    querySelector: (selector) => {
      if (selector.includes('/me/profile-views/')) return menuAnchor;
      if (selector.includes('/news/story/')) return newsAnchor;
      return null;
    }
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(core.collectLinkedInSidebarTargets(rootNode))),
    [menuShell, newsShell]
  );
});
