/* THE INTERFACE GATES.
 *
 * This plugin writes no CSS. It writes two kinds of data the INKLINE theme
 * reads: five classes on <body>, and per-row attributes plus custom
 * properties on file-explorer folders. So the gates measure exactly that -
 * what is on the body and on the rows after each pass - against a fake DOM,
 * with the real main.js loaded.
 *
 * Behaviour, not source text, for the reason every gate in this suite gives:
 * a grep for the class name stays green on a class that is toggled and never
 * applied, or applied and never removed.
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

const SWITCH_CLASSES = ['icor-hide-ribbon', 'icor-scaffold-chrome', 'icor-hide-banner', 'icor-rooms-off', 'inkline-no-hand'];

/* A vault: root folders as a tiny TFolder tree, and the explorer rows the host
   renders for them. `icor` decides whether the two ICOR marker rooms exist. */
function loadPlugin({ saved = null, icor = true, styleSettings = false, folders = null } = {}) {
  const body = new FakeEl('body');
  const explorer = body.createDiv({ cls: 'workspace-leaf-content', attr: { 'data-type': 'file-explorer' } });
  const tree = explorer.createDiv({ cls: 'nav-files-container' });

  const paths = folders || (icor
    ? ['00 Daily Scratchpad', '03 WiP', '03 WiP/Clients', '06 AI Team', 'Notes', 'Notes/Ideas']
    : ['Notes', 'Notes/Ideas', 'Archive']);

  const buildRows = () => {
    for (const r of [...tree.children]) r.remove();
    for (const p of paths) {
      const row = tree.createDiv({ cls: 'nav-folder-title', attr: { 'data-path': p } });
      row.createDiv({ cls: 'nav-folder-title-content', text: p.split('/').pop() });
    }
  };
  buildRows();

  class TFolder { constructor(path) { this.path = path; this.name = path.split('/').pop(); this.children = []; } }
  const root = new TFolder('');
  const byPath = new Map([['', root]]);
  for (const p of paths.slice().sort()) {
    const f = new TFolder(p);
    const parent = byPath.get(p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '') || root;
    parent.children.push(f);
    byPath.set(p, f);
  }

  const savedData = { value: saved };
  const obsidian = {
    Plugin: class {
      constructor(app, manifest) { this.app = app; this.manifest = manifest; }
      async loadData() { return savedData.value; }
      async saveData(d) { savedData.value = JSON.parse(JSON.stringify(d)); }
      addSettingTab() {}
      registerEvent() {}
    },
    PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
    Setting: class { constructor() {} setName() { return this; } setDesc() { return this; } setHeading() { return this; } addToggle() { return this; } addButton() { return this; } addText() { return this; } addDropdown() { return this; } addExtraButton() { return this; } addColorPicker() { return this; } },
    FuzzySuggestModal: class { constructor() {} setPlaceholder() {} },
    AbstractInputSuggest: class { constructor() {} },
    Notice: class {},
    TFolder,
    setIcon: () => {},
    getIconIds: () => ['lucide-folder', 'lucide-sprout', 'lucide-bot'],
    getIcon: (id) => ({
      cloneNode: () => ({
        removeAttribute() {}, setAttribute() {},
        outerHTML: `<svg stroke="currentColor"><path d="M0 0 ${id}"/></svg>`,
      }),
    }),
  };

  const sandbox = {
    require: (name) => (name === 'obsidian' ? obsidian : nodeRequire(name)),
    module: { exports: {} },
    document: { body, querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s) },
    window: { setTimeout, clearTimeout },
    MutationObserver: class { observe() {} disconnect() {} },
    encodeURIComponent,
    JSON,
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'main.js' });

  const layoutReady = [];
  const app = {
    vault: { getRoot: () => root },
    workspace: { onLayoutReady: (fn) => layoutReady.push(fn), on: () => ({}) },
    plugins: { enabledPlugins: new Set(styleSettings ? ['obsidian-style-settings'] : []) },
  };
  const PluginClass = sandbox.module.exports;
  const plugin = new PluginClass(app, { id: 'icor-for-life-interface', version: '0.0.0-gate' });
  return { plugin, body, explorer, tree, buildRows, savedData, ready: () => layoutReady.forEach((f) => f()) };
}

/* By attribute value rather than by selector: the fake engine splits selectors
   on whitespace, and half the paths in an ICOR vault have a space in them. */
const row = (tree, path) => tree.querySelectorAll('.nav-folder-title').find((r) => r.getAttribute('data-path') === path) || null;

/* --------------------------------------------------------------- chrome -- */

test('a fresh ICOR vault starts with the ribbon hidden and the chrome reduced', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: true });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has('icor-hide-ribbon'), 'the ribbon is not hidden in a fresh ICOR vault');
  assert.ok(body.classSet.has('icor-scaffold-chrome'), 'the chrome is not reduced in a fresh ICOR vault');
  assert.ok(!body.classSet.has('icor-hide-banner'), 'the banner was hidden by default');
  assert.ok(!body.classSet.has('icor-rooms-off'), 'the rooms were turned off by default');
});

test('a fresh vault that is not ICOR starts with nothing hidden', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  for (const cls of SWITCH_CLASSES) {
    assert.ok(!body.classSet.has(cls),
      `${cls} was applied to a vault that is not an ICOR vault. A plugin that removes navigation from `
      + 'a vault it was just installed into has broken that vault.');
  }
});

test('saved settings win over the first-run defaults', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: true, saved: { hideRibbon: false, reduceChrome: false, hideBanner: true } });
  await plugin.onload(); ready();
  assert.ok(!body.classSet.has('icor-hide-ribbon'), 'the first-run default overrode a saved choice');
  assert.ok(body.classSet.has('icor-hide-banner'), 'a saved switch was not applied');
});

test('flipping a switch applies its class, and flipping it back removes it', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  plugin.settings.noHand = true;
  await plugin.saveSettings();
  assert.ok(body.classSet.has('inkline-no-hand'), 'the class did not follow the switch on');
  plugin.settings.noHand = false;
  await plugin.saveSettings();
  assert.ok(!body.classSet.has('inkline-no-hand'), 'the class did not follow the switch off');
});

test('with Style Settings installed the plugin never touches the five classes', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: true, styleSettings: true });
  await plugin.onload(); ready();
  for (const cls of SWITCH_CLASSES) {
    assert.ok(!body.classSet.has(cls),
      `${cls} was written while Style Settings owns it. Two writers on one class is a fight the user `
      + 'watches and cannot referee.');
  }
});

test('unload removes every class it set', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: true, saved: { hideRibbon: true, reduceChrome: true, hideBanner: true, roomsOff: true, noHand: true } });
  await plugin.onload(); ready();
  assert.equal(SWITCH_CLASSES.filter((c) => body.classSet.has(c)).length, 5, 'not every switch applied');
  plugin.onunload();
  assert.equal(SWITCH_CLASSES.filter((c) => body.classSet.has(c)).length, 0, 'a class outlived the plugin');
});

/* -------------------------------------------------------------- folders -- */

test('a configured folder gets the kind and the four properties the theme reads', async () => {
  const { plugin, tree, ready } = loadPlugin({
    saved: { folders: [{ path: 'Notes', kind: 'room', color: '#123456', colorPaper: '#654321', icon: 'lucide-sprout', label: 'My notes' }] },
  });
  await plugin.onload(); ready();
  const r = row(tree, 'Notes');
  assert.equal(r.getAttribute('data-icor-kind'), 'room', 'the row was not claimed as a room');
  assert.equal(r.style.getPropertyValue('--room-color'), '#123456');
  assert.equal(r.style.getPropertyValue('--room-color-paper'), '#654321');
  assert.equal(r.style.getPropertyValue('--room-label'), '"My notes"', 'the label is not a quoted CSS string');
  assert.match(r.style.getPropertyValue('--room-icon'), /^url\("data:image\/svg\+xml,/, 'the icon is not a data URI the theme can mask with');
  assert.ok(!r.style.getPropertyValue('--room-icon').includes('currentColor'),
    'the icon still says currentColor, which has nothing to inherit inside a data URI');
});

test('a folder nobody configured is never touched', async () => {
  const { plugin, tree, ready } = loadPlugin({ saved: { folders: [{ path: 'Notes', kind: 'family', color: '#111111', icon: 'lucide-folder' }] } });
  await plugin.onload(); ready();
  const untouched = row(tree, '03 WiP');
  assert.ok(!untouched.hasAttribute('data-icor-kind'), 'an unconfigured ICOR room was claimed; the theme owns it');
  assert.equal(untouched.style.cssText, '', 'an unconfigured row got inline properties');
});

test('a room with no label gets the folder name minus its sort prefix', async () => {
  const { plugin, tree, ready } = loadPlugin({ saved: { folders: [{ path: '03 WiP', kind: 'room', color: '#111111', icon: 'lucide-folder' }] } });
  await plugin.onload(); ready();
  assert.equal(row(tree, '03 WiP').style.getPropertyValue('--room-label'), '"WiP"');
});

test('kind "none" claims the row and clears every property, so the theme leaves it alone', async () => {
  const { plugin, tree, ready } = loadPlugin({ saved: { folders: [{ path: '06 AI Team', kind: 'none', color: '#111111', icon: 'lucide-bot' }] } });
  await plugin.onload(); ready();
  const r = row(tree, '06 AI Team');
  assert.equal(r.getAttribute('data-icor-kind'), 'none');
  assert.equal(r.style.cssText, '', 'a "none" row still carries properties');
});

test('removing a folder from settings releases its row completely', async () => {
  const { plugin, tree, ready } = loadPlugin({ saved: { folders: [{ path: 'Notes', kind: 'family', color: '#111111', icon: 'lucide-folder' }] } });
  await plugin.onload(); ready();
  assert.ok(row(tree, 'Notes').hasAttribute('data-icor-kind'), 'not claimed to begin with');
  plugin.settings.folders = [];
  await plugin.saveSettings();
  const r = row(tree, 'Notes');
  assert.ok(!r.hasAttribute('data-icor-kind'), 'the kind attribute survived removal');
  assert.ok(!r.hasAttribute('data-icor-managed'), 'the managed marker survived removal');
  assert.equal(r.style.cssText, '', 'inline properties survived removal');
});

test('configuration comes back after the host rebuilds the tree', async () => {
  const { plugin, tree, buildRows, ready } = loadPlugin({ saved: { folders: [{ path: 'Notes', kind: 'family', color: '#111111', icon: 'lucide-folder' }] } });
  await plugin.onload(); ready();
  buildRows();
  assert.ok(!row(tree, 'Notes').hasAttribute('data-icor-kind'), 'the fixture did not actually rebuild');
  plugin.applyFolders();
  assert.equal(row(tree, 'Notes').getAttribute('data-icor-kind'), 'family', 'the row was not reclaimed after a rebuild');
});

test('unload releases every row it claimed', async () => {
  const { plugin, tree, ready } = loadPlugin({ saved: { folders: [
    { path: 'Notes', kind: 'room', color: '#111111', icon: 'lucide-folder' },
    { path: 'Notes/Ideas', kind: 'family', color: '#222222', icon: 'lucide-folder' },
  ] } });
  await plugin.onload(); ready();
  assert.equal(tree.querySelectorAll('[data-icor-managed]').length, 2, 'not both rows claimed');
  plugin.onunload();
  assert.equal(tree.querySelectorAll('[data-icor-managed]').length, 0, 'a claimed row outlived the plugin');
  assert.equal(row(tree, 'Notes').style.cssText, '', 'inline properties outlived the plugin');
});

/* ------------------------------------------------------------- scaffold -- */

test('the scaffold list resolves rooms by prefix, so a renamed room is still listed', async () => {
  const { plugin, ready } = loadPlugin({ folders: ['00 Daily Scratchpad', '04 Somewhere Else', '04 Somewhere Else/Journal', '06 AI Team', '07 Data', 'Notes'] });
  await plugin.onload(); ready();
  const rows = plugin.constructor.resolveScaffold(plugin.app);
  const paths = rows.map((r) => r.path);
  assert.ok(paths.includes('04 Somewhere Else'), `the renamed Inner World room is not listed: ${paths}`);
  assert.ok(paths.includes('04 Somewhere Else/Journal'), 'the Journal subfolder under the renamed room is not listed');
  assert.ok(!paths.some((p) => p.startsWith('05 ')), 'a room that does not exist in this vault was listed anyway');
  const inner = rows.find((r) => r.path === '04 Somewhere Else');
  assert.equal(inner.defaults.kind, 'room');
  assert.equal(inner.defaults.color, '#7d9a7f', 'Inner World does not show the theme\'s own green');
  assert.equal(inner.defaults.icon, 'sprout');
  assert.equal(inner.defaults.label, 'Inner World');
  /* Room 07 keys on its prefix too: "07 Data" (the private-vault name) still
   * resolves to the Databases room with the theme's own rose. */
  const databases = rows.find((r) => r.path === '07 Data');
  assert.ok(databases, `the 07 room is not listed: ${paths}`);
  assert.equal(databases.defaults.kind, 'room');
  assert.equal(databases.defaults.color, '#b57a86', 'room 07 does not show the theme\'s own rose ink');
  assert.equal(databases.defaults.colorPaper, '#8f5560', 'room 07 does not show the theme\'s own rose paper');
  assert.equal(databases.defaults.icon, 'database');
  assert.equal(databases.defaults.label, 'Databases');
});

test('editing a scaffold folder stores an override starting from the theme\'s values', async () => {
  const { plugin, tree, ready, savedData } = loadPlugin({ folders: ['04 Inner World', '04 Inner World/Journal', '00 Daily Scratchpad', '06 AI Team'] });
  await plugin.onload(); ready();
  const rows = plugin.constructor.resolveScaffold(plugin.app);
  const journal = rows.find((r) => r.path === '04 Inner World/Journal');
  await plugin.overrideFolder(journal.defaults, { color: '#ff0000' });

  const stored = savedData.value.folders.find((f) => f.path === '04 Inner World/Journal');
  assert.ok(stored, 'no override was stored');
  assert.equal(stored.color, '#ff0000', 'the change was not stored');
  assert.equal(stored.icon, 'notebook-pen', 'the override lost the theme\'s icon; changing one thing changed two');
  assert.equal(stored.colorPaper, '#7f662f', 'the override lost the theme\'s paper colour');
  const r = row(tree, '04 Inner World/Journal');
  assert.equal(r.getAttribute('data-icor-kind'), 'family', 'the row was not claimed after the override');
  assert.equal(r.style.getPropertyValue('--room-color'), '#ff0000');
});

test('resetting a scaffold folder removes the override and releases the row to the theme', async () => {
  const { plugin, tree, ready, savedData } = loadPlugin({ folders: ['04 Inner World', '00 Daily Scratchpad', '06 AI Team'] });
  await plugin.onload(); ready();
  const inner = plugin.constructor.resolveScaffold(plugin.app).find((r) => r.path === '04 Inner World');
  await plugin.overrideFolder(inner.defaults, { icon: 'heart' });
  assert.ok(row(tree, '04 Inner World').hasAttribute('data-icor-kind'), 'not claimed to begin with');

  await plugin.resetFolder('04 Inner World');
  assert.equal(savedData.value.folders.length, 0, 'the override survived the reset');
  const r = row(tree, '04 Inner World');
  assert.ok(!r.hasAttribute('data-icor-kind'), 'the row was not released to the theme');
  assert.equal(r.style.cssText, '', 'inline properties survived the reset');
});

test('only what the user changed is stored: an untouched scaffold list stores nothing', async () => {
  const { plugin, ready, savedData } = loadPlugin({ icor: true });
  await plugin.onload(); ready();
  plugin.constructor.resolveScaffold(plugin.app);
  assert.ok(!savedData.value || !savedData.value.folders || savedData.value.folders.length === 0,
    'listing the scaffold wrote overrides for it; the theme is the source of truth and the plugin must store only changes');
});
