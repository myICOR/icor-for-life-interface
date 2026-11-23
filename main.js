/* ICOR Interface
 *
 * The vault's chrome, in one place: which parts of Obsidian's own interface
 * are shown, and which folders carry a colour, an icon and a label.
 *
 * The INKLINE theme owns the look of the chrome. This plugin owns two kinds
 * of DATA the theme reads:
 *
 *   1. Five classes on <body>, one per switch. INKLINE guards the ribbon, the
 *      reduced chrome, the banner, the folder icons and the handwritten layer
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
 * THE ICOR STAGES (0.10.0, the ICOR stages contract, Tom 2026-11-23). The
 * top folders are grouped by ICOR stage, and each stage has one colour:
 * Input 00 Daily Notes, 01 Inbox; Control 02 Inner World, 03 Outer World,
 * 04 Assets, 05 Databases; Output 06 Planner; Refine has no folder. Which
 * folder is in which stage, and the stage's colour, come from the vault's
 * _System/schema.json (`stages`), read once on load and again when the file
 * changes. A schema without `stages` (an older vault's, which still says
 * `rooms`) falls back to BUILTIN_STAGES, the same map. Nothing here is
 * written per folder: a folder's colour is its stage's, its paper colour is
 * derived from that (paperTone), its label is its name minus the number, and
 * only its icon is looked up by name. Folders match by FULL NAME, never by
 * the number in front: a migrated 2.x vault may still hold "06 AI Team",
 * which is not the Output stage's "06 Planner".
 *
 * The theme still colours the same folders on its own when this plugin is
 * not installed (its fallback, rows with no data-icor-kind). With the plugin,
 * the stage folders are claimed here, so the schema decides. What the member
 * CHANGED is the only thing stored, and it wins over the stage colour.
 *
 * Icons come from Obsidian itself: `getIconIds()` lists the ~1,700 Lucide
 * glyphs the app already ships, `getIcon()` hands over the SVG, and this
 * plugin serialises it into the `url("data:image/svg+xml,...")` the theme
 * masks with. No icon set is bundled.
 *
 * Five things carry their own small stylesheet because they must work on
 * any theme: the Outline depth rules, the diagram viewer, the collapsible
 * status bar (one body class, one item in the bar, one round button at the
 * bottom right of the main window, where the bar itself lives), the file
 * explorer's button row (0.11.0: hidden under one body class, its two useful
 * buttons in the left ribbon instead), and the left ribbon. The ribbon's is a fallback and nothing more: the two rules INKLINE
 * already has, under the same `icor-hide-ribbon` class, so the switch still
 * does what it says on another theme. No other switch has CSS here.
 *
 * Hand-written CommonJS, no build step, like the rest of the suite.
 */

'use strict';

const {
  Plugin, PluginSettingTab, Setting, FuzzySuggestModal, AbstractInputSuggest, Modal,
  getIcon, getIconIds, setIcon, setTooltip, Notice, TFolder, Platform,
} = require('obsidian');

/* --------------------------------------------------------------- switches --
 * Each switch is a body class the theme guards on. The CLASS is the contract;
 * the key is what this plugin stores. `on` is what the class means when
 * present, so a switch whose class is a negation ("hide", "off", "no") reads
 * correctly in the settings tab without the user parsing double negatives. */
const SWITCHES = [
  /* Every switch reads as "is this on". The theme's classes do not all point
     the same way - some are present-means-hidden, some present-means-off - so
     `on` says which class state the switch's ON position maps to. The user
     never sees a negative; the class does the negating. */
  {
    key: 'showRibbon', cls: 'icor-hide-ribbon', on: 'absent',
    name: 'Left ribbon',
    desc: 'The thin column of icons on the far left, where every ICOR for Life plugin keeps its icon. Right-click it to reorder or hide single icons.',
  },
  {
    key: 'showControls', cls: 'icor-scaffold-chrome', on: 'absent',
    name: "Obsidian's own file controls",
    desc: "The vault switcher at the bottom of the sidebar, and New note, New folder and Change sort order in the file explorer's button row, while that row is shown.",
  },
  {
    key: 'showBanner', cls: 'icor-hide-banner', on: 'absent',
    name: 'ICOR for Life banner',
    desc: 'The banner above the folder tree.',
  },
  {
    key: 'roomIcons', cls: 'icor-rooms-off', on: 'absent',
    name: 'Folder icons and colours',
    desc: "Folders carry an icon and a colour: each ICOR stage its own (Input, Control, Output), and any folder you give one below. Off, every folder has Obsidian's default look.",
  },
  {
    key: 'handwriting', cls: 'inkline-no-hand', on: 'absent',
    name: 'Handwritten layer',
    desc: 'Blockquotes, note/tip/quote callouts and %%comments%% render in handwriting. Off, they use the body face.',
  },
];

/* Settings written by 0.5.x and earlier used the theme's negative names.
   Each maps to its positive successor by inversion, once, on load. */
const LEGACY_KEYS = {
  hideRibbon: 'showRibbon',
  reduceChrome: 'showControls',
  hideBanner: 'showBanner',
  roomsOff: 'roomIcons',
  noHand: 'handwriting',
};

/* INKLINE's calmed hues, ink and paper, offered beside the stage colours
 * (palette(), below) so a folder can take one in a single pick; the colour
 * picker beside it takes anything else. The data key `room` in KINDS and the
 * `--room-*` properties keep their names: they are what saved settings and
 * the theme read. */
const PALETTE = [
  { key: 'yellow',     name: 'Yellow',     ink: '#c2a35c', paper: '#7f662f' },
  { key: 'terracotta', name: 'Terracotta', ink: '#c2765a', paper: '#9e4526' },
  { key: 'marker',     name: 'Marker',     ink: '#ff5a2d', paper: '#b3401f' },
  { key: 'cyan',       name: 'Cyan',       ink: '#7a99a1', paper: '#4e6b73' },
  { key: 'success',    name: 'Sage',       ink: '#7d9a7f', paper: '#5e7a60' },
  { key: 'burgundy',   name: 'Burgundy',   ink: '#a87795', paper: '#7c5570' },
  { key: 'indigo',     name: 'Indigo',     ink: '#8087a6', paper: '#565e7e' },
  { key: 'rose',       name: 'Rose',       ink: '#b57a86', paper: '#8f5560' },
];

/* ---------------------------------------------------------------- stages --
 * The built-in stage map: exactly the `stages` of a 3.0 schema.json (the ICOR
 * stages contract). Used only when the vault's schema has no `stages`. */
const SCHEMA_PATH = '_System/schema.json';
const BUILTIN_STAGES = {
  input:   { label: 'Input',   color: '#5271FC', folders: ['00 Daily Notes', '01 Inbox'] },
  control: { label: 'Control', color: '#52F49A', folders: ['02 Inner World', '03 Outer World', '04 Assets', '05 Databases'] },
  output:  { label: 'Output',  color: '#FD63FF', folders: ['06 Planner'] },
  refine:  { label: 'Refine',  folders: [], about: 'no folder: the plugins (AI Chat, Connect, Focus) and the weekly review' },
};
/* A vault from before the stage layout (2.x, early 3.0) whose schema has no
 * `stages`: its top folders, by full name, in the stage they became. Never
 * used when the schema has `stages`. Not here, on purpose: "06 AI Team" (a
 * myPKA team) and "03 WiP", which are in no stage. */
const LEGACY_STAGE_FOLDERS = {
  '00 Daily Scratchpad': 'input',
  '02 Planner': 'output',
  '04 Inner World': 'control',
  '05 Assets': 'control',
  '06 Outer World': 'control',
  '07 Databases': 'control',
};
/* The one thing looked up per folder: its icon, by full name (Lucide ids, as
 * Obsidian ships them). A stage folder not listed here gets a plain folder. */
const FOLDER_ICONS = {
  '00 Daily Notes': 'pencil',
  '01 Inbox': 'inbox',
  '02 Inner World': 'sprout',
  '03 Outer World': 'globe',
  '04 Assets': 'package',
  '05 Databases': 'database',
  '06 Planner': 'calendar-range',
  '00 Daily Scratchpad': 'pencil',
  '02 Planner': 'calendar-range',
  '04 Inner World': 'sprout',
  '05 Assets': 'package',
  '06 Outer World': 'globe',
  '07 Databases': 'database',
};
/* Named subfolders, at any depth inside a stage folder, keep their own icon;
 * their colour is the stage's like every other folder in it. */
const SUBFOLDER_ICONS = {
  'Outer World': 'globe',
  'Scanner Inbox': 'scan-line',
  'Contacts': 'users',
  'Journal': 'notebook-pen',
  'My Life': 'heart',
  'Goals': 'target',
  'Habits': 'repeat',
  'Key Elements': 'landmark',
  'Projects': 'folder-kanban',
  'Topics': 'library',
  'Images': 'image',
  'Audio': 'music',
  'Documents': 'file-text',
};

/* The colour a stage colour becomes in the paper room: the same hue, darkened
 * just enough to read at 4.5:1 on INKLINE's paper (#f6f3ec). The stage
 * colours are made for ink; #52F49A on paper is 1.3:1. */
const PAPER_GROUND = [0xf6, 0xf3, 0xec];
function luminance(rgb) {
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}
function paperTone(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const ground = luminance(PAPER_GROUND);
  for (let k = 100; k >= 0; k--) {
    const m = rgb.map((c) => Math.round((c * k) / 100));
    if ((ground + 0.05) / (luminance(m) + 0.05) >= 4.5) return `#${m.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#000000';
}

/* A colour from the schema goes into an inline style, so only a plain hex
 * colour passes; anything else is no colour. */
function hexColor(v) {
  if (typeof v !== 'string') return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

/* The stage map, from a parsed schema.json (or null): every stage with a
 * colour and folders, and for each folder name its stage. `descriptions` is
 * the schema's one line per folder, `folders` or, in an older schema,
 * `rooms`. */
function buildStageMap(schema) {
  const s = schema && typeof schema === 'object' ? schema : {};
  const own = s.stages && typeof s.stages === 'object' && !Array.isArray(s.stages) ? s.stages : null;
  const source = own || BUILTIN_STAGES;
  const stages = [];
  const byFolder = new Map();
  for (const [key, raw] of Object.entries(source)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key) || !raw || !Array.isArray(raw.folders) || !raw.folders.length) continue;
    const color = hexColor(raw.color) || hexColor(BUILTIN_STAGES[key] && BUILTIN_STAGES[key].color);
    if (!color) continue;
    const fallbackLabel = BUILTIN_STAGES[key] ? BUILTIN_STAGES[key].label : key.charAt(0).toUpperCase() + key.slice(1);
    const stage = {
      key,
      label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : fallbackLabel,
      color,
      colorPaper: paperTone(color),
      folders: raw.folders.filter((f) => typeof f === 'string' && f && !f.includes('/')),
    };
    stages.push(stage);
    for (const f of stage.folders) if (!byFolder.has(f)) byFolder.set(f, stage);
  }
  if (!own) {
    for (const [name, key] of Object.entries(LEGACY_STAGE_FOLDERS)) {
      const stage = stages.find((x) => x.key === key);
      if (stage && !byFolder.has(name)) byFolder.set(name, stage);
    }
  }
  const d = s.folders && typeof s.folders === 'object' ? s.folders : (s.rooms && typeof s.rooms === 'object' ? s.rooms : {});
  const descriptions = {};
  for (const [k, v] of Object.entries(d)) if (typeof v === 'string') descriptions[k] = v;
  return { stages, byFolder, descriptions, fromSchema: !!own };
}

/* What a folder looks like because of its stage, or null when it is in none:
 * the top folder itself is drawn as a block with its label; every folder
 * inside it takes the stage's colour, except date folders (/2026/08) and AI
 * Chat session folders (2026-08-30_1312_...), which stay plain, as in the
 * theme. */
function stageLook(stageMap, path) {
  if (!stageMap || typeof path !== 'string' || !path) return null;
  const parts = path.split('/');
  const stage = stageMap.byFolder.get(parts[0]);
  if (!stage) return null;
  if (parts.length === 1) {
    return { stage, defaults: { path, kind: 'room', color: stage.color, colorPaper: stage.colorPaper, icon: FOLDER_ICONS[path] || 'folder', label: path.replace(/^\d{2}\s+/, '') } };
  }
  if (path.includes('/20')) return null;
  const name = parts[parts.length - 1];
  return { stage, defaults: { path, kind: 'family', color: stage.color, colorPaper: stage.colorPaper, icon: SUBFOLDER_ICONS[name] || 'folder', label: '' } };
}

const KINDS = [
  ['room', 'Block - a block with a coloured edge, no arrow, its own label'],
  ['family', 'Family - coloured name and a small icon'],
  ['none', "None - Obsidian's default look, even for a stage folder"],
];

const DEFAULT_SETTINGS = {
  showRibbon: true,
  ribbonBack: true,
  showControls: true,
  showBanner: true,
  roomIcons: true,
  handwriting: true,
  /* [{ path, kind, color, colorPaper, icon, label }] */
  folders: [],
  /* the core Outline: 0 lists every level, 1-6 stop at that nesting depth */
  outlineDepth: 0,
  /* the fullscreen button on rendered mermaid diagrams */
  diagramsEnabled: true,
  /* the status bar folds away to a round button at the bottom right; off
     leaves Obsidian's bar exactly as it is */
  statusBarCollapsible: true,
  /* the fold itself, remembered across reloads */
  statusBarCollapsed: false,
  /* folded, the round button is invisible until the pointer comes near it
     (or it has keyboard focus); off, it is always visible */
  statusBarButtonOnHover: true,
  /* INKLINE's Look: 'gradient' (lit plates and glass) or 'flat' (ink and paper); the theme reads the class */
  look: 'gradient',
  /* _System (schema, templates, skills, tools) in the file tree; hidden by default, it is still there */
  showSystem: false,
  /* the file explorer's own button row (New note, New folder, sort, auto-reveal, collapse); hidden by default, with
     Collapse all and Show the open note in the left ribbon instead (Tom, 2026-11-23) */
  showExplorerButtons: false,
  /* where a note's properties show: 'top' (Obsidian's way), 'collapsed' (on top, folded), 'bottom' (under the note),
     'sidebar' (hidden in notes: Obsidian's own Properties in document: Hidden, and its File properties panel) */
  properties: 'top',
};

/* Before 0.9.0 these three lived in ICOR Objects; its settings are read once, on the first load here. */
const FROM_OBJECTS = ['look', 'showSystem', 'properties'];
const PROPERTY_PLACES = ['top', 'collapsed', 'bottom', 'sidebar'];
const LOOK_CLASSES = { gradient: 'inkline-gradient', flat: 'inkline-flat' };
const HIDE_SYSTEM_CLASS = 'icor-hide-system';
const PROPS_BOTTOM_CLASS = 'icor-props-bottom';
const PROPS_FOLD_CLASS = 'icor-props-folding';

const OUTLINE_DEPTH_PREFIX = 'icor-outline-depth-';

/* The file explorer's button row (0.11.0, Tom 2026-11-23). One body class hides the row (styles.css, any theme); this
   file never names or touches the row itself, so taking the class off gives Obsidian's row back exactly as it was.
   Its two buttons worth having move to the left ribbon, where members reorder or hide them under Settings,
   Appearance, Ribbon menu like any plugin's icon: Collapse all (a toggle, like the host's own button) and reveal the
   open note, which runs Obsidian's own command. */
const EXPLORER_BUTTONS_CLASS = 'icor-hide-explorer-buttons';
const REVEAL_COMMAND = 'file-explorer:reveal-active-file';
const REVEAL_ICON = 'navigation';
const REVEAL_LABEL = 'Show the open note in the file tree';
const COLLAPSE_ICON = 'chevrons-down-up';
const EXPAND_ICON = 'chevrons-up-down';
const COLLAPSE_LABEL = 'Collapse all folders';
const EXPAND_LABEL = 'Expand all folders';

/* The collapsible status bar. The two body classes are what styles.css
   guards on: the fold, and the hover reveal of the round button. The three
   element classes name the item at the bar's left edge, the round button
   that stands in for the bar while it is folded, and the zone around that
   button: a larger, transparent hit area anchored to the corner, so the
   button shows before the pointer is on it. The zone is the hit area only;
   the click lives on the button. */
const STATUS_COLLAPSED_CLASS = 'icor-status-bar-collapsed';
const STATUS_HOVER_CLASS = 'icor-status-bar-hover-reveal';
const STATUS_ITEM_CLASS = 'icor-status-bar-collapse';
const STATUS_FAB_CLASS = 'icor-status-bar-expand';
const STATUS_ZONE_CLASS = 'icor-status-bar-zone';

/* The bar sits at the bottom RIGHT and unfolds toward the LEFT, so the
   glyphs point the way the bar moves: folded, the round button points left
   (unfold that way); unfolded, the item points right (fold back that way).
   Lucide's `panel-right-open` / `panel-right-close` exist and their inner
   chevrons point the same ways, but the glyph is a side panel, the same
   picture Obsidian uses for its sidebars, and at 14px inside a 22px button
   its chevron is three units wide. The plain chevrons say one thing. */
const STATUS_FAB_ICON = 'chevron-left';
const STATUS_ITEM_ICON = 'chevron-right';
const STATUS_FAB_LABEL = 'Unfold status bar to the left';
const STATUS_ITEM_LABEL = 'Fold status bar to the right';

/* The two folders that make a vault an ICOR for Life vault. Present together
 * at the root, and this plugin has never saved anything, ICOR for Life's own
 * defaults apply on first run: ribbon hidden, chrome reduced. Number prefixes
 * here on purpose: every layout (2.x, 3.0, the stage layout) has a 00 and a
 * 06, and this only asks "is it ICOR", never which folder is which. Everyone else
 * starts with nothing hidden, because a plugin that removes navigation from
 * a vault it was just installed into has broken that vault. */
const ICOR_MARKERS = [/^00 /, /^06 /];

const INKLINE_THEME = 'ICOR for Life - INKLINE';
const STYLE_SETTINGS_ID = 'obsidian-style-settings';
const MANAGED = 'data-icor-managed';
const KIND = 'data-icor-kind';
const STAGE_ATTR = 'data-icor-stage';
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, this.migrate(saved || {}));
    this.settings.folders = Array.isArray(this.settings.folders) ? this.settings.folders : [];
    if (saved === null || saved === undefined) this.applyFirstRunDefaults();
    /* A ribbon an earlier first run hid (when the launchers sat in the file tree) comes back once: the launchers live
       there now. Whatever the member sets after that stays. */
    else if (!saved.ribbonBack) {
      this.settings.showRibbon = true;
      this.settings.ribbonBack = true;
      await this.saveData(this.settings);
    }
    if (!saved || FROM_OBJECTS.some((k) => !(k in saved))) await this.importFromObjects(saved || {});
    if (this.nativeProperties() === 'hidden' && this.settings.properties !== 'sidebar') this.settings.properties = 'sidebar';
    /* The stage map, once; again only when _System/schema.json changes. */
    await this.loadStages();
    const onSchema = (f) => {
      if (f && f.path === SCHEMA_PATH) void this.loadStages().then(() => this.applyFolders());
    };
    if (this.app.vault && typeof this.app.vault.on === 'function') {
      for (const ev of ['modify', 'create', 'delete']) this.registerEvent(this.app.vault.on(ev, onSchema));
    }

    this.addSettingTab(new IcorInterfaceSettingTab(this.app, this));

    /* Only offered while the status bar is collapsible: a hotkey that does
       nothing is worse than a command that is not there. */
    this.addCommand({
      id: 'toggle-status-bar',
      name: 'Toggle status bar',
      checkCallback: (checking) => {
        if (!this.statusBarFeatureActive()) return false;
        if (!checking) this.toggleStatusBar();
        return true;
      },
    });

    /* Same shape as the status-bar command and for the same reason: with the
       core File explorer turned off there is no leaf to flip, so the command
       withdraws rather than offering a hotkey that does nothing. */
    this.addCommand({
      id: 'toggle-auto-reveal',
      name: 'Toggle auto-reveal current file in the file explorer',
      checkCallback: (checking) => {
        if (this.autoRevealState() === null) return false;
        if (!checking) this.toggleAutoReveal();
        return true;
      },
    });

    /* The file explorer's two buttons, in the ribbon. The ribbon item keeps the name it was added with (that is what
       the Ribbon menu lists); only its icon and tooltip follow the tree, the way the host's own button does. */
    this.collapseRibbonEl = this.addRibbonIcon(COLLAPSE_ICON, COLLAPSE_LABEL, () => { void this.toggleCollapseAll({ fromRibbon: true }); });
    this.addRibbonIcon(REVEAL_ICON, REVEAL_LABEL, () => this.revealActiveFile());
    /* Reveal has its command already: Obsidian's own, "Reveal current file in navigation". Collapse has none in the
       host, so it gets one here; it withdraws when there is no tree to fold. */
    this.addCommand({
      id: 'collapse-all-folders',
      name: 'Collapse or expand all folders in the file tree',
      checkCallback: (checking) => {
        if (!this.fileExplorerLeaf()) return false;
        if (!checking) void this.toggleCollapseAll();
        return true;
      },
    });

    this.addCommand({
      id: 'toggle-look', name: 'Switch the look between flat and gradient',
      callback: async () => { this.settings.look = this.settings.look === 'flat' ? 'gradient' : 'flat'; await this.saveSettings(); },
    });
    this.addCommand({
      id: 'show-file-properties', name: "Show the note's properties in the right sidebar",
      callback: () => { void this.showPropertiesPanel(true); },
    });
    this.addCommand({
      id: 'toggle-system', name: 'Show or hide _System in the file tree',
      callback: async () => { this.settings.showSystem = !this.settings.showSystem; await this.saveSettings(); },
    });

    /* Properties folded on top: each note opens with them folded, once (unfolding it stays unfolded while it is
       open), and the whole bar folds and unfolds, not only its little arrow. */
    this.registerEvent(this.app.workspace.on('file-open', () => window.setTimeout(() => this.foldProperties(), 0)));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.foldProperties()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.countProperties()));
    /* A mouse click on the properties bar leaves Obsidian's toggle holding the focus, and the theme draws the focus
       ring for it as if the keyboard had moved there: let go of it after a click (a key press keeps its ring). */
    this.registerDomEvent(document, 'click', (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function' || !e.detail || !t.closest('.metadata-container')) return;
      window.setTimeout(() => {
        const a = document.activeElement;
        if (a && typeof a.closest === 'function' && a.closest('.metadata-properties-heading') && typeof a.blur === 'function') a.blur();
      }, 0);
    });
    this.registerDomEvent(document, 'click', (e) => {
      const t = e.target;
      if (!t || typeof t.closest !== 'function' || !document.body.classList.contains(PROPS_FOLD_CLASS)) return;
      const box = t.closest('.metadata-container');
      if (!box || !box.classList.contains('is-collapsed') || t.closest('.metadata-properties-heading')) return;
      const head = box.querySelector('.metadata-properties-heading');
      if (head) head.click();
    });

    this.app.workspace.onLayoutReady(() => {
      this.applyChrome();
      this.syncCollapseRibbon();
      this.foldProperties();
      this.applyFolders();
      this.observeExplorer();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.applyChrome();
      this.syncCollapseRibbon();
      this.applyFolders();
      this.observeExplorer();
    }));

    /* Diagrams. Registered once; the switch is checked at wire time, because
       a post processor cannot be unregistered. Reading view: Obsidian's own
       processor swaps the code block for <div class="mermaid"><svg> after a
       promise, so the section is polled briefly for the svg. Live preview:
       the cm-embed-block widget renders mermaid through its own path and
       never runs plugin post processors, so a pointerover delegation catches
       those blocks on first hover. */
    this.registerMarkdownPostProcessor((el) => {
      if (!this.settings.diagramsEnabled) return;
      if (!el.querySelector('code.language-mermaid, .mermaid')) return;
      this.waitAndWireDiagram(el, 0);
    });
    this.registerDomEvent(document, 'pointerover', (e) => {
      if (!this.settings.diagramsEnabled) return;
      const t = e.target && typeof e.target.closest === 'function' ? e.target.closest('.mermaid') : null;
      if (t) this.wireDiagram(t);
    });
  }

  onunload() {
    if (this.observer) this.observer.disconnect();
    this.observer = null;
    /* Everything this plugin wrote comes off on the way out: the body
       classes, and every row it claimed. Left behind, the theme would keep
       rendering a configuration nobody can edit any more. */
    for (const s of SWITCHES) document.body.classList.remove(s.cls);
    document.body.classList.remove(...Object.values(LOOK_CLASSES), HIDE_SYSTEM_CLASS, PROPS_BOTTOM_CLASS, PROPS_FOLD_CLASS, EXPLORER_BUTTONS_CLASS);
    this.applyOutline(0);
    this.teardownStatusBar();
    for (const row of document.querySelectorAll(`[${MANAGED}]`)) this.releaseRow(row);
    this.removeDiagramButtons();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyChrome();
    this.applyFolders();
    if (!this.settings.diagramsEnabled) this.removeDiagramButtons();
  }

  /* Old negative keys become their positive successors by inversion. The
     old key is dropped so the file never carries both answers. */
  migrate(saved) {
    const out = Object.assign({}, saved);
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      if (oldKey in out) {
        if (!(newKey in out)) out[newKey] = !out[oldKey];
        delete out[oldKey];
      }
    }
    for (const k of ['tocEnabled', 'tocSticky', 'tocDepth']) delete out[k];
    return out;
  }

  /* ---------------------------------------------------------- first run -- */

  isIcorVault() {
    const root = this.app.vault.getRoot && this.app.vault.getRoot();
    if (!root || !root.children) return false;
    const names = root.children.filter((c) => c instanceof TFolder || c.children).map((c) => c.name);
    return ICOR_MARKERS.every((re) => names.some((n) => re.test(n)));
  }

  /* The three settings Objects held before 0.9.0, taken once from its saved settings; what this plugin already has
     wins. Objects stops writing them, so the two can never disagree after this. */
  async importFromObjects(saved) {
    const adapter = this.app.vault.adapter;
    if (!adapter || typeof adapter.exists !== 'function') return;
    try {
      const path = `${this.app.vault.configDir}/plugins/icor-for-life-objects/data.json`;
      if (!(await this.app.vault.adapter.exists(path))) return;
      const o = JSON.parse(await this.app.vault.adapter.read(path)) || {};
      let changed = false;
      for (const k of FROM_OBJECTS) if (!(k in saved) && k in o) { this.settings[k] = o[k]; changed = true; }
      if (!PROPERTY_PLACES.includes(this.settings.properties)) this.settings.properties = 'top';
      if (changed) await this.saveData(this.settings);
    } catch (e) { console.warn('ICOR Interface: the settings from Objects could not be read', e); }
  }

  /* Every ICOR for Life plugin keeps its launcher in Obsidian's ribbon (Tom, 2026-11-23), and nothing reroutes the
     file controls any more: a first run hides neither, in any vault. */
  applyFirstRunDefaults() {
    if (!this.isIcorVault()) return;
    this.firstRunApplied = true;
  }

  /* ------------------------------------------------------------- chrome -- */

  styleSettingsActive() {
    const plugins = this.app.plugins;
    return !!(plugins && plugins.enabledPlugins && plugins.enabledPlugins.has(STYLE_SETTINGS_ID));
  }

  /* The active theme's name, '' for Obsidian's default, null when this build
     does not say. Neither read is in obsidian.d.ts, so both are checked. */
  activeThemeName() {
    const { vault, customCss } = this.app;
    const config = vault && typeof vault.getConfig === 'function' ? vault.getConfig('cssTheme') : undefined;
    if (typeof config === 'string') return config;
    return customCss && typeof customCss.theme === 'string' ? customCss.theme : null;
  }

  /* Said in the switch's own description, never in a notice. Empty unless
     the ribbon is hidden and the theme is known not to be INKLINE. */
  ribbonThemeHint() {
    if (this.settings.showRibbon) return '';
    const theme = this.activeThemeName();
    if (theme === null || theme === INKLINE_THEME) return '';
    return "INKLINE is not the active theme, so this plugin's own fallback rule is hiding the ribbon. The rest of the ICOR for Life look needs INKLINE, under Settings, Appearance.";
  }

  /* Style Settings owns the same five classes when it is installed. Two
     things writing one class on their own schedules is a fight the user
     watches and cannot referee, so this plugin steps aside entirely and the
     settings tab says so. */
  applyChrome() {
    this.applyOutline(this.settings.outlineDepth);
    this.applyStatusBar();
    this.applyNotes();
    /* Not a theme class: this plugin's, whoever owns the five switches below. */
    document.body.classList.toggle(EXPLORER_BUTTONS_CLASS, !this.settings.showExplorerButtons);
    if (this.styleSettingsActive()) return;
    for (const s of SWITCHES) {
      const on = !!this.settings[s.key];
      document.body.classList.toggle(s.cls, s.on === 'present' ? on : !on);
    }
  }

  /* The Look, _System and the properties: classes on <body>. The Look is the theme's (INKLINE reads the class; Style
     Settings can set it too, whichever ran last wins); _System and the properties work on any theme (styles.css). */
  applyNotes() {
    const b = document.body.classList;
    const look = this.settings.look === 'flat' ? 'flat' : 'gradient';
    for (const [k, cls] of Object.entries(LOOK_CLASSES)) b.toggle(cls, k === look);
    b.toggle(HIDE_SYSTEM_CLASS, !this.settings.showSystem);
    b.toggle(PROPS_BOTTOM_CLASS, this.settings.properties === 'bottom');
    b.toggle(PROPS_FOLD_CLASS, this.settings.properties === 'collapsed');
    this.syncNativeProperties();
    this.foldProperties();
  }

  /* "Hidden in notes" is Obsidian's own switch (Settings, Editor, Properties in document), so it is set there, not
     imitated: Hidden while this plugin says sidebar, back to Visible when it says anything else (only if Obsidian is
     on Hidden, so its Source mode is left alone). The note's properties then live in the File properties panel. */
  nativeProperties() {
    const v = this.app.vault.getConfig ? this.app.vault.getConfig('propertiesInDocument') : null;
    return typeof v === 'string' ? v : 'visible';
  }

  syncNativeProperties() {
    if (!this.app.vault.setConfig) return;
    const native = this.nativeProperties();
    if (this.settings.properties === 'sidebar') {
      if (native !== 'hidden') this.app.vault.setConfig('propertiesInDocument', 'hidden');
      this.app.workspace.onLayoutReady(() => { void this.showPropertiesPanel(false); });
    } else if (native === 'hidden') {
      this.app.vault.setConfig('propertiesInDocument', 'visible');
    }
  }

  /* Obsidian's File properties panel (the open note's properties; "All properties" is the vault's list) in the right
     sidebar: made if it is not there, brought forward when asked. */
  async showPropertiesPanel(reveal) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType('file-properties')[0];
    if (!leaf) {
      leaf = ws.getRightLeaf(false);
      if (!leaf) return;
      await leaf.setViewState({ type: 'file-properties', active: false });
      reveal = true;
    }
    if (reveal) await ws.revealLeaf(leaf);
  }

  /* Folds the properties of every open note once per note, through Obsidian's own toggle so it keeps its state, and
     hands the keyboard back to the note (the toggle takes focus, and the theme would draw a focus ring). */
  foldProperties() {
    if (this.settings.properties !== 'collapsed') return;
    if (!this.folded) this.folded = new WeakMap();
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!view || !view.file || view.getViewType() !== 'markdown') return;
      const box = view.containerEl.querySelector('.metadata-container');
      if (!box || this.folded.get(box) === view.file.path) return;
      this.folded.set(box, view.file.path);
      if (!box.classList.contains('is-collapsed')) {
        const head = box.querySelector('.metadata-properties-heading');
        if (head) head.click();
        if (box.contains(document.activeElement) && view.editor) view.editor.focus();
      }
    });
    this.countProperties();
  }

  /* How many properties a folded bar holds, shown at its right end. */
  countProperties() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (!view || !view.file || view.getViewType() !== 'markdown') return;
      const head = view.containerEl.querySelector('.metadata-properties-heading');
      if (!head) return;
      const fm = (this.app.metadataCache.getFileCache(view.file) || {}).frontmatter || {};
      const n = Object.keys(fm).filter((k) => k !== 'position').length;
      head.setAttribute('data-icor-count', n ? String(n) : '');
    });
  }

  /* The core Outline has no API, but it is a tree of nested .tree-item
     elements, and a body class plus one CSS rule per depth is enough to stop
     it at a nesting level. 0 means every level. Only ever one depth class on
     body at a time. */
  applyOutline(depth) {
    const d = Math.max(0, Math.min(6, Number(depth) || 0));
    for (const cls of [...document.body.classList]) {
      if (cls.startsWith(OUTLINE_DEPTH_PREFIX)) document.body.classList.remove(cls);
    }
    if (d > 0) document.body.classList.add(OUTLINE_DEPTH_PREFIX + d);
  }

  /* --------------------------------------------------------- status bar --
     Obsidian docks the status bar at the bottom right of the MAIN window;
     pop-out windows have none, so there is nothing to fold there and the
     round button exists only in the main window. Mobile has no status bar
     either, and the feature stays out of the way there entirely. */

  statusBarFeatureActive() {
    return !!this.settings.statusBarCollapsible && !Platform.isMobile;
  }

  statusBarEl() {
    return document.querySelector('.status-bar');
  }

  /* Idempotent: called on layout-ready, on every layout change and after
     every save. Builds the two controls once, then only moves the class. */
  applyStatusBar() {
    const bar = this.statusBarEl();
    if (!this.statusBarFeatureActive() || !bar) { this.teardownStatusBar(); return; }

    if (!this.statusItem || !this.statusItem.parentElement) {
      const item = this.addStatusBarItem();
      item.addClass('mod-clickable');
      item.addClass(STATUS_ITEM_CLASS);
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', STATUS_ITEM_LABEL);
      item.setAttribute('data-tooltip-position', 'top');
      setIcon(item, STATUS_ITEM_ICON);
      item.addEventListener('click', () => this.toggleStatusBar());
      item.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        this.toggleStatusBar();
      });
      /* The left edge: everything else in the bar is appended after it. */
      bar.prepend(item);
      this.statusItem = item;
    }

    if (!this.statusFab || !this.statusFab.parentElement) {
      const zone = document.body.createDiv({ cls: STATUS_ZONE_CLASS });
      const fab = zone.createEl('button', {
        cls: STATUS_FAB_CLASS,
        attr: { 'aria-label': STATUS_FAB_LABEL, 'data-tooltip-position': 'top', type: 'button' },
      });
      setIcon(fab, STATUS_FAB_ICON);
      fab.addEventListener('click', () => this.toggleStatusBar());
      this.statusZone = zone;
      this.statusFab = fab;
    }

    document.body.classList.toggle(STATUS_COLLAPSED_CLASS, !!this.settings.statusBarCollapsed);
    document.body.classList.toggle(STATUS_HOVER_CLASS, !!this.settings.statusBarButtonOnHover);
  }

  /* Everything the feature put in place comes off: the classes, the item,
     the zone with its button. Obsidian's own bar is exactly as it was. */
  teardownStatusBar() {
    document.body.classList.remove(STATUS_COLLAPSED_CLASS);
    document.body.classList.remove(STATUS_HOVER_CLASS);
    if (this.statusItem) this.statusItem.remove();
    if (this.statusZone) this.statusZone.remove();
    this.statusItem = null;
    this.statusZone = null;
    this.statusFab = null;
  }

  async toggleStatusBar() {
    this.settings.statusBarCollapsed = !this.settings.statusBarCollapsed;
    await this.saveSettings();
    /* The control that was just used disappears; focus follows the fold so
       a keyboard user is never left on a hidden element. */
    const next = this.settings.statusBarCollapsed ? this.statusFab : this.statusItem;
    if (next && typeof next.focus === 'function') next.focus();
  }

  /* -------------------------------------------------------- auto-reveal --
   * "Auto-reveal current file" is Obsidian's own switch: with it on, opening
   * a note highlights it in the folder tree. The host offers exactly one way
   * to flip it - a button on the file-explorer toolbar - and registers no
   * command for it, so it cannot be bound to a hotkey and cannot be reached
   * from the command palette. Measured against the Obsidian 1.13.7 bundle on
   * 2026-09-17: eight `file-explorer:` command ids and not one touches
   * autoReveal. A suite that reduces that toolbar has to put the switch back
   * somewhere, and this plugin is where the host's own controls live.
   *
   * THE STATE IS NOT COPIED INTO data.json, and that is the design. It
   * belongs to Obsidian's workspace layout, which is where the host reads it
   * from on the next start; a second copy here would be a second writer on
   * one setting, the same fight `applyChrome` steps out of when Style
   * Settings is installed. So this reads and writes the live leaf and keeps
   * nothing.
   *
   * Through the public leaf API only: `getViewState()` to read, and
   * `setViewState()` with the SAME view type to write, which the host
   * forwards straight to the view's `setState` without rebuilding the view -
   * so the tree keeps its scroll position and its open folders. `active` is
   * deliberately absent from the object: it would pull focus into the
   * sidebar, and this command is meant to be usable from the note you are
   * writing. `requestSaveLayout` is the host's own call for "this is worth
   * persisting", and it is needed because a same-type setViewState does not
   * trigger a layout save on its own. */
  fileExplorerLeaf() {
    const ws = this.app.workspace;
    const leaves = ws && typeof ws.getLeavesOfType === 'function'
      ? ws.getLeavesOfType('file-explorer') : null;
    return (leaves && leaves.length) ? leaves[0] : null;
  }

  /* true, false, or null for "there is nothing to ask". The three answers are
     distinct on purpose: null is what makes the command withdraw instead of
     reporting a state it invented.

     THE KEY IS THE CAPABILITY PROBE, not a default. Auto-reveal arrived in
     Obsidian 1.8.3 (desktop, 2025-01-30) and this manifest floors at 1.5.0,
     because every API used here predates that and raising the floor would shut
     members out of the whole plugin for one toggle. On 1.5.0 to 1.8.2 the file
     explorer emits no `autoReveal` and ignores one on write, so reading an
     absent key as `false` would offer a switch that writes nowhere and a
     notice that says ON while nothing happened. From 1.8.3 the host always
     emits it as a boolean, so `typeof === 'boolean'` is an exact probe for
     "this Obsidian has the setting". (Flint, review of 0.7.0, 2026-09-17.) */
  autoRevealState() {
    const leaf = this.fileExplorerLeaf();
    if (!leaf || typeof leaf.getViewState !== 'function') return null;
    const view = leaf.getViewState();
    const state = (view && view.state) || {};
    return typeof state.autoReveal === 'boolean' ? state.autoReveal : null;
  }

  async setAutoReveal(on) {
    const leaf = this.fileExplorerLeaf();
    if (!leaf || typeof leaf.getViewState !== 'function') return null;
    const view = leaf.getViewState();
    await leaf.setViewState({
      type: view.type,
      state: Object.assign({}, view.state, { autoReveal: !!on }),
    });
    const ws = this.app.workspace;
    if (ws && typeof ws.requestSaveLayout === 'function') ws.requestSaveLayout();
    return !!on;
  }

  /* The notice names the state it landed in rather than the act, because
     "Toggled auto-reveal" leaves the user to guess which way it went. */
  async toggleAutoReveal() {
    const current = this.autoRevealState();
    if (current === null) return null;
    const next = await this.setAutoReveal(!current);
    if (next === null) return null;
    new Notice(`Auto-reveal current file is ${next ? 'ON' : 'OFF'}`);
    return next;
  }

  /* ------------------------------------------------ the explorer's buttons --
   * Collapse all is the file tree's own toggle: `tree.setCollapseAll()`, the
   * method the host's button calls (Obsidian 1.15.1 bundle, 2026-11-23), so the
   * folds are saved and the host's button, when shown, flips with it. Not in
   * obsidian.d.ts, so it is probed, never assumed; a sidebar Obsidian has not
   * loaded yet (a deferred view) is loaded first. Reveal is Obsidian's own
   * command, run by id. Neither touches the row. */
  async explorerTree() {
    const leaf = this.fileExplorerLeaf();
    if (!leaf) return null;
    if (leaf.isDeferred && typeof leaf.loadIfDeferred === 'function') {
      await leaf.loadIfDeferred();
      this.treeWasDeferred = true;
    }
    const tree = leaf.view && leaf.view.tree;
    return tree && typeof tree.setCollapseAll === 'function' ? tree : null;
  }

  /* A press does what the icon said. Normally that is the tree's own state; but a tree Obsidian had not loaded yet
     (a sidebar tab never shown since start) could not tell the icon anything, so on the press that loads it the
     icon's word wins, and from then on the two agree. */
  async toggleCollapseAll({ fromRibbon = false } = {}) {
    this.treeWasDeferred = false;
    const tree = await this.explorerTree();
    if (tree && fromRibbon && this.treeWasDeferred && this.collapseRibbonEl) {
      const fold = this.collapseRibbonEl.getAttribute('aria-label') !== EXPAND_LABEL;
      if (!!tree.isAllCollapsed === fold) tree.isAllCollapsed = !fold;
    }
    if (!tree) {
      new Notice(this.fileExplorerLeaf()
        ? "This Obsidian's file tree cannot be folded from here. Turn on Obsidian's file explorer buttons in ICOR Interface's settings and use its own button."
        : 'The file tree is turned off: Settings, Core plugins, File explorer.');
      return null;
    }
    tree.setCollapseAll(!tree.isAllCollapsed);
    this.syncCollapseRibbon(tree);
    return !!tree.isAllCollapsed;
  }

  /* The ribbon icon says what a press will do, as the host's button does: all folded, it offers to expand. */
  syncCollapseRibbon(tree) {
    const el = this.collapseRibbonEl;
    if (!el) return;
    if (tree === undefined) {
      const leaf = this.fileExplorerLeaf();
      tree = leaf && leaf.view && leaf.view.tree;
    }
    const folded = !!(tree && tree.isAllCollapsed);
    setIcon(el, folded ? EXPAND_ICON : COLLAPSE_ICON);
    const label = folded ? EXPAND_LABEL : COLLAPSE_LABEL;
    if (typeof setTooltip === 'function') setTooltip(el, label);
    else el.setAttribute('aria-label', label);
  }

  revealActiveFile() {
    const cmds = this.app.commands;
    const ran = !!(cmds && typeof cmds.executeCommandById === 'function' && cmds.executeCommandById(REVEAL_COMMAND));
    if (ran) return true;
    const ws = this.app.workspace;
    const file = ws && typeof ws.getActiveFile === 'function' ? ws.getActiveFile() : null;
    new Notice(file ? 'The file tree is turned off: Settings, Core plugins, File explorer.' : 'Open a note first, then this shows it in the file tree.');
    return false;
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

  /* Read _System/schema.json and build the stage map. No schema, a schema
     that is not JSON, or one without `stages`: the built-in map. */
  async loadStages() {
    let schema = null;
    const adapter = this.app.vault && this.app.vault.adapter;
    try {
      if (adapter && typeof adapter.exists === 'function' && await adapter.exists(SCHEMA_PATH)) {
        schema = JSON.parse(await adapter.read(SCHEMA_PATH));
      }
    } catch (e) {
      console.warn('ICOR Interface: _System/schema.json could not be read; using the built-in stage colours', e);
      schema = null;
    }
    this.stageMap = buildStageMap(schema);
    this.iconCache = new Map();
    return this.stageMap;
  }

  stageLook(path) {
    if (!this.stageMap) this.stageMap = buildStageMap(null);
    return stageLook(this.stageMap, path);
  }

  /* The member's own settings for a folder win; otherwise its stage decides. */
  applyFolders() {
    const explorer = this.explorerEl();
    if (!explorer) return;
    for (const row of explorer.querySelectorAll('.nav-folder-title[data-path]')) {
      const path = row.getAttribute('data-path');
      const look = this.stageLook(path);
      const cfg = this.folderConfig(path);
      if (cfg && cfg.kind) this.claimRow(row, cfg, look && look.stage);
      else if (look) this.claimRow(row, look.defaults, look.stage);
      else if (row.hasAttribute(MANAGED)) this.releaseRow(row);
    }
  }

  icon(id) {
    if (!id) return null;
    if (!this.iconCache) this.iconCache = new Map();
    if (!this.iconCache.has(id)) this.iconCache.set(id, iconUrl(id));
    return this.iconCache.get(id);
  }

  claimRow(row, cfg, stage) {
    row.setAttribute(MANAGED, '1');
    row.setAttribute(KIND, cfg.kind);
    if (stage) row.setAttribute(STAGE_ATTR, stage.key);
    else row.removeAttribute(STAGE_ATTR);
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
    set('--room-icon', cfg.icon ? this.icon(cfg.icon) : null);
    set('--room-label', cfg.kind === 'room' ? JSON.stringify(cfg.label || this.defaultLabel(cfg.path)) : null);
  }

  releaseRow(row) {
    row.removeAttribute(MANAGED);
    row.removeAttribute(KIND);
    row.removeAttribute(STAGE_ATTR);
    for (const p of PROPS) row.style.removeProperty(p);
  }

  /* An edit to a stage folder becomes an override: the other folders keep
     their stage colour, and this row is now the member's. Starting from the
     stage's own values, so changing one thing changes one thing. */
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

  /* The label a block shows when the user gave none: the folder's own name
     with a leading sort prefix ("00 ", "06 ") taken off, which is what the
     theme's defaults do for the stage folders. */
  palette() {
    const stages = (this.stageMap || buildStageMap(null)).stages
      .map((st) => ({ key: `stage-${st.key}`, name: `${st.label} (ICOR stage)`, ink: st.color, paper: st.colorPaper }));
    return stages.concat(PALETTE);
  }

  defaultLabel(path) {
    const name = path.split('/').pop();
    return name.replace(/^\d{2}\s+/, '');
  }
}

/* --------------------------------------------------------------- diagrams --
 * Was ICOR for Life - Diagrams (0.1.x), a plugin of exactly this: every
 * rendered mermaid block gets a small maximize button next to Obsidian's own
 * edit affordance, and clicking it opens the diagram edge to edge with wheel
 * zoom around the cursor, drag panning, two-finger pinch, and a double-click
 * reset. Folded in here on 2026-09-03 because a plugin with no settings, no
 * state and one button is a switch, and this is where the switches live.
 *
 * The class names are the old plugin's on purpose. Both guard on the same
 * `.icor-diag-btn` before adding one, so a vault that still runs the old
 * plugin beside this one gets exactly one button, whichever wires first.
 *
 * The zoom/pan math: world = (screen - center - pan) / zoom, and every zoom
 * change re-anchors the pan so the point under the cursor stays under it. */

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 8;

class DiagramModal extends Modal {
  constructor(app, svg) {
    super(app);
    this.srcSvg = svg;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.pointers = new Map();
    this.pinch = null;
    this.drag = null;
    this.cleanup = [];
  }

  listen(el, type, fn, opts) {
    el.addEventListener(type, fn, opts);
    this.cleanup.push(() => el.removeEventListener(type, fn, opts));
  }

  onOpen() {
    this.containerEl.addClass('icor-diag-container');
    this.modalEl.addClass('icor-diag-modal');
    const c = this.contentEl;
    c.addClass('icor-diag-content');

    this.stage = c.createDiv('icor-diag-stage');
    /* the holder keeps class "mermaid" so Obsidian's own dark-mode rule
       (.theme-dark .mermaid > svg { filter: invert(...) }) applies in here too */
    this.holder = this.stage.createDiv('mermaid icor-diag-holder');

    const svg = this.srcSvg.cloneNode(true);
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const rect = this.srcSvg.getBoundingClientRect();
    this.natW = (vb && vb.width) || rect.width || 600;
    this.natH = (vb && vb.height) || rect.height || 400;
    svg.setAttribute('width', String(this.natW));
    svg.setAttribute('height', String(this.natH));
    /* Mermaid caps the drawing with an inline max-width; clear it and let
       styles.css (.icor-diag-holder > svg) lift the cap. */
    svg.style.maxWidth = '';
    this.holder.style.width = this.natW + 'px';
    this.holder.style.height = this.natH + 'px';
    this.holder.appendChild(svg);

    c.createDiv({ cls: 'icor-diag-kicker', text: 'DIAGRAM' });

    const controls = c.createDiv('icor-diag-controls');
    const btn = (icon, label, fn) => {
      const b = controls.createEl('button', { cls: 'icor-diag-ctl', attr: { 'aria-label': label } });
      setIcon(b, icon);
      this.listen(b, 'click', fn);
    };
    btn('minus', 'Zoom out', () => this.zoomBy(1 / 1.3));
    btn('plus', 'Zoom in', () => this.zoomBy(1.3));
    btn('rotate-ccw', 'Reset view', () => this.fit());

    this.wirePointer();
    this.listen(c, 'keydown', (e) => {
      if (e.key === '+' || e.key === '=') this.zoomBy(1.3);
      else if (e.key === '-') this.zoomBy(1 / 1.3);
      else if (e.key === '0') this.fit();
      else if (e.key.startsWith('Arrow')) {
        const step = 60;
        if (e.key === 'ArrowLeft') this.pan.x += step;
        if (e.key === 'ArrowRight') this.pan.x -= step;
        if (e.key === 'ArrowUp') this.pan.y += step;
        if (e.key === 'ArrowDown') this.pan.y -= step;
        this.apply();
      } else return;
      e.preventDefault();
    });

    window.requestAnimationFrame(() => this.fit());
  }

  onClose() {
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    this.contentEl.empty();
  }

  toWorld(px, py) {
    const rect = this.stage.getBoundingClientRect();
    const cx = rect.width / 2 + this.pan.x;
    const cy = rect.height / 2 + this.pan.y;
    return { x: (px - cx) / this.zoom, y: (py - cy) / this.zoom };
  }

  clampZoom(z) { return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)); }

  zoomBy(factor, px, py) {
    const rect = this.stage.getBoundingClientRect();
    if (px == null) { px = rect.width / 2; py = rect.height / 2; }
    const before = this.toWorld(px, py);
    this.zoom = this.clampZoom(this.zoom * factor);
    const after = this.toWorld(px, py);
    this.pan.x += (after.x - before.x) * this.zoom;
    this.pan.y += (after.y - before.y) * this.zoom;
    this.apply();
  }

  fit() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.zoom = this.clampZoom(Math.min((rect.width * 0.92) / this.natW, (rect.height * 0.92) / this.natH));
    this.pan.x = 0;
    this.pan.y = 0;
    this.apply();
  }

  apply() {
    this.holder.style.transform =
      'translate(calc(-50% + ' + this.pan.x + 'px), calc(-50% + ' + this.pan.y + 'px)) scale(' + this.zoom + ')';
  }

  wirePointer() {
    const s = this.stage;
    const local = (e) => {
      const rect = s.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const startPinch = () => {
      const [a, b] = [...this.pointers.values()];
      this.drag = null;
      this.pinch = { d0: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)), zoom0: this.zoom };
    };
    this.listen(s, 'pointerdown', (e) => {
      const p = local(e);
      this.pointers.set(e.pointerId, p);
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* touch may refuse capture */ }
      if (this.pointers.size === 2) { startPinch(); return; }
      if (this.pointers.size > 2) return;
      this.drag = { px: p.x, py: p.y };
      s.addClass('is-panning');
    });
    this.listen(s, 'pointermove', (e) => {
      const p = local(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const d = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
        const before = this.toWorld(mx, my);
        this.zoom = this.clampZoom(this.pinch.zoom0 * (d / this.pinch.d0));
        const after = this.toWorld(mx, my);
        this.pan.x += (after.x - before.x) * this.zoom;
        this.pan.y += (after.y - before.y) * this.zoom;
        this.apply();
        return;
      }
      if (this.drag) {
        this.pan.x += p.x - this.drag.px;
        this.pan.y += p.y - this.drag.py;
        this.drag.px = p.x;
        this.drag.py = p.y;
        this.apply();
      }
    });
    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pinch && this.pointers.size < 2) this.pinch = null;
      this.drag = null;
      s.removeClass('is-panning');
    };
    this.listen(s, 'pointerup', release);
    this.listen(s, 'pointercancel', release);
    this.listen(s, 'wheel', (e) => {
      e.preventDefault();
      const p = local(e);
      this.zoomBy(Math.exp(-e.deltaY * 0.0016), p.x, p.y);
    }, { passive: false });
    this.listen(s, 'dblclick', () => this.fit());
  }
}

IcorInterfacePlugin.prototype.waitAndWireDiagram = function (section, tries) {
  const m = section.querySelector('.mermaid');
  if (m && m.querySelector('svg')) { this.wireDiagram(m); return; }
  if (tries > 40) return; /* ~4s: not rendering (e.g. untrusted vault guard) */
  window.setTimeout(() => this.waitAndWireDiagram(section, tries + 1), 100);
};

IcorInterfacePlugin.prototype.wireDiagram = function (m) {
  if (!m || typeof m.querySelector !== 'function') return;
  if (typeof m.closest === 'function' && m.closest('.icor-diag-modal')) return; /* our own fullscreen clone */
  const svg = m.querySelector('svg');
  if (!svg) return;
  /* Live preview: anchor on the widget block so the button lines up with
     (and sits left of) Obsidian's own </> edit affordance. Reading view has
     no edit button; anchor on the diagram itself, top-right. */
  const embed = typeof m.closest === 'function' ? m.closest('.cm-embed-block') : null;
  const host = embed || m;
  if (host.querySelector('.icor-diag-btn')) return; /* one button, whoever got there first */
  host.classList.add('icor-diag-host');
  const b = host.createEl('button', {
    cls: 'icor-diag-btn' + (embed ? ' icor-diag-btn-lp' : ''),
    attr: { 'aria-label': 'Open diagram fullscreen' },
  });
  setIcon(b, 'maximize-2');
  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
  b.addEventListener('pointerdown', swallow);
  b.addEventListener('mousedown', swallow);
  b.addEventListener('click', (e) => {
    swallow(e);
    const live = m.querySelector('svg');
    if (live) new DiagramModal(this.app, live).open();
  });
};

IcorInterfacePlugin.prototype.removeDiagramButtons = function () {
  for (const b of document.querySelectorAll('.icor-diag-btn')) b.remove();
  for (const h of document.querySelectorAll('.icor-diag-host')) h.classList.remove('icor-diag-host');
};

/* ---------------------------------------------------- the ICOR folders -- */

/* The stage folders that exist in this vault, for the settings tab: each top
 * folder of a stage (by full name), then the named subfolders found anywhere
 * under it. Folders that do not exist are left out - a settings row for a
 * folder that is not there is a row that does nothing. */
function isFolder(node) { return node instanceof TFolder || Array.isArray(node.children); }

function resolveIcorFolders(app, stageMap) {
  const map = stageMap || buildStageMap(null);
  const root = app.vault.getRoot && app.vault.getRoot();
  if (!root || !root.children) return [];
  const findSub = (folder, name) => {
    for (const child of folder.children || []) {
      if (!isFolder(child)) continue;
      if (child.name === name) return child;
      const deeper = findSub(child, name);
      if (deeper) return deeper;
    }
    return null;
  };
  const tops = root.children.filter((c) => isFolder(c) && map.byFolder.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = [];
  for (const top of tops) {
    const look = stageLook(map, top.path);
    if (!look) continue;
    out.push({ path: top.path, stage: look.stage, description: map.descriptions[top.name] || '', defaults: look.defaults });
    for (const name of Object.keys(SUBFOLDER_ICONS)) {
      const sub = findSub(top, name);
      if (!sub) continue;
      const subLook = stageLook(map, sub.path);
      if (subLook) out.push({ path: sub.path, stage: subLook.stage, description: '', defaults: subLook.defaults });
    }
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
    this.renderNotes(containerEl);
    this.renderChrome(containerEl);
    this.renderOutline(containerEl);
    this.renderDiagrams(containerEl);
    this.renderFolders(containerEl);
  }

  renderNotes(containerEl) {
    const s = this.plugin.settings;
    const save = async () => { await this.plugin.saveSettings(); };
    new Setting(containerEl).setName('Look and notes').setHeading();
    new Setting(containerEl)
      .setName('Look')
      .setDesc('For the INKLINE theme. Flat: ink and paper with one orange marker. Gradient: lit plates and glass cards with depth.')
      .addDropdown((d) => d.addOption('gradient', 'Gradient').addOption('flat', 'Flat')
        .setValue(s.look === 'flat' ? 'flat' : 'gradient')
        .onChange(async (v) => { s.look = v === 'flat' ? 'flat' : 'gradient'; await save(); }));
    new Setting(containerEl)
      .setName('Properties')
      .setDesc("Where a note's properties show. On top is Obsidian's way; folded keeps them one click away (the whole bar opens them); under the note puts your writing first; hidden in notes turns on Obsidian's own switch (Settings, Editor, Properties in document: Hidden) and opens the File properties panel in the right sidebar, where they show beside the note.")
      .addDropdown((d) => d.addOption('top', 'On top').addOption('collapsed', 'On top, folded').addOption('bottom', 'Under the note').addOption('sidebar', 'Hidden in notes (right sidebar)')
        .setValue(this.plugin.nativeProperties() === 'hidden' ? 'sidebar' : PROPERTY_PLACES.includes(s.properties) ? s.properties : 'top')
        .onChange(async (v) => {
          s.properties = PROPERTY_PLACES.includes(v) ? v : 'top';
          this.plugin.folded = new WeakMap();
          await save();
          if (s.properties === 'sidebar') await this.plugin.showPropertiesPanel(true);
        }));
    new Setting(containerEl)
      .setName('_System in the file tree')
      .setDesc('The folder with the schema, templates, skills and tools. Hidden by default; it is still there, synced and used by your AI and the plugins.')
      .addToggle((t) => t.setValue(!!s.showSystem).onChange(async (v) => { s.showSystem = v; await save(); }));
  }

  renderOutline(containerEl) {
    new Setting(containerEl).setName('Outline').setHeading();
    new Setting(containerEl)
      .setName('Heading depth')
      .setDesc("How deep the core Outline pane lists. Obsidian nests each heading under the one above it, so a note that skips a level (H1 straight to H3) counts the H3 as the second level. Obsidian's own Outline switch is under Core plugins.")
      .addDropdown((d) => {
        d.addOption('0', 'All levels');
        for (let i = 1; i <= 6; i++) d.addOption(String(i), i === 1 ? 'H1 only' : `H1 to H${i}`);
        d.setValue(String(this.plugin.settings.outlineDepth || 0))
          .onChange(async (v) => {
            this.plugin.settings.outlineDepth = Number(v);
            await this.plugin.saveSettings();
          });
      });
  }

  renderDiagrams(containerEl) {
    new Setting(containerEl).setName('Diagrams').setHeading();
    new Setting(containerEl)
      .setName('Fullscreen button on mermaid diagrams')
      .setDesc('Every rendered diagram gets a small maximize button beside the edit control. Open it edge to edge: wheel or pinch to zoom around the cursor, drag to pan, double-click to reset, Esc to close.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.diagramsEnabled)
        .onChange(async (v) => {
          this.plugin.settings.diagramsEnabled = v;
          await this.plugin.saveSettings();
        }));
  }

  renderChrome(containerEl) {
    new Setting(containerEl).setName("Obsidian's interface").setHeading();

    if (this.plugin.styleSettingsActive()) {
      new Setting(containerEl)
        .setName('Style Settings is installed and owns these switches')
        .setDesc('Find the same five under Settings, Style Settings, ICOR for Life - INKLINE. This plugin steps aside so the two never disagree.');
    } else {
      for (const s of SWITCHES) {
        if (s.key === 'roomIcons') continue;   /* lives with the folders */
        this.renderSwitch(containerEl, s);
      }
    }

    new Setting(containerEl)
      .setName("Show Obsidian's file explorer buttons")
      .setDesc('The row of buttons above the file tree: new note, new folder, sort order, auto-reveal and collapse all. Hidden by default: collapsing all folders and showing the open note in the file tree are icons in the left ribbon, and a new note or folder is in the file tree\'s right-click menu.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.showExplorerButtons)
        .onChange(async (v) => {
          this.plugin.settings.showExplorerButtons = v;
          await this.plugin.saveSettings();
        }));

    this.renderAutoReveal(containerEl);

    /* Not a theme class, so it is this plugin's whichever plugin owns the
       five above. */
    new Setting(containerEl)
      .setName('Collapsible status bar')
      .setDesc('The status bar folds away to a small round button at the bottom right, where the bar itself sits; the button points left, the way the bar unfolds, and the item at the bar\'s left edge points right, the way it folds. The button, the item and the command "Toggle status bar" all flip it, and the fold is remembered. Collapsed, everything in the bar is out of sight, plugin indicators included, such as the Git status dot. Off, Obsidian\'s status bar is left exactly as it is.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.statusBarCollapsible)
        .onChange(async (v) => {
          this.plugin.settings.statusBarCollapsible = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Show the fold button only on hover')
      .setDesc('While the bar is folded, the round button stays invisible until the pointer comes near the bottom right corner, or the button has keyboard focus. Off, the button is always visible.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.statusBarButtonOnHover)
        .onChange(async (v) => {
          this.plugin.settings.statusBarButtonOnHover = v;
          await this.plugin.saveSettings();
        }));
  }

  /* The mirror, not a second copy: it reads the live file-explorer leaf when
     the tab opens and writes straight back to it. Nothing is stored here, so
     this switch and Obsidian's own toolbar button can never disagree. */
  renderAutoReveal(containerEl) {
    const state = this.plugin.autoRevealState();
    const setting = new Setting(containerEl).setName('Auto-reveal current file');

    if (state === null) {
      setting.setDesc('Obsidian highlights the note you are reading in the folder tree. The core File explorer is off, or this Obsidian is older than 1.8.3, so there is nothing to switch.');
      return;
    }

    setting
      .setDesc('Obsidian highlights the note you are reading in the folder tree. Command: "Toggle auto-reveal current file in the file explorer".')
      .addToggle((t) => t
        .setValue(state)
        .onChange(async (v) => { await this.plugin.setAutoReveal(v); }));
  }

  switchDesc(s) {
    const hint = s.key === 'showRibbon' ? this.plugin.ribbonThemeHint() : '';
    return hint ? `${s.desc} ${hint}` : s.desc;
  }

  renderSwitch(containerEl, s) {
    const setting = new Setting(containerEl)
      .setName(s.name)
      .setDesc(this.switchDesc(s))
      .addToggle((t) => t
        .setValue(!!this.plugin.settings[s.key])
        .onChange(async (v) => {
          this.plugin.settings[s.key] = v;
          await this.plugin.saveSettings();
          setting.setDesc(this.switchDesc(s));
        }));
  }

  renderFolders(containerEl) {
    new Setting(containerEl).setName('Folders').setHeading();

    /* The master switch sits with what it switches. */
    if (!this.plugin.styleSettingsActive()) {
      this.renderSwitch(containerEl, SWITCHES.find((s) => s.key === 'roomIcons'));
    }

    /* --- the user's own additions, first: the thing you came here to do --- */
    const icorFolders = resolveIcorFolders(this.app, this.plugin.stageMap);
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

    const icorPaths = new Set(icorFolders.map((s) => s.path));
    for (const cfg of this.plugin.settings.folders) {
      if (icorPaths.has(cfg.path)) continue;   /* a stage folder the member changed; shown in the list below */
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

    /* --- the ICOR folders, by stage, editable --- */
    if (icorFolders.length) {
      new Setting(containerEl).setName('ICOR for Life folders, by stage').setHeading();
      const where = this.plugin.stageMap && this.plugin.stageMap.fromSchema ? 'from _System/schema.json' : 'ICOR for Life\'s own';
      new Setting(containerEl)
        .setDesc(`Each ICOR stage gives its folders one colour (${where}): Input, Control, Output. Refine has no folder. Change any folder here; the change is stored and wins, the other folders keep their stage colour. Reset gives a folder its stage colour back.`);
      for (const { path, defaults, stage, description } of icorFolders) {
        const override = this.plugin.folderConfig(path);
        this.renderRow(containerEl, override || defaults, {
          isOverride: !!override,
          stage,
          description,
          onChange: (patch) => this.plugin.overrideFolder(defaults, patch),
          onReset: () => this.plugin.resetFolder(path),
        });
      }
    }
  }

  /* One row per folder, the same for a stage folder and a user's own:
     name, kind, icon, hue or two colours, and a reset. Blocks get a second
     line for the label. `onChange` receives a patch; the caller decides
     whether that patch becomes an override or edits an existing entry. */
  renderRow(containerEl, cfg, { isOverride, editablePath = false, stage = null, description = '', onChange, onReset }) {
    /* No wrapper element. INKLINE draws a settings section as one card from
       a RUN OF SIBLING rows; a div around each row breaks the run and every
       row becomes its own card. Rows go straight into the container. */
    const box = containerEl;
    const change = async (patch) => { await onChange(patch); this.display(); };

    const head = new Setting(box)
      .setName(cfg.path || 'New folder')
      .setDesc(editablePath ? '' : [stage ? stage.label : '', description, isOverride ? 'changed by you' : ''].filter(Boolean).join(' · '));

    if (editablePath) {
      head.addText((t) => {
        t.setPlaceholder('Folder path, e.g. 02 Inner World/Notes/Clients').setValue(cfg.path)
          .onChange(async (v) => { await onChange({ path: v.trim() }); head.setName(v.trim() || 'New folder'); });
        new FolderSuggest(this.app, t.inputEl, async (path) => { await onChange({ path }); head.setName(path); });
      });
    }

    head.addExtraButton((b) => {
      b.setIcon(cfg.icon || 'folder').setTooltip(`Icon: ${cfg.icon || 'none'}`);
      b.onClick(() => new IconPicker(this.app, (id) => change({ icon: id.replace(/^lucide-/, '') })).open());
    });

    const palette = this.plugin.palette();
    head.addDropdown((d) => {
      d.addOption('', 'Custom colour');
      for (const p of palette) d.addOption(p.key, p.name);
      const current = palette.find((p) => p.ink === cfg.color && p.paper === cfg.colorPaper);
      d.setValue(current ? current.key : '')
        .onChange((v) => { const p = palette.find((x) => x.key === v); if (p) change({ color: p.ink, colorPaper: p.paper }); });
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
        .setTooltip(editablePath ? 'Remove' : 'Reset to the stage colour')
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
IcorInterfacePlugin.resolveIcorFolders = resolveIcorFolders;
IcorInterfacePlugin.buildStageMap = buildStageMap;

module.exports = IcorInterfacePlugin;
