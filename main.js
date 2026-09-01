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
  const svg = getIcon(iconId);
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

  /* The label a room shows when the user gave none: the folder's own name
     with a leading sort prefix ("00 ", "06 ") taken off, which is what the
     theme's defaults do for the ICOR rooms. */
  defaultLabel(path) {
    const name = path.split('/').pop();
    return name.replace(/^\d{2}\s+/, '');
  }
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
  }

  renderFolders(containerEl) {
    new Setting(containerEl).setName('Folders').setHeading();
    new Setting(containerEl)
      .setDesc("ICOR for Life's seven rooms and their subfolders are styled by the INKLINE theme on their own. Add a folder here to give any folder a colour and an icon, or to change one of the theme's. Only what you add is stored.")
      .addButton((b) => b
        .setButtonText('Add folder')
        .setCta()
        .onClick(async () => {
          this.plugin.settings.folders.push({ path: '', kind: 'family', color: PALETTE[4].ink, colorPaper: PALETTE[4].paper, icon: 'lucide-folder', label: '' });
          await this.plugin.saveSettings();
          this.display();
        }));

    this.plugin.settings.folders.forEach((cfg, index) => this.renderFolder(containerEl, cfg, index));
  }

  renderFolder(containerEl, cfg, index) {
    const save = async () => { await this.plugin.saveSettings(); };
    const box = containerEl.createDiv({ cls: 'icor-if-folder' });

    /* row 1: the folder itself, its kind, and the delete */
    const head = new Setting(box)
      .setName(cfg.path || 'New folder')
      .addText((t) => {
        t.setPlaceholder('Folder path, e.g. 03 WiP/Clients')
          .setValue(cfg.path)
          .onChange(async (v) => { cfg.path = v.trim(); await save(); head.setName(cfg.path || 'New folder'); });
        new FolderSuggest(this.app, t.inputEl, async (path) => { cfg.path = path; await save(); head.setName(path); });
      })
      .addDropdown((d) => {
        for (const [k, label] of KINDS) d.addOption(k, label);
        d.setValue(cfg.kind || 'family')
          .onChange(async (v) => { cfg.kind = v; await save(); this.display(); });
      })
      .addExtraButton((b) => b
        .setIcon('trash-2')
        .setTooltip('Remove')
        .onClick(async () => {
          this.plugin.settings.folders.splice(index, 1);
          await save();
          this.display();
        }));

    if (cfg.kind === 'none') return;

    /* row 2: colour - a palette pick fills both rooms, the pickers take anything */
    new Setting(box)
      .setName('Colour')
      .setDesc('Pick one of the seven ICOR hues, or set the ink and paper colours yourself.')
      .addDropdown((d) => {
        d.addOption('', 'Custom');
        for (const p of PALETTE) d.addOption(p.key, p.name);
        const current = PALETTE.find((p) => p.ink === cfg.color && p.paper === cfg.colorPaper);
        d.setValue(current ? current.key : '')
          .onChange(async (v) => {
            const p = PALETTE.find((x) => x.key === v);
            if (p) { cfg.color = p.ink; cfg.colorPaper = p.paper; await save(); this.display(); }
          });
      })
      .addColorPicker((c) => c
        .setValue(cfg.color || '#888888')
        .onChange(async (v) => { cfg.color = v; await save(); }))
      .addColorPicker((c) => c
        .setValue(cfg.colorPaper || cfg.color || '#888888')
        .onChange(async (v) => { cfg.colorPaper = v; await save(); }));

    /* row 3: icon */
    const iconRow = new Setting(box)
      .setName('Icon')
      .setDesc(cfg.icon ? cfg.icon.replace(/^lucide-/, '') : 'None chosen');
    iconRow.addExtraButton((b) => {
      b.setIcon(cfg.icon || 'folder').setTooltip('Choose an icon');
      b.onClick(() => new IconPicker(this.app, async (id) => {
        cfg.icon = id;
        await save();
        this.display();
      }).open());
    });

    /* row 4: label, rooms only */
    if (cfg.kind === 'room') {
      new Setting(box)
        .setName('Label')
        .setDesc('Shown in place of the folder name. Empty means the name without its sort prefix.')
        .addText((t) => t
          .setPlaceholder(this.plugin.defaultLabel(cfg.path || ''))
          .setValue(cfg.label || '')
          .onChange(async (v) => { cfg.label = v; await save(); }));
    }
  }
}

module.exports = IcorInterfacePlugin;
