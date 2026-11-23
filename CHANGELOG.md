# Changelog

All notable changes to ICOR for Life - Interface.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

Releases before 0.6.3 are described by their tags and release notes on
GitHub; this file starts with 0.6.3.

## 0.10.4 (2026-11-23)

- The display name is now ICOR Interface (it was ICOR for Life - Interface). The plugin id stays `icor-for-life-interface`, so installed vaults, settings and hotkeys carry on unchanged.

## 0.10.3 (2026-11-23)

- 0.10.1 and 0.10.2 together: the directory pass and the ribbon coming back.

## 0.10.2 (2026-11-23)

- The ribbon stays. Every ICOR for Life plugin keeps its icon in Obsidian's ribbon now, so a first run no longer hides it (nor Obsidian's own file controls), in any vault. A ribbon an earlier version hid comes back once; whatever you set after that stays. The two switches no longer say the actions moved to the file-tree toolbar.
## 0.10.1 (2026-11-23)

- Ready for the Obsidian community directory's review. Carries 0.8.1's ribbon fix into this line: the Left ribbon
  switch hides the ribbon on any theme, and says when INKLINE is not active.
- The diagram viewer lifts Mermaid's width cap from the stylesheet instead of an inline style.
- A shorter description, within the directory's 250 characters.


## 0.10.0 (2026-11-23)

- The folders are grouped by ICOR stage, and each stage has its own colour: Input (blue) for 00 Daily Notes and
  01 Inbox, Control (green) for 02 Inner World, 03 Outer World, 04 Assets and 05 Databases, Output (pink) for
  06 Planner. Refine has no folder. Every folder inside a stage folder takes the stage colour and keeps its own icon;
  date folders stay plain. In the light theme each colour is darkened just enough to read.
- The colours come from your vault's `_System/schema.json` (`stages`), read once and again when it changes. A schema
  without `stages`, or none at all, uses the same map built in; an older schema that still says `rooms` works too, and
  so do the folder names from before the stage layout (00 Daily Scratchpad, 02 Planner, 04 Inner World...).
- Folders are matched by their full name, never by the number in front: a `06 AI Team` left from 2.x is not the
  Output stage's `06 Planner`, and is not coloured.
- Your own folder settings still win over the stage colour; the stage colours are never stored in your settings.
- Settings say folders and stages: "Folder icons and colours", "ICOR for Life folders, by stage" with each folder's
  stage and its line from the schema, the stage colours first in the colour list, and "Block" for the folder kind
  with a coloured edge. Saved settings keep working unchanged (the stored keys keep their old names).

## 0.9.1 (2026-11-23)

- The folder path you type when you give a folder its own colour suggests `04 Inner World/Notes/Clients` as an
  example, no longer a `03 WiP` folder: ICOR for Life 3.0 has none.

## 0.9.0 (2026-11-21)

- Look and notes, a new first section: INKLINE's Look (flat or gradient), where a note's properties show (on top, on top
  and folded, under the note, or hidden in notes with Obsidian's own switch and its File properties panel in the right
  sidebar) and _System in the file tree. They lived in ICOR for Life - Objects until now; their values come over once.
- Folded properties open and close anywhere on the bar, which shows how many it holds; under the note, Obsidian's room
  to scroll past the end moves below the properties instead of sitting between the text and them.
- Commands: switch the look, show or hide _System, show the note's properties in the right sidebar.
- ICOR for Life 3.0 rooms: no 03 WiP, 06 is the Outer World; a 3.0 vault keeps Obsidian's ribbon and file controls on
  first run.

## [0.8.1] - 2026-11-02

### Fixed
- **The Left ribbon switch hides the ribbon on any theme.** The switch only
  set the `icor-hide-ribbon` class, and the one rule that reads the class is
  in the INKLINE theme, so with INKLINE inactive or out of date the ribbon
  stayed. The plugin's `styles.css` now carries the same rule, plus INKLINE's
  macOS title bar inset, under the same class. Turning the switch back on or
  disabling the plugin brings the ribbon back. With Style Settings enabled,
  the switch is still its to own.
- **The switch says when INKLINE is not active.** While the ribbon is hidden
  on another theme, the setting's description says so. There is no pop-up.

## [0.8.0] - 2026-09-21

### Changed
- Relicensed under MIT. Releases before 0.8.0 remain under the ICOR for Life
  Source-Available License (Code) v1.0.

## [0.7.0] - 2026-09-17

### Added
- **A switch and a command for "Auto-reveal current file".** This is
  Obsidian's own setting: with it on, opening a note highlights that note in
  the folder tree, so you always see where you are. Obsidian offers it in one
  place only, a small button on the toolbar above the file tree, and it
  registers no command for it, so there was no hotkey and no palette entry to
  fall back on when that toolbar gets busy. Two new ways in:
  - The command **"Toggle auto-reveal current file in the file explorer"**,
    in the command palette and bindable to a hotkey. It says which way it
    went: "Auto-reveal current file is ON" or "... is OFF". With the core
    File explorer turned off the command is not offered, because a hotkey
    that does nothing is worse than one that is not there.
  - A toggle in this plugin's settings, under "Obsidian's interface".
  - Both read and write Obsidian's own switch, so they, the toolbar button
    and the setting can never disagree. Nothing is stored in this plugin's
    own settings file; the state stays where Obsidian keeps it and survives a
    restart the way it always did.
  - **Needs Obsidian 1.8.3 or newer**, which is where the setting itself
    arrived. On an older Obsidian the settings row says so and the command is
    not offered, rather than showing a switch that does nothing. The rest of
    the plugin still works on 1.5.0 and up, unchanged.
- Ten gates for the above (the command's name, its withdrawal with no file
  explorer, the flip both ways, the view type and the rest of the view state
  surviving the write, focus never moving to the sidebar, the layout save,
  the notice wording, no copy in `data.json`, and the settings row in both
  its states, plus an Obsidian too old to have the setting), seen red first
  against 0.6.5.

## [0.6.5] - 2026-09-07

### Changed
- The two fold glyphs point the way the bar moves. The bar sits at the
  bottom right and unfolds toward the left, so the round button now shows
  `chevron-left` ("Unfold status bar to the left") and the item at the bar's
  left edge shows `chevron-right` ("Fold status bar to the right"). 0.6.4
  showed `panel-bottom-open`, a square with a chevron pointing up, which
  pointed nowhere the bar goes. Lucide's `panel-right-open` / `-close` were
  considered and passed over: the glyph is a side panel, the picture
  Obsidian uses for its sidebars, and its chevron is three units wide at
  14px.

### Added
- **The fold button shows on approach.** Folded, the round button is
  invisible until the pointer comes near the bottom right corner: a 64px
  transparent zone (`--size-4-16`) anchored to the corner is the hit area,
  and the button fades in on Obsidian's `--anim-duration-fast` when the
  pointer enters it, or when the button has keyboard focus (`:focus-visible`),
  so a keyboard user tabs onto a visible control. CSS only, no pointer
  listener. Setting "Show the fold button only on hover", on by default;
  off, the button is always visible. Devices without hover (`hover: none`)
  always see it. The zone swallows what lands in its 64px square while the
  bar is folded, as the bar's own footprint does while unfolded.
- Four gates for the above (both glyph ids, both labels, the body class
  following its setting, and a pin on the rest-opacity, hover and focus
  rules in styles.css), seen red first.

### Removed
- `setIconWithFallback`: both chevrons have been in Lucide from the start,
  so there is nothing to fall back to.

## [0.6.4] - 2026-09-07

### Changed
- The round button that unfolds the status bar sits at the bottom RIGHT of
  the window, in the corner the bar itself lives in (right edge on the bar's
  right padding, bottom on the bar's bottom), so it stands where the bar's
  last item was. 0.6.3 put it at the bottom left, where it collided with
  Connect's account footer.

## [0.6.3] - 2026-09-07

### Added
- **Collapsible status bar.** A setting under Obsidian's interface, on by
  default. An item at the left edge of the status bar (`panel-bottom-close`,
  tooltip "Collapse status bar") folds the bar away; a small round button
  at the bottom left of the window (`panel-bottom-open`, to the right of the
  ribbon column so the ribbon's last icon is never covered, flush left when
  the ribbon is hidden) unfolds it. Command "Toggle status bar", hotkey-able,
  offered only while the feature is on. The fold is stored in the plugin
  data and survives a reload. Focus follows the fold, so a keyboard user is
  never left on a hidden control.
- Folded, the whole bar leaves the layout (`body.icor-status-bar-collapsed
  .status-bar { display: none }`), plugin indicators included, such as the
  Git status dot; the setting says so. Main window only: pop-out windows
  have no status bar. Not on mobile, for the same reason.
- Off leaves Obsidian's bar exactly as it is: no class, no item, no button.
  Unload does the same.
- Eight gates for the above, seen red against 0.6.2 first.

### Changed
- The Collapsible status bar switch renders even when Style Settings owns
  the five theme switches, as the Outline depth does: it is this plugin's
  own class, not the theme's.
