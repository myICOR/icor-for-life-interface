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
 * THE DEFAULTS ARE NOT HERE. The eight ICOR rooms and their subfolders are
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
  Plugin, PluginSettingTab, Setting, FuzzySuggestModal, AbstractInputSuggest, Modal,
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

/* INKLINE's eight room hues, ink and paper. Offered as a palette so a folder
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
  { key: 'rose',       name: 'Rose (Databases)',          ink: '#b57a86', paper: '#8f5560' },
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
  { room: '07', kind: 'room', hue: 'rose',       icon: 'database',       label: 'Databases' },
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
  /* the table of contents beside every markdown note */
  tocEnabled: false,
  tocSticky: true,
  tocDepth: 3,
  /* the fullscreen button on rendered mermaid diagrams */
  diagramsEnabled: true,
};

const TOC_CLASS = 'icor-if-toc';
/* Below this many pixels of gutter the panel would overlap the text, so it
   hides rather than crowds. */
const TOC_MIN_GUTTER = 180;

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
      this.refreshTocs();
    });
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      this.applyChrome();
      this.applyFolders();
      this.observeExplorer();
      this.refreshTocs();
    }));
    /* The contents panel follows the note: a new file in a leaf, a heading
       edited, a switch between reading and editing (which is a layout
       change). Each is a rebuild of that one leaf's panel. */
    this.registerEvent(this.app.workspace.on('file-open', () => this.refreshTocs()));
    this.registerEvent(this.app.metadataCache.on('changed', (file) => this.refreshTocs(file)));

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
    for (const row of document.querySelectorAll(`[${MANAGED}]`)) this.releaseRow(row);
    this.removeTocs();
    this.removeDiagramButtons();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyChrome();
    this.applyFolders();
    this.refreshTocs();
    if (!this.settings.diagramsEnabled) this.removeDiagramButtons();
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
    svg.style.maxWidth = 'none';
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

/* ------------------------------------------------------ table of contents --
 * One panel per markdown leaf, built from the metadata cache's headings and
 * placed in the left gutter beside the note - the space readable line width
 * leaves empty. Two placements:
 *
 *   sticky   the panel is a child of the view container, outside the
 *            scroller, so it stays put while the note scrolls under it.
 *   flow     the panel sits inside the scroller's sizer, to the left of the
 *            text, and scrolls away with the top of the note.
 *
 * Both are absolutely positioned off the same anchor geometry, so the panel
 * lands in the same place; only whether it moves differs. The gutter is
 * MEASURED, not assumed: readable line width can be off, the pane can be
 * narrow, and a panel over the text is worse than no panel. Under
 * TOC_MIN_GUTTER it hides.
 *
 * This is the one thing in the plugin that carries its own stylesheet. The
 * chrome switches and the folder rows are the theme's territory and it draws
 * them; a contents panel has to work on any theme, so its CSS ships here and
 * reads INKLINE's tokens with fallbacks. */

function markdownLeaves(app) {
  return (app.workspace.getLeavesOfType ? app.workspace.getLeavesOfType('markdown') : []) || [];
}

IcorInterfacePlugin.prototype.refreshTocs = function (changedFile) {
  if (!this.settings.tocEnabled) { this.removeTocs(); return; }
  for (const leaf of markdownLeaves(this.app)) {
    const view = leaf.view;
    if (!view || !view.file) continue;
    if (changedFile && view.file.path !== changedFile.path) continue;
    this.renderToc(view);
  }
};

IcorInterfacePlugin.prototype.removeTocs = function () {
  for (const el of document.querySelectorAll('.' + TOC_CLASS)) el.remove();
  for (const ro of this.tocObservers || []) ro.disconnect();
  this.tocObservers = [];
};

/* Where the panel lives for this view and this stickiness. */
IcorInterfacePlugin.prototype.tocHost = function (view) {
  const content = view.contentEl;
  if (!content) return null;
  if (this.settings.tocSticky) return content;
  const mode = typeof view.getMode === 'function' ? view.getMode() : 'preview';
  const sizer = mode === 'preview'
    ? content.querySelector('.markdown-preview-sizer')
    : content.querySelector('.cm-sizer');
  /* No sizer yet (view still mounting): fall back to the container rather
     than draw nothing, and the next layout-change re-places it. */
  return sizer || content;
};

IcorInterfacePlugin.prototype.renderToc = function (view) {
  const file = view.file;
  const content = view.contentEl;
  if (!content || !file || file.extension !== 'md') return;

  const old = content.querySelector('.' + TOC_CLASS);
  if (old) old.remove();

  const cache = this.app.metadataCache.getFileCache(file);
  const depth = Math.max(1, Math.min(6, Number(this.settings.tocDepth) || 3));
  const headings = ((cache && cache.headings) || []).filter((h) => h.level <= depth);
  if (headings.length === 0) return;

  const host = this.tocHost(view);
  if (!host) return;

  const nav = host.createEl('nav', { cls: TOC_CLASS + (this.settings.tocSticky ? ' is-sticky' : ' is-flow') });
  host.prepend(nav);
  nav.setAttribute('aria-label', 'Table of contents');
  nav.createDiv({ cls: TOC_CLASS + '-title', text: 'Contents' });
  const list = nav.createEl('ul', { cls: TOC_CLASS + '-list' });
  const top = headings[0].level;
  for (const h of headings) {
    const item = list.createEl('li', { cls: TOC_CLASS + '-item' });
    item.setAttribute('data-level', String(h.level));
    item.style.setProperty('--icor-toc-indent', String(Math.max(0, h.level - top)));
    const link = item.createEl('a', { cls: TOC_CLASS + '-link', text: h.heading });
    link.setAttribute('href', '#');
    link.addEventListener('click', (evt) => {
      evt.preventDefault();
      this.scrollToHeading(view, h);
    });
  }

  this.measureGutter(view, nav);
};

/* Jump within the leaf the panel belongs to, in whichever mode it is in.
   Reading mode scrolls by source line; editing mode moves the cursor there
   and scrolls it into view. Neither opens a link, so the panel never sends a
   click to another leaf. */
IcorInterfacePlugin.prototype.scrollToHeading = function (view, heading) {
  const line = heading.position.start.line;
  const mode = typeof view.getMode === 'function' ? view.getMode() : 'preview';
  if (mode === 'preview' && view.previewMode && typeof view.previewMode.applyScroll === 'function') {
    view.previewMode.applyScroll(line);
    return;
  }
  if (view.editor) {
    view.editor.setCursor({ line, ch: 0 });
    if (typeof view.editor.scrollIntoView === 'function') {
      view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  }
};

/* The gutter is the space between the pane's left edge and the text. It is
   read from the rendered sizer, because that is the truth after readable
   line width, pane width and every theme have had their say. */
IcorInterfacePlugin.prototype.measureGutter = function (view, nav) {
  const content = view.contentEl;
  const apply = () => {
    const sizer = content.querySelector('.markdown-preview-sizer') || content.querySelector('.cm-sizer');
    const paneWidth = content.clientWidth || 0;
    const textWidth = sizer ? (sizer.clientWidth || 0) : 0;
    const gutter = paneWidth && textWidth ? Math.max(0, (paneWidth - textWidth) / 2) : 0;
    nav.style.setProperty('--icor-toc-gutter', gutter + 'px');
    nav.classList.toggle('is-narrow', gutter < TOC_MIN_GUTTER);
  };
  apply();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(apply);
    ro.observe(content);
    (this.tocObservers || (this.tocObservers = [])).push(ro);
  }
};

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
    this.renderToc(containerEl);
    this.renderDiagrams(containerEl);
    this.renderFolders(containerEl);
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

  renderToc(containerEl) {
    new Setting(containerEl).setName('Table of contents').setHeading();
    new Setting(containerEl)
      .setName('Show a table of contents beside every note')
      .setDesc('Built from the note\'s headings, in the left margin that readable line width leaves free. Hidden on its own when that margin is too narrow to hold it.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.tocEnabled)
        .onChange(async (v) => {
          this.plugin.settings.tocEnabled = v;
          await this.plugin.saveSettings();
          this.display();
        }));
    if (!this.plugin.settings.tocEnabled) return;

    new Setting(containerEl)
      .setName('Keep it in view while scrolling')
      .setDesc('On: the contents stay put and the note scrolls under them. Off: they sit at the top of the note and scroll away with it.')
      .addToggle((t) => t
        .setValue(!!this.plugin.settings.tocSticky)
        .onChange(async (v) => {
          this.plugin.settings.tocSticky = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Heading depth')
      .setDesc('How many heading levels to list.')
      .addDropdown((d) => {
        for (let i = 1; i <= 6; i++) d.addOption(String(i), `H1 to H${i}`);
        d.setValue(String(this.plugin.settings.tocDepth || 3))
          .onChange(async (v) => {
            this.plugin.settings.tocDepth = Number(v);
            await this.plugin.saveSettings();
          });
      });
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
      if (scaffoldPaths.has(cfg.path)) continue;   /* a scaffold override; shown in the scaffold list below */
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
