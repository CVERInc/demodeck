/* demodeck.test.mjs — headless behavior tests for the demodeck control kit.
   Run: node --test test/   (also wired as `npm test`).

   Uses the tiny dependency-free DOM shim in ./dom-shim.mjs so the package can
   keep its "zero dependencies" promise — there is no test framework or jsdom. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installGlobals, h, El } from './dom-shim.mjs';

// Install a fresh global DOM, then import the module under test once.
const { document, clipboardStore } = installGlobals();
const { enhance, log } = await import('../demodeck.js');

function reset() {
  // wipe the body between tests
  document.body.children = [];
  clipboardStore.text = null;
  clipboardStore.fail = false;
}

// Drive a "click" the way demodeck wires it (event bubbles up via parent chain).
function dispatch(el, type, init = {}) {
  const ev = type === 'click'
    ? new (globalThis.MouseEvent || Event)(type, { bubbles: true, ...init })
    : new Event(type, { bubbles: true, ...init });
  // emulate bubbling through the shim tree to support delegated listeners
  let node = el;
  Object.defineProperty(ev, 'target', { value: el, configurable: true });
  while (node) {
    node.dispatchEvent(ev);
    node = node.parentNode;
  }
  return ev;
}

/* ─────────────────────────────────────────────────────────────────────────
   Bug A: an empty data-output on a range input made enhance() throw, because
   document.querySelector("") is a SyntaxError. The presence selector
   input[type=range][data-output] matches an EMPTY attribute, so a single
   malformed control could abort wiring of the whole page.
   ───────────────────────────────────────────────────────────────────────── */
test('enhance() survives a range with an empty data-output', () => {
  reset();
  const range = h('input', { type: 'range', 'data-output': '', value: '5' });
  document.body.appendChild(range);
  // also wire a copy button AFTER it to prove enhance() did not abort early.
  const code = h('code', { text: 'hi' });
  const box = h('div', { class: 'code-snippet-box' }, [
    code, h('button', { class: 'copy-btn' }),
  ]);
  document.body.appendChild(box);

  assert.doesNotThrow(() => enhance());

  // the copy button wired up despite the bad range before it
  const btn = box.querySelector('.copy-btn');
  dispatch(btn, 'click');
});

test('enhance() survives a range whose data-output is an invalid selector', () => {
  reset();
  const range = h('input', { type: 'range', 'data-output': '##nope', value: '5' });
  document.body.appendChild(range);
  assert.doesNotThrow(() => enhance());
});

/* ─────────────────────────────────────────────────────────────────────────
   Bug B: an empty data-popover threw inside wirePopover (querySelector("")).
   ───────────────────────────────────────────────────────────────────────── */
test('enhance() survives a header-edit-btn with an empty data-popover', () => {
  reset();
  const btn = h('button', { class: 'header-edit-btn', 'data-popover': '' });
  document.body.appendChild(btn);
  assert.doesNotThrow(() => enhance());
});

test('enhance() survives a header-edit-btn whose data-popover is invalid', () => {
  reset();
  const btn = h('button', { class: 'header-edit-btn', 'data-popover': 'not a selector!' });
  document.body.appendChild(btn);
  assert.doesNotThrow(() => enhance());
});

/* ─────────────────────────────────────────────────────────────────────────
   Bug C: a copy button with an invalid data-copy selector threw on click
   (the try/catch only guarded the clipboard call, not the querySelector).
   ───────────────────────────────────────────────────────────────────────── */
test('copy button with an invalid data-copy does not throw on click', () => {
  reset();
  const btn = h('button', { class: 'copy-btn', 'data-copy': '#@bad' });
  document.body.appendChild(btn);
  enhance();
  assert.doesNotThrow(() => dispatch(btn, 'click'));
});

/* ── Happy-path coverage so the fixes don't silently break real wiring ──── */

test('copy button copies the code text', async () => {
  reset();
  const code = h('code', { text: 'npm i demodeck' });
  const box = h('div', { class: 'code-snippet-box' }, [
    code, h('button', { class: 'copy-btn' }),
  ]);
  document.body.appendChild(box);
  enhance();
  dispatch(box.querySelector('.copy-btn'), 'click');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(clipboardStore.text, 'npm i demodeck');
});

test('range mirrors its value (+suffix) into the output element', () => {
  reset();
  const out = h('span', { id: 'out' });
  const range = h('input', { type: 'range', id: 'r', 'data-output': '#out', 'data-suffix': 'px', value: '24' });
  document.body.appendChild(out);
  document.body.appendChild(range);
  enhance();
  assert.equal(out.textContent, '24px');
  range.value = '40';
  dispatch(range, 'input');
  assert.equal(out.textContent, '40px');
});

test('option group single-selects and emits dd:change with the value', () => {
  reset();
  const a = h('button', { class: 'option-btn active', 'data-value': 'Card', text: 'Card' });
  const b = h('button', { class: 'option-btn', 'data-value': 'Pill', text: 'Pill' });
  const group = h('div', { class: 'option-group' }, [a, b]);
  document.body.appendChild(group);
  enhance();
  let got = null;
  group.addEventListener('dd:change', (e) => { got = e.detail.value; });
  dispatch(b, 'click');
  assert.equal(got, 'Pill');
  assert.ok(b.classList.contains('active'));
  assert.ok(!a.classList.contains('active'));
});

test('disabled option button does not select or emit', () => {
  reset();
  const a = h('button', { class: 'option-btn active', 'data-value': 'Card' });
  const b = h('button', { class: 'option-btn', 'data-value': 'Pill', disabled: true });
  const group = h('div', { class: 'option-group' }, [a, b]);
  document.body.appendChild(group);
  enhance();
  let fired = false;
  group.addEventListener('dd:change', () => { fired = true; });
  dispatch(b, 'click');
  assert.equal(fired, false);
  assert.ok(a.classList.contains('active'));
  assert.ok(!b.classList.contains('active'));
});

test('color field syncs picker, hex and preview and emits dd:color', () => {
  reset();
  const picker = h('input', { type: 'color', value: '#8b8bff' });
  const preview = h('span', { class: 'color-preview-circle' });
  const hex = h('input', { type: 'text', class: 'hex-text-input', value: '#8b8bff' });
  const field = h('div', { class: 'color-field' }, [picker, preview, hex]);
  document.body.appendChild(field);
  enhance();
  let got = null;
  field.addEventListener('dd:color', (e) => { got = e.detail.value; });
  hex.value = 'ef4444';
  dispatch(hex, 'input');
  assert.equal(got, '#ef4444');
  assert.equal(picker.value, '#ef4444');
  assert.equal(preview.style.backgroundColor, '#ef4444');
});

test('color field ignores invalid hex input', () => {
  reset();
  const picker = h('input', { type: 'color', value: '#8b8bff' });
  const hex = h('input', { type: 'text', class: 'hex-text-input', value: '#8b8bff' });
  const field = h('div', { class: 'color-field' }, [picker, hex]);
  document.body.appendChild(field);
  enhance();
  let fired = 0;
  field.addEventListener('dd:color', () => { fired++; });
  hex.value = '#xyz';
  dispatch(hex, 'input');
  assert.equal(fired, 0);
  assert.equal(picker.value, '#8b8bff');
});

test('log() appends a timestamped line and caps the buffer at 50', () => {
  reset();
  const body = h('div', { id: 'console' });
  document.body.appendChild(body);
  for (let i = 0; i < 60; i++) log('#console', 'line ' + i, 'info');
  assert.equal(body.childElementCount, 50);
  // first surviving line is line 10 (oldest 10 trimmed)
  assert.ok(body.firstChild.textContent.endsWith('line 10'));
  assert.ok(body.children.at(-1).textContent.endsWith('line 59'));
});

test('log() is a no-op for a missing target', () => {
  reset();
  assert.doesNotThrow(() => log('#nope', 'hi'));
});

test('enhance() is idempotent (safe to call repeatedly)', () => {
  reset();
  const a = h('button', { class: 'option-btn active', 'data-value': 'Card' });
  const b = h('button', { class: 'option-btn', 'data-value': 'Pill' });
  const group = h('div', { class: 'option-group' }, [a, b]);
  document.body.appendChild(group);
  enhance();
  enhance();
  enhance();
  let count = 0;
  group.addEventListener('dd:change', () => { count++; });
  dispatch(b, 'click');
  // wired exactly once → exactly one dd:change despite 3 enhance() calls
  assert.equal(count, 1);
});
