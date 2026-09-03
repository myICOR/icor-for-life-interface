/* THE TABLE OF CONTENTS GATES.
 *
 * The panel is DOM the plugin builds from the metadata cache and places in one
 * of two hosts. So the gates measure exactly that: for a given cache and
 * settings, what element exists, where it sits, what it lists, and what a
 * click on it does to the view. Real main.js, fake DOM, no Obsidian.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

import { FakeEl, makeEl } from './fake-dom.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(repo, 'main.js'), 'utf8');
const nodeRequire = createRequire(import.meta.url);

const HEADINGS = [
  { heading: 'Title', level: 1, position: { start: { line: 0 } } },
  { heading: 'First part', level: 2, position: { start: { line: 4 } } },
  { heading: 'A detail', level: 3, position: { start: { line: 9 } } },
  { heading: 'Too deep', level: 4, position: { start: { line: 12 } } },
  { heading: 'Second part', level: 2, position: { start: { line: 20 } } },
];

/* A markdown leaf as the plugin sees it: a view with a file, a content
   container holding a preview sizer (reading) and a cm sizer (editing), a
   mode, a preview scroller and an editor. */
function makeLeaf(body, { path = 'Notes/hello.md', ext = 'md', mode = 'preview', sizers = true } = {}) {
  const content = body.createDiv({ cls: 'view-content' });
  let previewSizer = null, cmSizer = null;
  if (sizers) {
    const preview = content.createDiv({ cls: 'markdown-preview-view' });
    previewSizer = preview.createDiv({ cls: 'markdown-preview-sizer' });
    const source = content.createDiv({ cls: 'markdown-source-view' });
    cmSizer = source.createDiv({ cls: 'cm-sizer' });
  }
  const scrolled = [];
  const cursor = [];
  const view = {
    file: { path, extension: ext, basename: path.split('/').pop().replace(/\.\w+$/, '') },
    contentEl: content,
    getMode: () => mode,
    previewMode: { applyScroll: (line) => scrolled.push(line) },
    editor: { setCursor: (pos) => cursor.push(pos), scrollIntoView: () => {} },
  };
  return { view, content, previewSizer, cmSizer, scrolled, cursor };
}

function loadPlugin({ saved = {}, leaves = [], headings = HEADINGS } = {}) {
  const body = new FakeEl('body');
  const leafObjs = leaves.length ? leaves.map((opts) => makeLeaf(body, opts)) : [makeLeaf(body)];
  const obsidian = {
    Plugin: class {
      constructor(app, manifest) { this.app = app; this.manifest = manifest; }
      async loadData() { return saved; }
      async saveData(d) { saved = JSON.parse(JSON.stringify(d)); }
      addSettingTab() {}
      registerEvent() {}
    },
    PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
    Setting: class { setName() { return this; } setDesc() { return this; } setHeading() { return this; } addToggle() { return this; } addButton() { return this; } addText() { return this; } addDropdown() { return this; } addExtraButton() { return this; } addColorPicker() { return this; } },
    FuzzySuggestModal: class { setPlaceholder() {} },
    AbstractInputSuggest: class {},
    Notice: class {},
    TFolder: class {},
    setIcon: () => {},
    getIconIds: () => [],
    getIcon: () => null,
  };
  const sandbox = {
    require: (name) => (name === 'obsidian' ? obsidian : nodeRequire(name)),
    module: { exports: {} },
    document: { body, querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s) },
    window: { setTimeout, clearTimeout },
    MutationObserver: class { observe() {} disconnect() {} },
    encodeURIComponent, JSON, console, setTimeout, clearTimeout, Number, Math, String,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'main.js' });

  const layoutReady = [];
  const app = {
    vault: { getRoot: () => ({ children: [] }) },
    workspace: {
      onLayoutReady: (fn) => layoutReady.push(fn),
      on: () => ({}),
      getLeavesOfType: (t) => (t === 'markdown' ? leafObjs.map((l) => ({ view: l.view })) : []),
    },
    metadataCache: { on: () => ({}), getFileCache: () => ({ headings }) },
    plugins: { enabledPlugins: new Set() },
  };
  const plugin = new sandbox.module.exports(app, { id: 'icor-for-life-interface', version: '0.0.0-gate' });
  return { plugin, body, leaves: leafObjs, ready: () => layoutReady.forEach((f) => f()) };
}

const toc = (el) => el.querySelector('.icor-if-toc');
const items = (nav) => nav.querySelectorAll('.icor-if-toc-item');
const texts = (nav) => nav.querySelectorAll('.icor-if-toc-link').map((a) => a.textContent);

test('off by default: no panel is drawn', async () => {
  const { plugin, leaves, ready } = loadPlugin();
  await plugin.onload(); ready();
  assert.equal(toc(leaves[0].content), null, 'a panel appeared with the setting off');
});

test('on: the panel lists the headings to the chosen depth, in order', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true, tocDepth: 3 } });
  await plugin.onload(); ready();
  const nav = toc(leaves[0].content);
  assert.ok(nav, 'no panel with the setting on');
  assert.deepEqual(texts(nav), ['Title', 'First part', 'A detail', 'Second part'],
    'the panel does not list H1-H3 in document order, or leaked an H4');
  const levels = items(nav).map((i) => i.getAttribute('data-level'));
  assert.deepEqual(levels, ['1', '2', '3', '2']);
});

test('depth 1 lists only the top level', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true, tocDepth: 1 } });
  await plugin.onload(); ready();
  assert.deepEqual(texts(toc(leaves[0].content)), ['Title']);
});

test('sticky: the panel is a child of the view container, outside the scroller', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true, tocSticky: true } });
  await plugin.onload(); ready();
  const nav = toc(leaves[0].content);
  assert.equal(nav.parentElement, leaves[0].content, 'sticky panel is not anchored to .view-content');
  assert.ok(nav.classSet.has('is-sticky'));
  assert.equal(leaves[0].content.children[0], nav, 'the panel is not first in the container');
});

test('not sticky, reading mode: the panel sits inside the preview sizer', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true, tocSticky: false } });
  await plugin.onload(); ready();
  const nav = toc(leaves[0].content);
  assert.equal(nav.parentElement, leaves[0].previewSizer,
    'a non-sticky panel in reading mode is not inside .markdown-preview-sizer, so it cannot scroll with the note');
  assert.ok(nav.classSet.has('is-flow'));
});

test('not sticky, editing mode: the panel sits inside the cm sizer', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true, tocSticky: false }, leaves: [{ mode: 'source' }] });
  await plugin.onload(); ready();
  assert.equal(toc(leaves[0].content).parentElement, leaves[0].cmSizer);
});

test('a click scrolls the note in reading mode and moves the cursor in editing mode', async () => {
  const r = loadPlugin({ saved: { tocEnabled: true }, leaves: [{ mode: 'preview' }, { mode: 'source' }] });
  await r.plugin.onload(); r.ready();
  const [reading, editing] = r.leaves;
  toc(reading.content).querySelectorAll('.icor-if-toc-link')[3].click();
  assert.deepEqual(reading.scrolled, [20], 'reading mode did not scroll to the heading\'s line');
  assert.deepEqual(reading.cursor, [], 'reading mode touched the editor');
  toc(editing.content).querySelectorAll('.icor-if-toc-link')[1].click();
  /* JSON, not deepEqual: the position object is born inside the VM sandbox
     and strict deep equality rejects its foreign Object prototype. */
  assert.equal(JSON.stringify(editing.cursor), JSON.stringify([{ line: 4, ch: 0 }]),
    'editing mode did not move the cursor to the heading');
  assert.deepEqual(editing.scrolled, [], 'editing mode called the preview scroller');
});

test('a click never opens a link, so it stays in its own leaf', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true } });
  await plugin.onload(); ready();
  const ev = toc(leaves[0].content).querySelector('.icor-if-toc-link').click();
  assert.ok(ev.defaultPrevented, 'the href was left to the host, which would navigate');
});

test('a note with no headings gets no panel', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true }, headings: [] });
  await plugin.onload(); ready();
  assert.equal(toc(leaves[0].content), null, 'an empty panel was drawn');
});

test('only markdown files get a panel', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true }, leaves: [{ path: 'a.canvas', ext: 'canvas' }] });
  await plugin.onload(); ready();
  assert.equal(toc(leaves[0].content), null, 'a panel was drawn on a non-markdown file');
});

test('a refresh replaces the panel rather than stacking a second one', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true } });
  await plugin.onload(); ready();
  plugin.refreshTocs(); plugin.refreshTocs();
  assert.equal(leaves[0].content.querySelectorAll('.icor-if-toc').length, 1, 'panels stacked up');
});

test('switching the setting off removes every panel; unload does too', async () => {
  const { plugin, leaves, ready } = loadPlugin({ saved: { tocEnabled: true }, leaves: [{}, {}] });
  await plugin.onload(); ready();
  assert.equal(leaves.filter((l) => toc(l.content)).length, 2);
  plugin.settings.tocEnabled = false;
  await plugin.saveSettings();
  assert.equal(leaves.filter((l) => toc(l.content)).length, 0, 'panels survived the setting going off');
  plugin.settings.tocEnabled = true;
  await plugin.saveSettings();
  plugin.onunload();
  assert.equal(leaves.filter((l) => toc(l.content)).length, 0, 'panels outlived the plugin');
});
