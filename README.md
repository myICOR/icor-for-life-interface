# ICOR for Life - Interface

The vault's chrome in one place. Which parts of Obsidian's own interface are
shown, and which folders carry a colour, an icon and a label.

**It writes no CSS.** The [ICOR for Life - INKLINE](https://github.com/myICOR/icor-for-life-inkline)
theme owns every rule; this plugin owns the settings the theme reads. Install
the theme first, or the switches here move and change nothing.

**Beta.** In daily use in a real vault; rough edges likely. Open an issue.

## What you get

**Obsidian's interface.** Five switches, in plain words:

- Hide the left ribbon
- Reduce Obsidian's own controls (the vault switcher, and New note / New
  folder / Change sort order on the file-tree toolbar)
- Hide the ICOR for Life banner
- Turn off room icons and colours
- Turn off the handwritten layer

Each one is a class on `<body>` that INKLINE already guards on. If you have the
Style Settings plugin installed it owns these same five, and this plugin steps
aside so the two never disagree.

**Folders.** Give any folder a colour, an icon and, for rooms, a label. Pick
one of INKLINE's seven hues or set your own ink and paper colours; pick any of
the ~1,700 Lucide icons Obsidian already ships. Three kinds:

- **Room** - a block with a coloured edge, no collapse arrow, its own label.
  What ICOR for Life's seven numbered folders are.
- **Family** - coloured name and a small icon. What everything inside a room is.
- **None** - Obsidian's default look, even for an ICOR room you want plain.

**Only what you change is stored.** ICOR for Life's seven rooms and their
subfolders are styled by the theme on their own. Add a folder here to give any
folder a look, or to change one of the theme's. Remove it, and the theme's own
look comes back.

## First run

In an ICOR for Life vault (a `00 …` and a `06 …` folder at the root) the plugin
starts with the ribbon hidden and the chrome reduced, because every route those
controls carried exists somewhere else in that vault. Anywhere else it starts
with nothing hidden: a plugin that removes navigation from a vault it was just
installed into has broken that vault.

## How it fits the theme

INKLINE's room mechanism draws whatever four custom properties on a folder row
say, and applies its own ICOR defaults only to rows with no `data-icor-kind`.
This plugin sets that attribute and those properties inline on the rows you
configure. Inline beats stylesheet by the ordinary cascade, so nothing here
needs `!important`, and the theme and the plugin each work alone. The contract
is documented in the theme's README and measured in its tests.

## Install

Requires Obsidian 1.5.0 or newer and the ICOR for Life - INKLINE theme.

- **From Obsidian:** Settings, Community plugins, Browse, search "ICOR for
  Life - Interface", install, enable.
- **Manually:** copy `main.js`, `manifest.json` and `styles.css` from the
  latest release into `.obsidian/plugins/icor-for-life-interface/`.

## ICOR for Life Obsidian Edition

Part of the ICOR for Life suite: Planner, Focus, Connect, Diagrams, Chat, and
the INKLINE theme. Learn the method at [myicor.com](https://myicor.com).

## Licence

Source-available, see `LICENSE`. No third-party code is bundled; see
`THIRD-PARTY-NOTICES.md`.
