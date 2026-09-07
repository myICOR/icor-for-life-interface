# Changelog

All notable changes to ICOR for Life - Interface.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

Releases before 0.6.3 are described by their tags and release notes on
GitHub; this file starts with 0.6.3.

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
