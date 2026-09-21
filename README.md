# ICOR for Life - Interface

**Decide what your vault shows you.**

Obsidian's own chrome, your rooms' colours and icons, the status bar, the
Outline depth: all the switches in one settings page instead of scattered
across five.

Part of the [ICOR for Life](https://myicor.com) suite.

## What it is for

A vault you work in every day should show you what you use and hide what you
do not. Obsidian can do that, but the controls live in different places and
some of them are theme settings rather than app settings, so you end up
guessing which page a switch is on.

This puts them together and phrases every one the same way: **on means
shown**. No double negatives.

## Before you start

Install the [ICOR for Life - INKLINE](https://github.com/myICOR/icor-for-life-inkline)
theme first. The theme draws the chrome and the rooms; this plugin owns the
settings the theme reads. Without it, several switches will move and change
nothing.

Three things work on any theme: the Outline depth control, the diagram
viewer, and the collapsible status bar.

## What you can turn on and off

**Obsidian's chrome.** The left ribbon. Obsidian's own file controls, meaning
the vault switcher and the New note, New folder and sort buttons. The ICOR for
Life banner. Room icons and colours. The handwritten layer.

**The status bar.** Collapsible, on by default. Fold it away with the small
control at its left edge, bring it back with the round button at the bottom
right, or bind a hotkey to flip it.

**The Outline.** Choose how many heading levels the Outline pane shows, so a
long note does not become a long list.

**The diagram viewer.** Open a diagram full screen instead of squinting at it
in the note.

If you use the Style Settings plugin, it owns the same five chrome switches
and this plugin steps aside, so the two never disagree.

## What it touches

- **Your vault's appearance settings**, which is the whole point.
- **Nothing else.** No notes are read or written.

**It makes no network connection and starts no process.**

## Good to know

- **The theme does the drawing.** If a switch seems to do nothing, check that
  INKLINE is the active theme.
- **Beta.** In daily use in a real vault; rough edges likely. Open an issue.

## Support

What myICOR supports: the plugin as published in a tagged release, on the
current version, installed from that release. Bugs go to this repo's issues,
security reports to the process in `SECURITY.md`.

What the community maintains: anything marked community-maintained, including
community source adapters. We review it before it is merged. We do not support
it, we cannot promise it keeps working, and it can be disabled or removed in
any release.

What is yours: your own changes, your fork, your local patch. Please reproduce
the problem on a clean install of the current release before reporting it.

## Licence

MIT, see `LICENSE`. Install it, run it, read it, change it, sell it, ship it in
your own product; keep the copyright and licence notice.
Releases before 0.8.0 stay under the ICOR for Life
Source-Available License (Code) v1.0 they were published with.

The licence covers the code only. "ICOR", "ICOR for Life", "myICOR" and
"Paperless Movement" are trademarks of Paperless Movement, S.L.; a fork needs
its own plugin id and name. See `TRADEMARK.md`.

Contributions are welcome as pull requests under the same MIT terms, with a
DCO sign-off on every commit. See `CONTRIBUTING.md`.

Bundled third-party components keep their own licences; see
`THIRD-PARTY-NOTICES.md`.
