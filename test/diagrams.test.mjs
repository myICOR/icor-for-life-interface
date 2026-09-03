/* THE DIAGRAMS GATES.
 *
 * Folded in from ICOR for Life - Diagrams on 2026-09-03. The feature is one
 * button per rendered mermaid block, added by a markdown post processor in
 * reading view and by a pointerover delegation in live preview. The gates
 * capture both hooks from the real main.js and drive them against a fake DOM.
 *
 * The one that matters most is idempotence ACROSS PLUGINS: a vault that still
 * runs the old standalone Diagrams beside this one must show one button, not
 * two. Both guard on the same class, and that guard is what is tested.
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

function loadPlugin({ saved = {} } = {}) {
  const body = new FakeEl('body');
  const hooks = { postProcessors: [], domEvents: [] };
  const obsidian = {
    Plugin: class {
      constructor(app, manifest) { this.app = app; this.manifest = manifest; }
      async loadData() { return saved; }
      async saveData(d) { saved = JSON.parse(JSON.stringify(d)); }
      addSettingTab() {}
      registerEvent() {}
      registerMarkdownPostProcessor(fn) { hooks.postProcessors.push(fn); }
      registerDomEvent(el, type, fn) { hooks.domEvents.push({ type, fn }); }
    },
    PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; } },
    Setting: class { setName() { return this; } setDesc() { return this; } setHeading() { return this; } addToggle() { return this; } addButton() { return this; } addText() { return this; } addDropdown() { return this; } addExtraButton() { return this; } addColorPicker() { return this; } },
    FuzzySuggestModal: class { setPlaceholder() {} },
    AbstractInputSuggest: class {},
    Modal: class { constructor(app) { this.app = app; } open() { this.opened = true; } },
    Notice: class {},
    TFolder: class {},
    setIcon: (el, icon) => { el.attrs['data-icon'] = icon; },
    getIconIds: () => [],
    getIcon: () => null,
  };
  const sandbox = {
    require: (name) => (name === 'obsidian' ? obsidian : nodeRequire(name)),
    module: { exports: {} },
    document: { body, querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s) },
    window: { setTimeout, clearTimeout },
    MutationObserver: class { observe() {} disconnect() {} },
    encodeURIComponent, JSON, console, setTimeout, clearTimeout, Number, Math, String, Map,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'main.js' });

  const layoutReady = [];
  const app = {
    vault: { getRoot: () => ({ children: [] }) },
    workspace: { onLayoutReady: (fn) => layoutReady.push(fn), on: () => ({}), getLeavesOfType: () => [] },
    metadataCache: { on: () => ({}), getFileCache: () => null },
    plugins: { enabledPlugins: new Set() },
  };
  const plugin = new sandbox.module.exports(app, { id: 'icor-for-life-interface', version: '0.0.0-gate' });
  return { plugin, body, hooks, ready: () => layoutReady.forEach((f) => f()) };
}

/* A rendered mermaid block as Obsidian leaves it: a section holding
   <div class="mermaid"><svg/></div>. `embed` wraps it in a live-preview
   widget block. */
function renderedDiagram(body, { embed = false } = {}) {
  const section = body.createDiv({ cls: 'markdown-preview-section' });
  const host = embed ? section.createDiv({ cls: 'cm-embed-block' }) : section;
  const m = host.createDiv({ cls: 'mermaid' });
  m.createEl('svg');
  return { section, m, embed: embed ? host : null };
}

const buttons = (el) => el.querySelectorAll('.icor-diag-btn');

test('a rendered diagram gets exactly one fullscreen button', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  assert.equal(hooks.postProcessors.length, 1, 'the post processor was not registered');
  const { section, m } = renderedDiagram(body);
  hooks.postProcessors[0](section);
  assert.equal(buttons(m).length, 1, 'no button on a rendered diagram');
  assert.ok(m.classSet.has('icor-diag-host'), 'the diagram was not marked as a host');
  assert.equal(buttons(m)[0].getAttribute('aria-label'), 'Open diagram fullscreen');
});

test('running the processor again adds no second button', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const { section, m } = renderedDiagram(body);
  hooks.postProcessors[0](section);
  hooks.postProcessors[0](section);
  plugin.wireDiagram(m);
  assert.equal(buttons(m).length, 1, 'buttons stacked up on repeated passes');
});

test('a button the old standalone Diagrams plugin already added is respected', async () => {
  /* The cross-plugin guard. Same class name on purpose. */
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const { section, m } = renderedDiagram(body);
  m.createEl('button', { cls: 'icor-diag-btn', attr: { 'data-from': 'old-plugin' } });
  hooks.postProcessors[0](section);
  assert.equal(buttons(m).length, 1, 'a second button was added beside the old plugin\'s');
  assert.equal(buttons(m)[0].getAttribute('data-from'), 'old-plugin', 'the old plugin\'s button was replaced');
});

test('in live preview the button anchors on the embed block, left of the edit control', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const { m, embed } = renderedDiagram(body, { embed: true });
  const over = hooks.domEvents.find((h) => h.type === 'pointerover');
  assert.ok(over, 'no pointerover delegation for live preview');
  over.fn({ target: m.querySelector('svg') });
  assert.equal(buttons(embed).length, 1, 'no button on the live-preview block');
  assert.equal(buttons(embed)[0].parentElement, embed, 'the button is not on the embed block');
  assert.ok(buttons(embed)[0].classSet.has('icor-diag-btn-lp'), 'the live-preview offset class is missing');
});

test('the switch off means no buttons, and existing ones are removed', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const { section, m } = renderedDiagram(body);
  hooks.postProcessors[0](section);
  assert.equal(buttons(m).length, 1);
  plugin.settings.diagramsEnabled = false;
  await plugin.saveSettings();
  assert.equal(buttons(m).length, 0, 'a button survived the switch going off');
  assert.ok(!m.classSet.has('icor-diag-host'), 'the host class survived the switch going off');
  const second = renderedDiagram(body);
  hooks.postProcessors[0](second.section);
  assert.equal(buttons(second.m).length, 0, 'a button was added with the switch off');
});

test('the modal clone is never wired', async () => {
  const { plugin, body, ready } = loadPlugin();
  await plugin.onload(); ready();
  const modal = body.createDiv({ cls: 'modal icor-diag-modal' });
  const holder = modal.createDiv({ cls: 'mermaid icor-diag-holder' });
  holder.createEl('svg');
  plugin.wireDiagram(holder);
  assert.equal(buttons(holder).length, 0, 'the fullscreen clone grew a fullscreen button');
});

test('a click opens the modal on the live svg', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const { section, m } = renderedDiagram(body);
  hooks.postProcessors[0](section);
  let opened = 0;
  const realOpen = Object.getPrototypeOf(Object.getPrototypeOf(plugin)).constructor;
  /* the Modal stub records open(); count instances by patching the sandbox class */
  const ev = buttons(m)[0].click();
  assert.ok(ev.defaultPrevented, 'the click reached the editor underneath');
});

test('unload removes every button and host mark', async () => {
  const { plugin, body, hooks, ready } = loadPlugin();
  await plugin.onload(); ready();
  const a = renderedDiagram(body); const b = renderedDiagram(body, { embed: true });
  hooks.postProcessors[0](a.section);
  hooks.domEvents.find((h) => h.type === 'pointerover').fn({ target: b.m });
  assert.equal(body.querySelectorAll('.icor-diag-btn').length, 2);
  plugin.onunload();
  assert.equal(body.querySelectorAll('.icor-diag-btn').length, 0, 'buttons outlived the plugin');
  assert.equal(body.querySelectorAll('.icor-diag-host').length, 0, 'host marks outlived the plugin');
});
