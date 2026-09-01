/* ICOR for Life - Interface
 *
 * The vault's chrome, in one place: which parts of Obsidian's own interface
 * are shown, and which folders carry a colour, an icon and a label.
 *
 * It writes NO CSS OF ITS OWN. The INKLINE theme owns every rule. This plugin
 * owns two kinds of DATA the theme reads:
 *
 *   1. Five classes on <body>, one per switch. INKLINE guards the ribbon, the
 *      reduced chrome, the banner, the room icons and the handwritten layer
 *      on exactly these names, so the switches here are the same switches
 *      Style Settings would show - in plain words, with no second plugin.
 *
 *   2. Per-folder properties on file-explorer rows. INKLINE's room mechanism
 *      draws whatever `--room-color`, `--room-color-paper`, `--room-icon` and
 *      `--room-label` say, and applies its own ICOR defaults only to rows
 *      with no `data-icor-kind`. So a row this plugin claims is this plugin's
 *      outright, by the ordinary cascade: inline beats stylesheet, and
 *      nothing here needs `!important` or a copy of the theme's rules.
 *
 * THE DEFAULTS ARE NOT HERE. The seven ICOR rooms and their subfolders are
 * styled by the theme with no help from this plugin, and this plugin holds
 * only what the user CHANGED. Copying the theme's defaults into a second
 * file would make two places that have to agree, and the copy that gets
 * edited is never the copy that renders.
 *
 * Icons come from Obsidian itself: `getIconIds()` lists the ~1,700 Lucide
 * glyphs the app already ships, `getIcon()` hands over the SVG, and this
 * plugin serialises it into the `url("data:image/svg+xml,...")` the theme
 * masks with. No icon set is bundled.
 *
 * Hand-written CommonJS, no build step, like the rest of the suite.
 */

'use strict';

const {
  Plugin, PluginSettingTab, Setting, FuzzySuggestModal, AbstractInputSuggest,
  getIcon, getIconIds, setIcon, Notice, TFolder,
} = require('obsidian');

/* --------------------------------------------------------------- switches --
 * Each switch is a body class the theme guards on. The CLASS is the contract;
 * the key is what this plugin stores. `on` is what the class means when
 * present, so a switch whose class is a negation ("hide", "off", "no") reads
 * correctly in the settings tab without the user parsing double negatives. */
const SWITCHES = [
  {
    key: 'hideRibbon', cls: 'icor-hide-ribbon',
    name: 'Hide the left ribbon',
    desc: 'The thin column of icons on the far left. ICOR for Life routes every action it carried to the file-tree toolbar, the top row or the command palette.',
  },
  {
    key: 'reduceChrome', cls: 'icor-scaffold-chrome',
    name: "Reduce Obsidian's own controls",
    desc: 'Hides the vault switcher at the bottom of the sidebar, and New note, New folder and Change sort order from the file-tree toolbar.',
  },
  {
    key: 'hideBanner', cls: 'icor-hide-banner',
    name: 'Hide the ICOR for Life banner',
    desc: 'The banner above the folder tree.',
  },
  {
    key: 'roomsOff', cls: 'icor-rooms-off',
    name: 'Turn off room icons and colours',
    desc: "Every folder goes back to Obsidian's default look, including any you configured below.",
  },
  {
    key: 'noHand', cls: 'inkline-no-hand',
    name: 'Turn off the handwritten layer',
    desc: 'Blockquotes, note/tip/quote callouts and %%comments%% render in the body face instead of handwriting.',
  },
];

/* INKLINE's seven room hues, ink and paper. Offered as a palette so a folder
 * can join the family in one pick; the colour picker beside it takes anything
 * else. These are the theme's own values, kept here as a convenience and
 * never as the source: the theme renders its rooms without reading this. */
const PALETTE = [
  { key: 'yellow',     name: 'Yellow (Daily Scratchpad)', ink: '#c2a35c', paper: '#7f662f' },
  { key: 'terracotta', name: 'Terracotta (Inbox)',        ink: '#c2765a', paper: '#9e4526' },
  { key: 'marker',     name: 'Marker (Planner)',          ink: '#ff5a2d', paper: '#b3401f' },
  { key: 'cyan',       name: 'Cyan (WiP)',                ink: '#7a99a1', paper: '#4e6b73' },
  { key: 'success',    name: 'Green (Inner World)',       ink: '#7d9a7f', paper: '#5e7a60' },
  { key: 'burgundy',   name: 'Burgundy (Assets)',         ink: '#a87795', paper: '#7c5570' },
  { key: 'indigo',     name: 'Indigo (AI Team)',          ink: '#8087a6', paper: '#565e7e' },
];

/* THE ICOR FOR LIFE SCAFFOLD, as the theme styles it. Listed so a member can
 * see what the theme does to each of these folders and change any of it from
 * here. This table is DISPLAY DATA: the theme renders these rooms on its own
 * and reads nothing from this list. It exists so the settings tab can show a
 * true picture before the user touches anything, and so an edit starts from
 * the right values rather than from blanks.
 *
 * Rooms are keyed on their numeric prefix, subfolders on the room plus their
 * own name, resolved against the live vault - because that is how the theme
 * keys them, and a room Tom renamed to "04 Somewhere Else" is still the
 * Inner World room. Icons are the Lucide ids the theme's glyphs were drawn
 * from, matched by path data on 2026-09-01. */
const SCAFFOLD = [
  { room: '00', kind: 'room', hue: 'yellow',     icon: 'pencil',         label: 'Daily Scratchpad' },
  { room: '01', kind: 'room', hue: 'terracotta', icon: 'inbox',          label: 'Inbox' },
  { room: '02', kind: 'room', hue: 'marker',     icon: 'calendar-range', label: 'Planner' },
  { room: '03', kind: 'room', hue: 'cyan',       icon: 'hammer',         label: 'WiP' },
  { room: '04', kind: 'room', hue: 'success',    icon: 'sprout',         label: 'Inner World' },
  { room: '05', kind: 'room', hue: 'burgundy',   icon: 'package',        label: 'Assets' },
  { room: '06', kind: 'room', hue: 'indigo',     icon: 'bot',            label: 'AI Team' },
  { room: '01', sub: 'Outer World',       kind: 'family', hue: 'terracotta', icon: 'globe' },
  { room: '01', sub: 'Scanner Inbox',     kind: 'family', hue: 'terracotta', icon: 'scan-line' },
  { room: '04', sub: 'Contacts',          kind: 'family', hue: 'cyan',       icon: 'users' },
  { room: '04', sub: 'Journal',           kind: 'family', hue: 'yellow',     icon: 'notebook-pen' },
  { room: '04', sub: 'My Life',           kind: 'family', hue: 'success',    icon: 'heart' },
  { room: '04', sub: 'Goals',             kind: 'family', hue: 'terracotta', icon: 'target' },
  { room: '04', sub: 'Habits',            kind: 'family', hue: 'indigo',     icon: 'repeat' },
  { room: '04', sub: 'Key Elements',      kind: 'family', hue: 'burgundy',   icon: 'landmark' },
  { room: '04', sub: 'Projects',          kind: 'family', hue: 'cyan',       icon: 'folder-kanban' },
  { room: '04', sub: 'Topics',            kind: 'family', hue: 'yellow',     icon: 'library' },
  { room: '05', sub: 'Images',            kind: 'family', hue: 'burgundy',   icon: 'image' },
  { room: '05', sub: 'Audio',             kind: 'family', hue: 'burgundy',   icon: 'music' },
  { room: '05', sub: 'Documents',         kind: 'family', hue: 'burgundy',   icon: 'file-text' },
  { room: '06', sub: 'AI Team Knowledge', kind: 'family', hue: 'indigo',     icon: 'book-open' },
  { room: '06', sub: 'Agents',            kind: 'family', hue: 'indigo',     icon: 'users' },
  { room: '06', sub: 'AI Sessions',       kind: 'family', hue: 'indigo',     icon: 'messages-square' },
  { room: '06', sub: 'Workstreams',       kind: 'family', hue: 'indigo',     icon: 'workflow' },
  { room: '06', sub: 'SOPs',              kind: 'family', hue: 'indigo',     icon: 'clipboard-list' },
  { room: '06', sub: 'Guidelines',        kind: 'family', hue: 'indigo',     icon: 'book-marked' },
  { room: '06', sub: 'Scripts',           kind: 'family', hue: 'indigo',     icon: 'code' },
  { room: '06', sub: 'Tasks',             kind: 'family', hue: 'indigo',     icon: 'square-check-big' },
  { room: '06', sub: 'Session Logs',      kind: 'family', hue: 'indigo',     icon: 'history' },
  { room: '06', sub: 'Avatars',           kind: 'family', hue: 'indigo',     icon: 'circle-user' },
  { room: '06', sub: 'Brand',             kind: 'family', hue: 'indigo',     icon: 'infinity' },
];

const KINDS = [
  ['room', 'Room - a block with a coloured edge, no arrow, its own label'],
  ['family', 'Family - coloured name and a small icon'],
  ['none', "None - Obsidian's default look, even for an ICOR room"],
];

const DEFAULT_SETTINGS = {
  hideRibbon: false,
  reduceChrome: false,
  hideBanner: false,
  roomsOff: false,
  noHand: false,
  /* [{ path, kind, color, colorPaper, icon, label }] */
  folders: [],
};

/* The two folders that make a vault an ICOR for Life vault. Present together
 * at the root, and this plugin has never saved anything, the scaffold's own
 * defaults apply on first run: ribbon hidden, chrome reduced. Everyone else
 * starts with nothing hidden, because a plugin that removes navigation from
 * a vault it was just installed into has broken that vault. */
const ICOR_MARKERS = [/^00 /, /^06 /];

const STYLE_SETTINGS_ID = 'obsidian-style-settings';
const MANAGED = 'data-icor-managed';
const KIND = 'data-icor-kind';
const PROPS = ['--room-color', '--room-color-paper', '--room-icon', '--room-label'];

/* Serialise one of Obsidian's Lucide icons into the mask URL the theme reads.
 * `stroke="currentColor"` has no colour to inherit inside a data URI, so it is
 * pinned to black; a mask reads alpha, and any opaque colour will do. */
function iconUrl(iconId) {
  const svg = getIcon(iconId) || getIcon(`lucide-${iconId}`) || getIcon(String(iconId).replace(/^lucide-/, ''));
  if (!svg) return null;
  const el = svg.cloneNode(true);
  el.removeAttribute('class');
  el.setAttribute('stroke', 'black');
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = el.outerHTML.replace(/currentColor/g, 'black');
  return `url("data:image/svg+xml,${encodeURIComponent(src)}")`;
}

class IcorInterfacePlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved || {});
    this.settings.folders = Array.isArray(this.settings.folders) ? this.settings.folders : [];
    if (saved === null || saved === undefined) this.applyFirstRunDefaults();

    this.addSettingTab(new IcorInterfaceSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.applyChrome();
      this.applyFolders();
      this.observeExplorer();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.applyChrome();
      this.applyFolders();
      this.observeExplorer();
    }));
  }

  onunload() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    /* Everything this plugin wrote comes off on the way out: the body
       classes, and every row it claimed. Left behind, the theme would keep
       rendering a configuration nobody can edit any more. */
    for (const s of SWITCHES) document.body.classList.remove(s.cls);
    for (const row of document.querySelectorAll(`[${MANAGED}]`)) this.releaseRow(row);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyChrome();
    this.applyFolders();
  }

  /* ---------------------------------------------------------- first run -- */

  isIcorVault() {
    const root = this.app.vault.getRoot && this.app.vault.getRoot();
    if (!root || !root.children) return false;
    const names = root.children.filter((c) => c instanceof TFolder || c.children).map((c) => c.name);
    return ICOR_MARKERS.every((re) => names.some((n) => re.test(n)));
  }

  applyFirstRunDefaults() {
    if (!this.isIcorVault()) return;
    this.settings.hideRibbon = true;
    this.settings.reduceChrome = true;
    this.firstRunApplied = true;
  }

  /* ------------------------------------------------------------- chrome -- */

  styleSettingsActive() {
    const plugins = this.app.plugins;
    return !!(plugins && plugins.enabledPlugins && plugins.enabledPlugins.has(STYLE_SETTINGS_ID));
  }

  /* Style Settings owns the same five classes when it is installed. Two
     things writing one class on their own schedules is a fight the user
     watches and cannot referee, so this plugin steps aside entirely and the
     settings tab says so. */
  applyChrome() {
    if (this.styleSettingsActive()) return;
    for (const s of SWITCHES) document.body.classList.toggle(s.cls, !!this.settings[s.key]);
  }

  /* ------------------------------------------------------------ folders -- */

  explorerEl() {
    return document.querySelector('.workspace-leaf-content[data-type="file-explorer"]');
  }

  observeExplorer() {
    const explorer = this.explorerEl();
    if (!explorer || this.observer) return;
    /* The explorer rebuilds rows on collapse, expand, rename and vault
       change. Debounced: reapplying is repair work nobody is watching. */
    this.observer = new MutationObserver(() => {
      window.clearTimeout(this.observerTimer);
      this.observerTimer = window.setTimeout(() => this.applyFolders(), 150);
    });
    this.observer.observe(explorer, { childList: true, subtree: true });
  }

  folderConfig(path) {
    return this.settings.folders.find((f) => f.path === path) || null;
  }

  applyFolders() {
    const explorer = this.explorerEl();
    if (!explorer) return;
    for (const row of explorer.querySelectorAll('.nav-folder-title[data-path]')) {
      const cfg = this.folderConfig(row.getAttribute('data-path'));
      if (cfg && cfg.kind) this.claimRow(row, cfg);
      else if (row.hasAttribute(MANAGED)) this.releaseRow(row);
    }
  }

  claimRow(row, cfg) {
    row.setAttribute(MANAGED, '1');
    row.setAttribute(KIND, cfg.kind);
    const set = (prop, value) => {
      if (value) row.style.setProperty(prop, value);
      else row.style.removeProperty(prop);
    };
    if (cfg.kind === 'none') {
      for (const p of PROPS) row.style.removeProperty(p);
      return;
    }
    set('--room-color', cfg.color);
    set('--room-color-paper', cfg.colorPaper);
    set('--room-icon', cfg.icon ? iconUrl(cfg.icon) : null);
    set('--room-label', cfg.kind === 'room' ? JSON.stringify(cfg.label || this.defaultLabel(cfg.path)) : null);
  }

  releaseRow(row) {
    row.removeAttribute(MANAGED);
    row.removeAttribute(KIND);
    for (const p of PROPS) row.style.removeProperty(p);
  }

  /* An edit to a scaffold folder becomes an override: the theme keeps drawing
     the rest of the scaffold, and this row is now the plugin's. Starting from
     the theme's own values, so changing one thing changes one thing. */
  async overrideFolder(defaults, patch) {
    let cfg = this.settings.folders.find((f) => f.path === defaults.path);
    if (!cfg) {
      cfg = Object.assign({}, defaults);
      this.settings.folders.push(cfg);
    }
    Object.assign(cfg, patch);
    await this.saveSettings();
    return cfg;
  }

  async resetFolder(path) {
    const i = this.settings.folders.findIndex((f) => f.path === path);
    if (i >= 0) this.settings.folders.splice(i, 1);
    await this.saveSettings();
  }

  /* The label a room shows when the user gave none: the folder's own name
     with a leading sort prefix ("00 ", "06 ") taken off, which is what the
     theme's defaults do for the ICOR rooms. */
  defaultLabel(path) {
    const name = path.split('/').pop();
    return name.replace(/^\d{2}\s+/, '');
  }
}

/* ----------------------------------------------------- the scaffold list -- */

/* Resolve every SCAFFOLD entry against the live vault: the room is the root
 * folder whose name starts with the prefix, the subfolder is the first folder
 * of that name anywhere under it (the theme keys subfolders on their own
 * name, at any depth). Entries whose folder does not exist are left out - a
 * settings row for a folder that is not there is a row that does nothing. */
function isFolder(node) { return node instanceof TFolder || Array.isArray(node.children); }

function resolveScaffold(app) {
  const root = app.vault.getRoot && app.vault.getRoot();
  if (!root || !root.children) return [];
  const rooms = new Map();
  for (const child of root.children) {
    if (!isFolder(child)) continue;
    const m = /^(\d{2}) /.exec(child.name);
    if (m && !rooms.has(m[1])) rooms.set(m[1], child);
  }
  const findSub = (folder, name) => {
    for (const child of folder.children || []) {
      if (!isFolder(child)) continue;
      if (child.name === name) return child;
      const deeper = findSub(child, name);
      if (deeper) return deeper;
    }
    return null;
  };
  const out = [];
  for (const entry of SCAFFOLD) {
    const room = rooms.get(entry.room);
    if (!room) continue;
    const folder = entry.sub ? findSub(room, entry.sub) : room;
    if (!folder) continue;
    const hue = PALETTE.find((p) => p.key === entry.hue);
    out.push({
      path: folder.path,
      defaults: { path: folder.path, kind: entry.kind, color: hue.ink, colorPaper: hue.paper, icon: entry.icon, label: entry.label || '' },
    });
  }
  return out;
}

/* ------------------------------------------------------------- pickers -- */

class IconPicker extends FuzzySuggestModal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
    this.setPlaceholder('Type to search icons');
  }
  getItems() { return getIconIds(); }
  getItemText(id) { return id.replace(/^lucide-/, ''); }
  renderSuggestion(match, el) {
    el.addClass('icor-if-icon-suggestion');
    const glyph = el.createSpan({ cls: 'icor-if-icon-suggestion-glyph' });
    setIcon(glyph, match.item);
    el.createSpan({ text: this.getItemText(match.item) });
  }
  onChooseItem(id) { this.onPick(id); }
}

class FolderSuggest extends AbstractInputSuggest {
  constructor(app, inputEl, onPick) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.onPick = onPick;
  }
  getSuggestions(query) {
    const q = query.toLowerCase();
    const out = [];
    const walk = (folder) => {
      for (const child of folder.children || []) {
        if (!(child instanceof TFolder) && !child.children) continue;
        if (child.path.toLowerCase().includes(q)) out.push(child.path);
        walk(child);
      }
    };
    walk(this.app.vault.getRoot());
    return out.slice(0, 40);
  }
  renderSuggestion(path, el) { el.setText(path); }
  selectSuggestion(path) {
    this.inputEl.value = path;
    this.onPick(path);
    this.close();
  }
}

/* ------------------------------------------------------------ settings -- */

class IcorInterfaceSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.renderChrome(containerEl);
    this.renderFolders(containerEl);
  }

  renderChrome(containerEl) {
    new Setting(containerEl).setName("Obsidian's interface").setHeading();

    if (this.plugin.styleSettingsActive()) {
      new Setting(containerEl)
        .setName('Style Settings is installed and owns these switches')
        .setDesc('Find the same five under Settings, Style Settings, ICOR for Life - INKLINE. This plugin steps aside so the two never disagree.');
      return;
    }
    for (const s of SWITCHES) {
      if (s.key === 'roomsOff') continue;   /* lives with the folders */
      this.renderSwitch(containerEl, s);
    }
  }

  renderSwitch(containerEl, s) {
    new Setting(containerEl)
      .setName(s.name)
      .setDesc(s.desc)
      .addToggle((t) => t
        .setValue(!!this.plugin.settings[s.key])
        .onChange(async (v) => {
          this.plugin.settings[s.key] = v;
          await this.plugin.saveSettings();
        }));
  }

  renderFolders(containerEl) {
    new Setting(containerEl).setName('Folders').setHeading();

    /* The master switch sits with what it switches. */
    if (!this.plugin.styleSettingsActive()) {
      this.renderSwitch(containerEl, SWITCHES.find((s) => s.key === 'roomsOff'));
    }

    /* --- the user's own additions, first: the thing you came here to do --- */
    const scaffold = resolveScaffold(this.app);
    new Setting(containerEl).setName('Your folders').setHeading();
    new Setting(containerEl)
      .setDesc('Give any other folder a colour and an icon.')
      .addButton((b) => b
        .setButtonText('Add folder')
        .setCta()
        .onClick(async () => {
          this.plugin.settings.folders.push({ path: '', kind: 'family', color: PALETTE[4].ink, colorPaper: PALETTE[4].paper, icon: 'folder', label: '' });
          await this.plugin.saveSettings();
          this.display();
        }));

    const scaffoldPaths = new Set(scaffold.map((s) => s.path));
    for (const cfg of this.plugin.settings.folders) {
      if (scaffoldPaths.has(cfg.path)) continue;   /* shown above, in its place */
      this.renderRow(containerEl, cfg, {
        isOverride: true,
        editablePath: true,
        onChange: async (patch) => { Object.assign(cfg, patch); await this.plugin.saveSettings(); },
        onReset: async () => {
          this.plugin.settings.folders.splice(this.plugin.settings.folders.indexOf(cfg), 1);
          await this.plugin.saveSettings();
        },
      });
    }

    /* --- the scaffold, as the theme draws it, editable --- */
    if (scaffold.length) {
      new Setting(containerEl).setName('ICOR for Life - Scaffold').setHeading();
      new Setting(containerEl)
        .setDesc('The folders the INKLINE theme styles on its own, with the colour and icon it gives each. Change any of them here; the change is stored, the theme keeps drawing the rest. Reset returns a folder to the theme.');
      for (const { path, defaults } of scaffold) {
        const override = this.plugin.folderConfig(path);
        this.renderRow(containerEl, override || defaults, {
          isOverride: !!override,
          onChange: (patch) => this.plugin.overrideFolder(defaults, patch),
          onReset: () => this.plugin.resetFolder(path),
        });
      }
    }

  }

  /* One row per folder, the same for a scaffold folder and a user's own:
     name, kind, icon, hue or two colours, and a reset. Rooms get a second
     line for the label. `onChange` receives a patch; the caller decides
     whether that patch becomes an override or edits an existing entry. */
  renderRow(containerEl, cfg, { isOverride, editablePath = false, onChange, onReset }) {
    /* No wrapper element. INKLINE draws a settings section as one card from
       a RUN OF SIBLING rows; a div around each row breaks the run and every
       row becomes its own card. Rows go straight into the container. */
    const box = containerEl;
    const change = async (patch) => { await onChange(patch); this.display(); };

    const head = new Setting(box)
      .setName(cfg.path || 'New folder')
      .setDesc(isOverride ? (editablePath ? '' : 'Changed from the theme') : 'As the theme draws it');

    if (editablePath) {
      head.addText((t) => {
        t.setPlaceholder('Folder path, e.g. 03 WiP/Clients').setValue(cfg.path)
          .onChange(async (v) => { await onChange({ path: v.trim() }); head.setName(v.trim() || 'New folder'); });
        new FolderSuggest(this.app, t.inputEl, async (path) => { await onChange({ path }); head.setName(path); });
      });
    }

    head.addExtraButton((b) => {
      b.setIcon(cfg.icon || 'folder').setTooltip(`Icon: ${cfg.icon || 'none'}`);
      b.onClick(() => new IconPicker(this.app, (id) => change({ icon: id.replace(/^lucide-/, '') })).open());
    });

    head.addDropdown((d) => {
      d.addOption('', 'Custom colour');
      for (const p of PALETTE) d.addOption(p.key, p.name);
      const current = PALETTE.find((p) => p.ink === cfg.color && p.paper === cfg.colorPaper);
      d.setValue(current ? current.key : '')
        .onChange((v) => { const p = PALETTE.find((x) => x.key === v); if (p) change({ color: p.ink, colorPaper: p.paper }); });
    });
    head.addColorPicker((c) => c.setValue(cfg.color || '#888888').onChange((v) => onChange({ color: v })));
    head.addColorPicker((c) => c.setValue(cfg.colorPaper || cfg.color || '#888888').onChange((v) => onChange({ colorPaper: v })));

    head.addDropdown((d) => {
      for (const [k, label] of KINDS) d.addOption(k, label.split(' - ')[0]);
      d.setValue(cfg.kind || 'family').onChange((v) => change({ kind: v }));
    });

    if (isOverride) {
      head.addExtraButton((b) => b
        .setIcon(editablePath ? 'trash-2' : 'rotate-ccw')
        .setTooltip(editablePath ? 'Remove' : 'Reset to the theme')
        .onClick(async () => { await onReset(); this.display(); }));
    }

    if (cfg.kind === 'room') {
      new Setting(box)
        .setName('Label')
        .setDesc('Shown in place of the folder name. Empty means the name without its sort prefix.')
        .addText((t) => t
          .setPlaceholder(this.plugin.defaultLabel(cfg.path || ''))
          .setValue(cfg.label || '')
          .onChange((v) => onChange({ label: v })));
    }
  }
}

/* Reachable for the gates; not a supported surface for other plugins. */
IcorInterfacePlugin.resolveScaffold = resolveScaffold;

module.exports = IcorInterfacePlugin;
