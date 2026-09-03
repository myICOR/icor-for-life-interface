/* THE OUTLINE DEPTH GATE, in a real engine.
 *
 * The first version of the Outline depth CSS anchored on a class the core
 * Outline pane does not have, matched nothing, and shipped green because the
 * only test on it checked the body class, not the pane. A string gate cannot
 * catch a selector that is wrong about the world. So this one renders the
 * markup the app bundle actually produces and measures what is hidden.
 *
 * THE FIXTURE IS THE CONTRACT. Read from obsidian.asar 1.12.7: the Outline
 * view is a Tree whose containerEl is the leaf's .view-content, and each
 * item is .tree-item > .tree-item-self + .tree-item-children. If Obsidian
 * changes that shape, this gate goes red and the fixture is where to look.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(repo, 'styles.css'), 'utf8');
const CHROME = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* A five-deep outline: H1 > H2 > H3 > H4 > H5, plus a second H2 at level 2.
   Ids name the nesting level so the measurement reads plainly. */
function item(id, level, children = '') {
  return `<div class="tree-item" id="${id}" data-level="${level}">
    <div class="tree-item-self is-clickable">
      <div class="tree-item-icon collapse-icon" id="${id}-arrow"><svg></svg></div>
      <div class="tree-item-inner">${id}</div>
    </div>
    <div class="tree-item-children">${children}</div>
  </div>`;
}
const TREE = item('l1', 1,
  item('l2a', 2,
    item('l3', 3,
      item('l4', 4,
        item('l5', 5))))
  + item('l2b', 2));

function fixture(bodyClass) {
  return `<!doctype html><html><head><style>
  body { margin: 0; }
  .collapse-icon { display: inline-block; width: 10px; height: 10px; }
${css}
  </style></head><body class="theme-dark ${bodyClass}">
  <div class="workspace-leaf-content" data-type="outline">
    <div class="nav-header"></div>
    <div class="view-content">${TREE}</div>
  </div>
  <div class="workspace-leaf-content" data-type="file-explorer">
    <div class="view-content">${item('fx1', 1, item('fx2', 2))}</div>
  </div>
  <pre id="out"></pre>
  <script>
  const vis = (id) => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none' && !el.closest('[style*="display: none"]') && isShown(el); };
  function isShown(el) { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; }
  const out = {};
  for (const id of ['l1','l2a','l2b','l3','l4','l5','fx1','fx2']) out[id] = vis(id);
  for (const id of ['l1','l2a','l3']) out[id + '-arrow'] = getComputedStyle(document.getElementById(id + '-arrow')).visibility;
  document.getElementById('out').textContent = JSON.stringify(out);
  </script></body></html>`;
}

const dir = mkdtempSync(join(tmpdir(), 'icor-outline-'));
let n = 0;
function render(bodyClass) {
  const file = join(dir, `o${n++}.html`);
  writeFileSync(file, fixture(bodyClass));
  const dom = execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=1500', '--dump-dom', `file://${file}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  const m = dom.match(/<pre id="out">([^<]*)<\/pre>/);
  assert.ok(m, 'the fixture produced no measurement');
  return JSON.parse(m[1].replace(/&quot;/g, '"'));
}

test('with no depth class every level of the Outline shows', () => {
  const r = render('');
  for (const id of ['l1', 'l2a', 'l2b', 'l3', 'l4', 'l5']) assert.ok(r[id], `${id} is hidden with no depth set`);
});

test('depth 1 shows only the top level', () => {
  const r = render('icor-outline-depth-1');
  assert.ok(r.l1, 'the top level vanished');
  for (const id of ['l2a', 'l2b', 'l3', 'l4', 'l5']) assert.equal(r[id], false, `${id} is still visible at depth 1`);
  assert.equal(r['l1-arrow'], 'hidden', 'the top level still shows a collapse arrow pointing at hidden children');
});

test('depth 2 shows two levels and stops', () => {
  const r = render('icor-outline-depth-2');
  assert.ok(r.l1 && r.l2a && r.l2b, 'a level within the depth is hidden');
  for (const id of ['l3', 'l4', 'l5']) assert.equal(r[id], false, `${id} is still visible at depth 2`);
  assert.equal(r['l2a-arrow'], 'hidden', 'the last visible level still shows an arrow');
  assert.equal(r['l1-arrow'], 'visible', 'an arrow above the cut was hidden too');
});

test('depth 3 shows three levels and stops', () => {
  const r = render('icor-outline-depth-3');
  assert.ok(r.l1 && r.l2a && r.l2b && r.l3);
  assert.equal(r.l4, false);
  assert.equal(r.l5, false);
});

test('depth 6 hides nothing in a five-deep outline', () => {
  const r = render('icor-outline-depth-6');
  for (const id of ['l1', 'l2a', 'l2b', 'l3', 'l4', 'l5']) assert.ok(r[id], `${id} hidden at depth 6`);
});

test('the depth rules never touch another pane\'s tree', () => {
  /* The file explorer uses the same .tree-item markup. Depth 1 on the
     Outline must not fold the vault's folders. */
  const r = render('icor-outline-depth-1');
  assert.ok(r.fx1 && r.fx2, 'the file explorer tree was folded by the Outline depth rule');
});
