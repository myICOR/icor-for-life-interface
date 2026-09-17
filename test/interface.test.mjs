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
function loadPlugin({
  saved = null, icor = true, styleSettings = false, folders = null,
  explorerLeaf = undefined,
} = {}) {
  const body = new FakeEl('body');
  /* The host's status bar, with one core item in it, exists before any
     plugin loads. */
  const statusBar = body.createDiv({ cls: 'status-bar' });
  statusBar.createDiv({ cls: 'status-bar-item plugin-word-count', text: '12 words' });
  const commands = [];
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
  const notices = [];
  const settingTabs = [];
  /* Every Setting the tab builds, with its toggle's live value and its
     onChange, so a gate can read what the tab SHOWED and drive what it does. */
  const settings = [];
  const obsidian = {
    Plugin: class {
      constructor(app, manifest) { this.app = app; this.manifest = manifest; }
      async loadData() { return savedData.value; }
      async saveData(d) { savedData.value = JSON.parse(JSON.stringify(d)); }
      addSettingTab(tab) { settingTabs.push(tab); }
      registerEvent() {}
      registerMarkdownPostProcessor() {}
      registerDomEvent() {}
      addCommand(c) { commands.push(c); }
      /* the host appends a fresh item at the end of the bar */
      addStatusBarItem() { return statusBar.createDiv({ cls: 'status-bar-item plugin-icor-for-life-interface' }); }
    },
    PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
    Setting: class {
      constructor() { this.name = ''; this.desc = ''; this.heading = false; this.toggle = null; settings.push(this); }
      setName(n) { this.name = String(n); return this; }
      setDesc(d) { this.desc = String(d); return this; }
      setHeading() { this.heading = true; return this; }
      addToggle(fn) {
        const t = {
          value: undefined, cb: null,
          setValue(v) { t.value = v; return t; },
          onChange(cb) { t.cb = cb; return t; },
          setDisabled() { return t; },
        };
        this.toggle = t;
        fn(t);
        return this;
      }
      addButton() { return this; } addText() { return this; } addDropdown() { return this; }
      addExtraButton() { return this; } addColorPicker() { return this; }
    },
    FuzzySuggestModal: class { constructor() {} setPlaceholder() {} },
    AbstractInputSuggest: class { constructor() {} },
    Modal: class { constructor(app) { this.app = app; } open() {} },
    Notice: class { constructor(msg) { notices.push(String(msg)); } },
    Platform: { isMobile: false, isDesktop: true },
    TFolder,
    setIcon: (el, icon) => { el.attrs['data-icon'] = icon; },
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

  /* A file-explorer leaf as the host hands one over: getViewState returns the
     saved shape out of workspace.json, setViewState is recorded verbatim so a
     gate can assert what was sent rather than only what came back. Passing
     `explorerLeaf: null` is a vault whose core File explorer is turned off. */
  const leafCalls = [];
  const saveLayoutCalls = { n: 0 };
  const makeLeaf = (autoReveal, { legacy = false } = {}) => ({
    getViewState: () => {
      const state = { sortOrder: 'alphabetical', showSearch: false, searchQuery: '' };
      /* Obsidian 1.5.0 to 1.8.2: the file explorer predates the setting and
         emits no key at all. `legacy` is that host, not a host with the
         setting turned off. */
      if (!legacy) state.autoReveal = autoReveal;
      return { type: 'file-explorer', state, icon: 'lucide-folder-closed', title: 'Files' };
    },
    setViewState: async (vs) => {
      leafCalls.push(JSON.parse(JSON.stringify(vs)));
      /* the pre-1.8.3 host ignores a key it does not know */
      if (!legacy && vs && vs.state) autoReveal = vs.state.autoReveal;
    },
  });
  const leaf = explorerLeaf === undefined ? makeLeaf(false)
    : (explorerLeaf === null ? null
      : (explorerLeaf === 'legacy' ? makeLeaf(false, { legacy: true }) : makeLeaf(!!explorerLeaf)));

  const layoutReady = [];
  const app = {
    vault: { getRoot: () => root },
    workspace: {
      onLayoutReady: (fn) => layoutReady.push(fn),
      on: () => ({}),
      getLeavesOfType: (t) => ((t === 'file-explorer' && leaf) ? [leaf] : []),
      requestSaveLayout: () => { saveLayoutCalls.n += 1; },
    },
    metadataCache: { on: () => ({}), getFileCache: () => null },
    plugins: { enabledPlugins: new Set(styleSettings ? ['obsidian-style-settings'] : []) },
  };
  const PluginClass = sandbox.module.exports;
  const plugin = new PluginClass(app, { id: 'icor-for-life-interface', version: '0.0.0-gate' });
  /* Render the settings tab the plugin registered, into a container the tab
     can empty, and hand back every Setting it built. */
  const openSettings = () => {
    settings.length = 0;
    const tab = settingTabs[0];
    tab.containerEl = new FakeEl('div');
    tab.display();
    return settings;
  };
  return {
    plugin, body, explorer, tree, statusBar, commands, buildRows, savedData,
    notices, leafCalls, saveLayoutCalls, settingTabs, openSettings,
    ready: () => layoutReady.forEach((f) => f()),
  };
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
  const { plugin, body, ready } = loadPlugin({ icor: true, saved: { showRibbon: true, showControls: true, showBanner: false } });
  await plugin.onload(); ready();
  assert.ok(!body.classSet.has('icor-hide-ribbon'), 'the first-run default overrode a saved choice');
  assert.ok(body.classSet.has('icor-hide-banner'), 'a saved switch was not applied');
});

test('a positive switch maps to the theme\'s negative class, both ways', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  plugin.settings.handwriting = false;
  await plugin.saveSettings();
  assert.ok(body.classSet.has('inkline-no-hand'), 'switching handwriting OFF did not add the theme\'s no-hand class');
  plugin.settings.handwriting = true;
  await plugin.saveSettings();
  assert.ok(!body.classSet.has('inkline-no-hand'), 'switching handwriting back ON did not remove the class');
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
  const { plugin, body, ready } = loadPlugin({ icor: true, saved: { showRibbon: false, showControls: false, showBanner: false, roomIcons: false, handwriting: false } });
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

/* ------------------------------------------------------------ positives -- */

test('every switch reads as ON in a plain vault, and the body carries no theme class', async () => {
  /* The names say "banner", "handwriting", "room icons": ON means shown.
     The theme's classes are the negations, so a fresh vault has none. */
  const { plugin, body, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  for (const k of ['showRibbon', 'showControls', 'showBanner', 'roomIcons', 'handwriting']) {
    assert.equal(plugin.settings[k], true, `${k} is not ON by default`);
  }
  assert.equal(SWITCH_CLASSES.filter((c) => body.classSet.has(c)).length, 0, 'a theme class is on body with every switch ON');
});

test('settings saved by 0.5.x with the old negative keys migrate by inversion', async () => {
  const { plugin, body, ready, savedData } = loadPlugin({ saved: { hideRibbon: true, reduceChrome: false, hideBanner: true, roomsOff: false, noHand: true, tocEnabled: true, tocDepth: 2 } });
  await plugin.onload(); ready();
  assert.equal(plugin.settings.showRibbon, false, 'hideRibbon:true did not become showRibbon:false');
  assert.equal(plugin.settings.showControls, true, 'reduceChrome:false did not become showControls:true');
  assert.equal(plugin.settings.showBanner, false);
  assert.equal(plugin.settings.roomIcons, true);
  assert.equal(plugin.settings.handwriting, false);
  for (const k of ['hideRibbon', 'reduceChrome', 'hideBanner', 'roomsOff', 'noHand', 'tocEnabled', 'tocDepth']) {
    assert.ok(!(k in plugin.settings), `the old key ${k} survived migration; the file would carry both answers`);
  }
  assert.ok(body.classSet.has('icor-hide-ribbon'), 'the migrated ribbon choice was not applied');
  assert.ok(body.classSet.has('inkline-no-hand'), 'the migrated handwriting choice was not applied');
  assert.ok(!body.classSet.has('icor-scaffold-chrome'));
});

/* -------------------------------------------------------------- outline -- */

test('outline depth puts exactly one depth class on body, or none for all levels', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  const depthClasses = () => [...body.classSet].filter((c) => c.startsWith('icor-outline-depth-'));
  assert.deepEqual(depthClasses(), [], 'a depth class is on body with depth 0 (all levels)');
  plugin.settings.outlineDepth = 2;
  await plugin.saveSettings();
  assert.deepEqual(depthClasses(), ['icor-outline-depth-2']);
  plugin.settings.outlineDepth = 4;
  await plugin.saveSettings();
  assert.deepEqual(depthClasses(), ['icor-outline-depth-4'], 'the old depth class stayed on body beside the new one');
  plugin.settings.outlineDepth = 0;
  await plugin.saveSettings();
  assert.deepEqual(depthClasses(), [], 'depth 0 left a class behind');
});

test('outline depth is applied even when Style Settings owns the five switches', async () => {
  /* Style Settings owns the theme's classes; the outline depth is this
     plugin's own and must not be silenced with them. */
  const { plugin, body, ready } = loadPlugin({ icor: false, styleSettings: true, saved: { outlineDepth: 3 } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has('icor-outline-depth-3'), 'outline depth was skipped because Style Settings is installed');
});

test('unload removes the outline depth class', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false, saved: { outlineDepth: 3 } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has('icor-outline-depth-3'));
  plugin.onunload();
  assert.ok(![...body.classSet].some((c) => c.startsWith('icor-outline-depth-')), 'the depth class outlived the plugin');
});

/* ----------------------------------------------------------- status bar -- */

const COLLAPSED = 'icor-status-bar-collapsed';
const HOVER_REVEAL = 'icor-status-bar-hover-reveal';
const zoneOf = (body) => body.children.find((c) => c.classSet.has('icor-status-bar-zone')) || null;
const fabOf = (body) => body.querySelector('.icor-status-bar-zone .icor-status-bar-expand');
const itemOf = (bar) => bar.children.find((c) => c.classSet.has('icor-status-bar-collapse')) || null;
const toggleCommand = (commands) => commands.find((c) => c.id === 'toggle-status-bar');
const styles = readFileSync(resolve(repo, 'styles.css'), 'utf8');

/* The declarations of the FIRST rule whose selector list contains `selector`
   verbatim, as a map. Comments are stripped first so a commented-out rule
   cannot pass. */
function declarationsOf(css, selector) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(bare))) {
    const selectors = m[1].split(',').map((x) => x.trim());
    if (!selectors.includes(selector)) continue;
    const out = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) out[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    return out;
  }
  return null;
}

test('collapsible by default, unfolded by default: the item sits at the left edge, the bar is untouched', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  assert.equal(plugin.settings.statusBarCollapsible, true, 'the feature is not on by default');
  assert.equal(plugin.settings.statusBarCollapsed, false, 'a fresh vault starts folded');
  assert.ok(!body.classSet.has(COLLAPSED), 'the collapsed class is on body while unfolded');
  const item = itemOf(statusBar);
  assert.ok(item, 'no collapse item in the bar');
  assert.equal(statusBar.children[0], item, 'the collapse item is not the first thing in the bar');
  assert.equal(item.getAttribute('aria-label'), 'Fold status bar to the right');
  assert.equal(item.getAttribute('role'), 'button', 'the item is not reachable as a button');
  assert.ok(statusBar.children.some((c) => c.classSet.has('plugin-word-count')), 'a core item went missing');
  assert.ok(zoneOf(body), 'no hit zone on the body');
  assert.ok(fabOf(body), 'no expand button inside the zone');
  assert.equal(fabOf(body).getAttribute('aria-label'), 'Unfold status bar to the left');
});

test('the glyphs point the way the bar moves: the button left (it unfolds that way), the item right (it folds that way)', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  assert.equal(fabOf(body).getAttribute('data-icon'), 'chevron-left', 'the round button does not point left');
  assert.equal(itemOf(statusBar).getAttribute('data-icon'), 'chevron-right', 'the item does not point right');
});

test('the hover reveal is on by default, is a body class, and follows its setting', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false, saved: { statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.equal(plugin.settings.statusBarButtonOnHover, true, 'the reveal is not on by default');
  assert.ok(body.classSet.has(HOVER_REVEAL), 'the reveal class is missing from body');
  plugin.settings.statusBarButtonOnHover = false;
  await plugin.saveSettings();
  assert.ok(!body.classSet.has(HOVER_REVEAL), 'the reveal class outlived its setting');
  plugin.settings.statusBarButtonOnHover = true;
  await plugin.saveSettings();
  assert.ok(body.classSet.has(HOVER_REVEAL), 'the reveal class did not come back');
  plugin.onunload();
  assert.ok(!body.classSet.has(HOVER_REVEAL), 'the reveal class outlived the plugin');
});

test('styles.css: with the reveal on, the folded button rests invisible and shows on hover of the zone and on keyboard focus', () => {
  const rest = declarationsOf(styles, 'body.icor-status-bar-collapsed.icor-status-bar-hover-reveal .icor-status-bar-expand');
  assert.ok(rest, 'no rest rule for the folded button under the reveal class');
  assert.equal(rest.opacity, '0', 'the button is not invisible at rest');
  assert.match(rest.transition || '', /^opacity /, 'the reveal is not a transition on opacity');
  const hover = declarationsOf(styles, 'body.icor-status-bar-collapsed.icor-status-bar-hover-reveal .icor-status-bar-zone:hover .icor-status-bar-expand');
  assert.equal(hover && hover.opacity, '1', 'hovering the zone does not reveal the button');
  const focus = declarationsOf(styles, 'body.icor-status-bar-collapsed.icor-status-bar-hover-reveal .icor-status-bar-expand:focus-visible');
  assert.equal(focus && focus.opacity, '1', 'keyboard focus does not reveal the button; a keyboard user would tab onto nothing');
  const zone = declarationsOf(styles, 'body.icor-status-bar-collapsed .icor-status-bar-zone');
  assert.equal(zone && zone.width, 'var(--size-4-16, 64px)', 'the hit zone is not the 64px square');
  assert.equal(zone && zone.height, 'var(--size-4-16, 64px)', 'the hit zone is not the 64px square');
});

test('the item folds the bar, the round button unfolds it, and the fold is saved', async () => {
  const { plugin, body, statusBar, ready, savedData } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  itemOf(statusBar).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(body.classSet.has(COLLAPSED), 'clicking the item did not fold the bar');
  assert.equal(savedData.value.statusBarCollapsed, true, 'the fold was not saved');
  fabOf(body).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(!body.classSet.has(COLLAPSED), 'clicking the round button did not unfold the bar');
  assert.equal(savedData.value.statusBarCollapsed, false, 'the unfold was not saved');
});

test('a saved fold survives a reload', async () => {
  const { plugin, body, ready } = loadPlugin({ icor: false, saved: { statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has(COLLAPSED), 'the bar came back unfolded after a reload');
});

test('the command "Toggle status bar" flips the fold, and is offered only while the feature is on', async () => {
  const { plugin, body, commands, ready } = loadPlugin({ icor: false });
  await plugin.onload(); ready();
  const cmd = toggleCommand(commands);
  assert.ok(cmd, 'no toggle-status-bar command registered');
  assert.equal(cmd.name, 'Toggle status bar');
  assert.equal(cmd.checkCallback(true), true, 'the command is not offered while the feature is on');
  cmd.checkCallback(false);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(body.classSet.has(COLLAPSED), 'the command did not fold the bar');
  plugin.settings.statusBarCollapsible = false;
  await plugin.saveSettings();
  assert.equal(cmd.checkCallback(true), false, 'the command is offered while the feature is off; a hotkey to it would do nothing');
});

test('off leaves core untouched: no class, no item, no button, even with a saved fold', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false, saved: { statusBarCollapsible: false, statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.ok(!body.classSet.has(COLLAPSED), 'a saved fold was applied while the feature is off');
  assert.equal(itemOf(statusBar), null, 'an item was put in the bar while the feature is off');
  assert.equal(zoneOf(body), null, 'a hit zone was put on the body while the feature is off');
  assert.equal(fabOf(body), null, 'a round button was put on the body while the feature is off');
  assert.equal(statusBar.children.length, 1, 'the bar is not exactly as the host built it');
});

test('switching the feature off takes everything down, switching it on brings it back once', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false, saved: { statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has(COLLAPSED));
  plugin.settings.statusBarCollapsible = false;
  await plugin.saveSettings();
  assert.ok(!body.classSet.has(COLLAPSED), 'the class outlived the switch');
  assert.equal(itemOf(statusBar), null, 'the item outlived the switch');
  assert.equal(fabOf(body), null, 'the round button outlived the switch');
  plugin.settings.statusBarCollapsible = true;
  await plugin.saveSettings();
  await plugin.saveSettings();
  assert.equal(statusBar.children.filter((c) => c.classSet.has('icor-status-bar-collapse')).length, 1, 'more than one item after re-enabling');
  assert.equal(body.children.filter((c) => c.classSet.has('icor-status-bar-zone')).length, 1, 'more than one hit zone after re-enabling');
  assert.equal(body.querySelectorAll('.icor-status-bar-expand').length, 1, 'more than one round button after re-enabling');
  assert.ok(body.classSet.has(COLLAPSED), 'the remembered fold did not come back with the feature');
});

test('the status bar is this plugin\'s own and is applied even when Style Settings owns the five switches', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false, styleSettings: true, saved: { statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has(COLLAPSED), 'the fold was skipped because Style Settings is installed');
  assert.ok(itemOf(statusBar), 'the item was skipped because Style Settings is installed');
});

test('unload restores the bar fully and removes the round button', async () => {
  const { plugin, body, statusBar, ready } = loadPlugin({ icor: false, saved: { statusBarCollapsed: true } });
  await plugin.onload(); ready();
  assert.ok(body.classSet.has(COLLAPSED));
  plugin.onunload();
  assert.ok(!body.classSet.has(COLLAPSED), 'the collapsed class outlived the plugin; the bar would stay hidden with nothing to unhide it');
  assert.equal(itemOf(statusBar), null, 'the item outlived the plugin');
  assert.equal(zoneOf(body), null, 'the hit zone outlived the plugin');
  assert.equal(fabOf(body), null, 'the round button outlived the plugin');
  assert.ok(statusBar.children.some((c) => c.classSet.has('plugin-word-count')), 'a core item went missing on unload');
});

/* --------------------------------------------------------- auto-reveal --
 *
 * "Auto-reveal current file" is Obsidian's own switch and the host gives it
 * exactly one surface: a button on the file-explorer toolbar. It registers no
 * command for it (measured against the 1.13.7 bundle: eight `file-explorer:`
 * command ids, none of them touches autoReveal), so a suite that reduces that
 * toolbar has to carry the switch itself or the setting is gone.
 *
 * These gates measure the leaf, not the source: what was SENT to
 * `setViewState`, what came back from `getViewState`, and what the notice
 * said. A grep for `autoReveal` would stay green on a plugin that reads the
 * state and never writes it.
 */

const autoRevealCommand = (commands) =>
  commands.find((c) => c.id === 'toggle-auto-reveal') || null;

test('the command exists and is named for what it does', async () => {
  const { plugin, commands, ready } = loadPlugin({ icor: true });
  await plugin.onload(); ready();
  const cmd = autoRevealCommand(commands);
  assert.ok(cmd, 'no toggle-auto-reveal command was registered');
  assert.equal(cmd.name, 'Toggle auto-reveal current file in the file explorer',
    'the command name has to say which control it flips; the palette is the only place a user meets it');
});

test('the command withdraws when there is no file explorer to flip', async () => {
  const { plugin, commands, ready } = loadPlugin({ icor: true, explorerLeaf: null });
  await plugin.onload(); ready();
  const cmd = autoRevealCommand(commands);
  assert.equal(cmd.checkCallback(true), false,
    'the command offered itself with the core File explorer off, so its hotkey would do nothing');
  assert.equal(plugin.autoRevealState(), null,
    'the state must be null rather than false when there is no leaf; false is an answer the plugin invented');
});

test('the command flips the leaf, both ways, through setViewState', async () => {
  const { plugin, commands, leafCalls, ready } = loadPlugin({ icor: true, explorerLeaf: false });
  await plugin.onload(); ready();
  assert.equal(plugin.autoRevealState(), false, 'the starting state was not read off the leaf');

  await plugin.toggleAutoReveal();
  assert.equal(leafCalls.length, 1, 'the first toggle wrote nothing to the leaf');
  assert.equal(leafCalls[0].state.autoReveal, true, 'OFF did not become ON');
  assert.equal(plugin.autoRevealState(), true, 'the leaf did not take the new state');

  await plugin.toggleAutoReveal();
  assert.equal(leafCalls[1].state.autoReveal, false, 'ON did not become OFF');
});

test('the write keeps the view type and the rest of the state, and never steals focus', async () => {
  const { plugin, leafCalls, ready } = loadPlugin({ icor: true, explorerLeaf: false });
  await plugin.onload(); ready();
  await plugin.toggleAutoReveal();
  const sent = leafCalls[0];
  assert.equal(sent.type, 'file-explorer',
    'the view type changed, which makes the host rebuild the view and drop the tree\'s scroll and open folders');
  assert.equal(sent.state.sortOrder, 'alphabetical', 'the sort order was dropped from the state');
  assert.equal(sent.state.searchQuery, '', 'the rest of the view state was not carried over');
  assert.ok(!('active' in sent),
    'the write carries `active`, which pulls focus into the sidebar; this command is used from the note being written');
});

test('the flip is handed to the host to persist', async () => {
  const { plugin, saveLayoutCalls, ready } = loadPlugin({ icor: true, explorerLeaf: false });
  await plugin.onload(); ready();
  await plugin.toggleAutoReveal();
  assert.equal(saveLayoutCalls.n, 1,
    'requestSaveLayout was not called, so the flip is lost on the next start: a same-type setViewState '
    + 'does not trigger a layout save on its own');
});

test('the notice names the state it landed in, not the act', async () => {
  const { plugin, notices, ready } = loadPlugin({ icor: true, explorerLeaf: false });
  await plugin.onload(); ready();
  await plugin.toggleAutoReveal();
  assert.equal(notices.length, 1, 'the toggle showed no notice');
  assert.match(notices[0], /\bON\b/, 'the notice does not say the state is now ON');
  await plugin.toggleAutoReveal();
  assert.match(notices[1], /\bOFF\b/, 'the notice does not say the state is now OFF');
  for (const n of notices) {
    assert.ok(!/[–—]/.test(n), `the notice carries an em or en dash: ${n}`);
  }
});

test('the state is never copied into data.json', async () => {
  const { plugin, savedData, ready } = loadPlugin({ icor: false, explorerLeaf: false });
  await plugin.onload(); ready();
  await plugin.toggleAutoReveal();
  const written = JSON.stringify(savedData.value || {});
  assert.ok(!written.includes('autoReveal'),
    'the plugin kept its own copy of a setting Obsidian already owns; two writers on one setting is the '
    + 'fight applyChrome steps out of when Style Settings is installed');
});

test('the settings toggle mirrors the live leaf and writes back to it', async () => {
  const { plugin, openSettings, leafCalls, ready } = loadPlugin({ icor: true, explorerLeaf: true });
  await plugin.onload(); ready();

  const shown = openSettings().find((s) => s.name === 'Auto-reveal current file');
  assert.ok(shown, 'the settings tab has no auto-reveal row');
  assert.equal(shown.toggle.value, true,
    'the toggle did not read the live leaf, so it can show OFF while the file explorer is ON');

  await shown.toggle.cb(false);
  assert.equal(leafCalls.length, 1, 'the settings toggle wrote nothing to the leaf');
  assert.equal(leafCalls[0].state.autoReveal, false, 'the settings toggle did not turn it off');
  assert.equal(plugin.autoRevealState(), false, 'the leaf did not take the settings toggle\'s value');
});

test('with the file explorer off the settings row explains rather than offering a dead switch', async () => {
  const { plugin, openSettings, ready } = loadPlugin({ icor: true, explorerLeaf: null });
  await plugin.onload(); ready();
  const shown = openSettings().find((s) => s.name === 'Auto-reveal current file');
  assert.ok(shown, 'the auto-reveal row disappeared entirely; the user is left with no explanation');
  assert.equal(shown.toggle, null, 'a toggle was offered with no leaf behind it');
  assert.match(shown.desc, /File explorer is off/,
    'the row does not say why there is nothing to switch');
});

/* THE CAPABILITY PROBE (Flint I-1, review of 0.7.0, 2026-09-17).
 *
 * The manifest floors at Obsidian 1.5.0 and the setting arrived in 1.8.3, so
 * this plugin will load on hosts whose file explorer has never heard of
 * `autoReveal`. Those hosts emit no key and ignore one on write. Reading the
 * absence as `false` is the dead switch this release says it refuses to ship:
 * the command would offer itself, the write would go nowhere, and the notice
 * would report ON. The key's PRESENCE is the probe, so the gate feeds a leaf
 * whose state simply does not carry it.
 */
test('a host older than the setting is told apart from the setting being off', async () => {
  const { plugin, commands, leafCalls, openSettings, ready } = loadPlugin({ icor: true, explorerLeaf: 'legacy' });
  await plugin.onload(); ready();

  assert.equal(plugin.autoRevealState(), null,
    'a file explorer that emits no autoReveal key was read as OFF; that is a host without the setting, '
    + 'not a setting turned off, and false here is an answer the plugin invented');

  const cmd = autoRevealCommand(commands);
  assert.equal(cmd.checkCallback(true), false,
    'the command offered itself on an Obsidian older than 1.8.3, where its write goes nowhere');

  assert.equal(await plugin.toggleAutoReveal(), null, 'the toggle claimed to have done something');
  assert.equal(leafCalls.length, 0, 'the plugin wrote a key the host does not know');

  const shown = openSettings().find((s) => s.name === 'Auto-reveal current file');
  assert.equal(shown.toggle, null, 'a live toggle was offered on a host without the setting');
  assert.match(shown.desc, /older than 1\.8\.3/,
    'the row does not tell the member their Obsidian is too old, so the missing switch reads as a bug');
});

/* CARDINALITY. Without this the block above goes green on a harness that
   stopped handing the plugin a leaf at all. */
test('the auto-reveal gates are measuring a real leaf', async () => {
  const { plugin, ready } = loadPlugin({ icor: true, explorerLeaf: true });
  await plugin.onload(); ready();
  assert.equal(plugin.autoRevealState(), true,
    'the fixture leaf reports nothing, so every assertion above is about a plugin talking to no one');
});
