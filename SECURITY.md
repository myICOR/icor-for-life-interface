# Security Policy

ICOR for Life - Interface is a local-only Obsidian plugin. It makes no network requests and it
stores no credentials. That means its security surface is small, and this file says
so plainly rather than implying a risk the plugin does not carry. It still has a
surface, and we would rather hear about a problem early than read about it later.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security problem.**

Two channels, in order of preference:

1. **GitHub private security advisory** (preferred). Go to the
   [Security tab](https://github.com/myICOR/icor-for-life-interface/security/advisories/new)
   of this repository and open a draft advisory. This keeps the report private
   between you and the maintainer until a fix ships.
2. **Email** `team@myicor.com` with `SECURITY` and `icor-for-life-interface` in the subject
   line. This is a monitored mailbox.

A useful report contains:

- The plugin version (see `manifest.json`, or Settings, Community plugins).
- Your Obsidian version and operating system.
- What an attacker can do, and what they need in order to do it.
- Steps to reproduce, ideally against a throwaway vault.

## What to expect

This project is maintained by one person, so these are timelines we can actually
keep rather than ones that sound good:

| Stage | Target |
| --- | --- |
| We acknowledge your report | within 5 business days |
| We tell you whether we agree it is a vulnerability, and how severe | within 10 business days |
| We ship a fix for a confirmed critical or high issue | we aim for 30 days |
| We ask you to hold public disclosure until | a fix ships, or 90 days from your report, whichever comes first |

If a deadline is going to slip we will tell you before it slips, not after. If you
do not hear from us within 10 business days, please chase us: assume the message
got lost rather than ignored.

## Supported versions

**Only the most recent release is supported.** This project has one branch (`main`)
and no long-term-support line. There are no backports to older versions and no
security patches for anything but the current release. If you are running an older
version, the fix is to update.

We are not going to publish a version-support table we would not honour.

## Scope: what this plugin actually touches

ICOR for Life - Interface changes how the vault LOOKS and nothing else. Measured
against the shipped `main.js` of v0.1.0:

- **No network access.** The bundle contains zero `fetch`, `requestUrl` and
  `XMLHttpRequest` call sites and references no remote hostname. The plugin does
  not phone home, and there is no telemetry or analytics.
- **No credentials.** The plugin stores no API keys, tokens or passwords. It has
  no account, no login, and nothing to leak.
- **Writes exactly two kinds of thing, both in the DOM.** Five class names on
  `<body>`, and `data-icor-kind` plus four `--room-*` custom properties on
  file-explorer folder rows. Every one is a value the INKLINE theme reads. The
  plugin writes no CSS and injects no stylesheet.
- **Reads exactly two kinds of thing.** The vault's folder tree (names and
  paths, never file contents) to offer folder suggestions, and Obsidian's own
  icon registry to offer icons. It never reads a note.
- **Its own settings only**, through Obsidian's plugin settings API.

**In scope, and we want to hear about it:**

- Anything that makes this plugin perform a network request at all. Given the
  above, any outbound connection is by definition unexpected and we want to know.
- A folder path or label from settings that lands in the DOM unescaped and
  results in script execution or markup injection. Labels are serialised with
  `JSON.stringify` into a CSS string; a way past that is a bug we want.
- Any read of a file's contents, or any write to the vault at all. This plugin
  has no reason to do either.

**Note on the published artifact.** This repository distributes the plugin as
hand-written CommonJS: `main.js` IS the source, unminified and unbundled, and
can be reviewed directly. There is no build step and no separate source tree.

## Out of scope

These are not vulnerabilities and we will close them as such:

- Bugs in Obsidian itself. Report those to
  [Obsidian](https://github.com/obsidianmd/obsidian-releases/issues).
- Interactions with third-party plugins, or breakage caused by another plugin
  changing shared state. Please report those as normal issues so we can look at
  compatibility, but they are not handled as security reports.
- Anyone with filesystem access to your vault being able to read your notes. If an
  attacker is already reading your vault, this plugin is not the control that
  failed.
- Missing hardening that has no demonstrated impact: dependency versions with no
  reachable exploit path, "this setting is not encrypted", or the output of an
  automated scanner with no working proof of concept.
- Rendering or layout bugs. Those are ordinary issues and very welcome as such,
  just not through this channel.
- Social engineering, physical access, or attacks that require the user to
  already be running attacker-controlled code.

## Good-faith research

We will not pursue or support legal action against anyone who reports a
vulnerability to us in good faith, follows this policy, gives us reasonable time to
fix the issue before disclosure, and does not access, modify or destroy data that
is not their own. Test against your own vault.

There is no bug bounty. We are a small team and cannot pay for reports. We will
credit you by name and link in the release notes and the advisory unless you would
rather stay anonymous.

## Credit

Thank you for taking the time. A report that arrives privately and with a
reproduction is worth a great deal more than the effort it costs you to write it.
