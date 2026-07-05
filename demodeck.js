/* ===========================================================================
   demodeck.js — OPTIONAL interactive behaviors for the demodeck control kit.

   Auto-wires, on enhance():
     • .copy-btn          → copies the <code> in the closest .code-snippet-box
                            (or data-copy="#selector"); shows a "Copied!" state.
     • .header-edit-btn[data-popover="#id"]
                          → toggles that .popover-card; outside-click closes all.
     • .option-group      → clicking an .option-btn sets it active (single-select)
                            and fires an "dd:change" event { value } on the group.
     • .color-field       → keeps input[type=color] ⇄ .color-preview-circle ⇄
                            .hex-text-input in sync; fires "dd:color" { value }.
     • input[type=range][data-output="#id"]
                          → mirrors the value into that element (+ optional
                            data-suffix), and keeps it updated.

   Plus a console helper:
     log(target, message, type?)  // type: 'info' | 'system' | 'state' | 'error'

   Usage (ES module):
     import { enhance, log } from './demodeck.js';
     enhance();

   Usage (plain script): auto-runs enhance() and exposes window.demodeck.

   MIT License.
   =========================================================================== */

const HEX_RE = /^#[0-9a-f]{6}$/i;
const HEX_RE_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
let docListenerAdded = false;

// Safe querySelector: an empty or malformed selector (e.g. data-output="") would
// otherwise throw a SyntaxError. Authoring slips like that should be inert, not
// abort enhance() and take the rest of the page's wiring down with them.
function safeQuery(selector, scope = document) {
  if (typeof selector !== 'string' || selector.trim() === '') return null;
  try {
    return scope.querySelector(selector);
  } catch (_) {
    return null; // invalid selector string
  }
}

function resolve(elOrSelector, scope = document) {
  if (!elOrSelector) return null;
  return typeof elOrSelector === 'string' ? safeQuery(elOrSelector, scope) : elOrSelector;
}

// Wire an element at most once, so enhance() is safe to call repeatedly.
function once(el, tag) {
  const key = '__dd_' + tag;
  if (el[key]) return false;
  el[key] = true;
  return true;
}

/* ── Copy buttons ──────────────────────────────────────────────────────── */
function wireCopy(btn) {
  btn.addEventListener('click', async () => {
    const target = btn.dataset.copy
      ? safeQuery(btn.dataset.copy)
      : btn.closest('.code-snippet-box')?.querySelector('code');
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.innerText);
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    } catch (_) {
      /* clipboard blocked (e.g. insecure context) — ignore */
    }
  });
}

/* ── Popovers ──────────────────────────────────────────────────────────── */
function closeAllPopovers() {
  document.querySelectorAll('.popover-card.visible').forEach((p) => p.classList.remove('visible'));
}

function wirePopover(btn) {
  const card = safeQuery(btn.dataset.popover);
  if (!card) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willShow = !card.classList.contains('visible');
    closeAllPopovers();
    card.classList.toggle('visible', willShow);
  });
  card.addEventListener('click', (e) => e.stopPropagation());
}

/* ── Option groups (segmented single-select) ───────────────────────────── */
function wireOptionGroup(group) {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn || btn.disabled) return;
    group.querySelectorAll('.option-btn').forEach((b) => b.classList.toggle('active', b === btn));
    const value = btn.dataset.value ?? btn.dataset.mode ?? btn.textContent.trim();
    group.dispatchEvent(new CustomEvent('dd:change', { detail: { value, button: btn }, bubbles: true }));
  });
}

/* ── Color fields (picker ⇄ preview ⇄ hex) ─────────────────────────────── */
function wireColorField(field) {
  const picker = field.querySelector('input[type="color"]');
  const preview = field.querySelector('.color-preview-circle');
  const hex = field.querySelector('.hex-text-input');

  const apply = (value, from) => {
    let v = value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    const short = v.match(HEX_RE_SHORT);
    if (short) v = '#' + short.slice(1).map((c) => c + c).join('');
    if (!HEX_RE.test(v)) return;
    if (picker && from !== 'picker') picker.value = v;
    if (hex && from !== 'hex') hex.value = v;
    if (preview) preview.style.backgroundColor = v;
    field.dispatchEvent(new CustomEvent('dd:color', { detail: { value: v }, bubbles: true }));
  };

  if (picker) picker.addEventListener('input', (e) => apply(e.target.value, 'picker'));
  if (hex) hex.addEventListener('input', (e) => apply(e.target.value, 'hex'));

  // Initialize preview from whichever value is present.
  const initial = (picker && picker.value) || (hex && hex.value) || '';
  if (initial) apply(initial, null);
}

/* ── Range outputs ─────────────────────────────────────────────────────── */
function wireRange(input) {
  const out = safeQuery(input.dataset.output);
  if (!out) return;
  const suffix = input.dataset.suffix || '';
  const render = () => { out.textContent = input.value + suffix; };
  input.addEventListener('input', render);
  render();
}

/* ── Console logger ────────────────────────────────────────────────────── */
export function log(target, message, type = 'info') {
  const body = resolve(target);
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'console-log-line ' + type;
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  line.textContent = `[${hh}:${mm}:${ss}] ${message}`;
  body.appendChild(line);
  while (body.childElementCount > 50) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
}

/* ── Enhance ───────────────────────────────────────────────────────────── */
export function enhance(root = document) {
  root.querySelectorAll('.copy-btn').forEach((el) => once(el, 'copy') && wireCopy(el));
  root.querySelectorAll('.header-edit-btn[data-popover]').forEach((el) => once(el, 'pop') && wirePopover(el));
  root.querySelectorAll('.option-group').forEach((el) => once(el, 'group') && wireOptionGroup(el));
  root.querySelectorAll('.color-field').forEach((el) => once(el, 'color') && wireColorField(el));
  root.querySelectorAll('input[type="range"][data-output]').forEach((el) => once(el, 'range') && wireRange(el));
  if (!docListenerAdded) {
    document.addEventListener('click', closeAllPopovers);
    docListenerAdded = true;
  }
}

if (typeof window !== 'undefined') {
  window.demodeck = { enhance, log };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhance());
  } else {
    enhance();
  }
}
