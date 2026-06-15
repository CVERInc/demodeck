/* dom-shim.mjs — a tiny, dependency-free DOM good enough to exercise demodeck.js.
   NOT shipped (lives under test/, excluded from the npm tarball by the "files"
   allowlist). Keeps demodeck's "zero dependencies" promise intact while still
   letting us drive the behavior layer headlessly.

   It is deliberately minimal: it supports only the DOM surface demodeck.js
   actually touches (classList, dataset, style, a CSS-subset querySelector,
   closest, simple child management, and EventTarget-based events). */

class TokenList {
  constructor() { this._set = new Set(); }
  add(...t) { t.forEach((x) => x && this._set.add(x)); }
  remove(...t) { t.forEach((x) => this._set.delete(x)); }
  contains(t) { return this._set.has(t); }
  toggle(t, force) {
    const has = this._set.has(t);
    const want = force === undefined ? !has : !!force;
    if (want) this._set.add(t); else this._set.delete(t);
    return want;
  }
  get value() { return [...this._set].join(' '); }
}

let nextId = 1;

export class El extends EventTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = String(tag).toUpperCase();
    this.classList = new TokenList();
    this.dataset = {};
    this.style = new Proxy({ _props: {} }, {
      get(t, p) {
        if (p === 'setProperty') return (k, v) => { t._props[k] = v; };
        if (p === 'getPropertyValue') return (k) => t._props[k] ?? '';
        if (p === '_props') return t._props;
        return t._props[p] ?? '';
      },
      set(t, p, v) { t._props[p] = v; return true; },
    });
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this._text = '';
    this.value = undefined;
    this.disabled = false;
    this.checked = false;
    this._uid = nextId++;
  }

  // --- attributes ---
  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = String(val);
    }
    if (name === 'type') this.type = String(val);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return name in this.attributes; }

  // --- text ---
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join('');
    return this._text;
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }

  // --- tree ---
  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentNode = null;
    return node;
  }
  get firstChild() { return this.children[0] ?? null; }
  get childElementCount() { return this.children.length; }
  get scrollHeight() { return this.children.length * 10; }

  // --- queries (tiny CSS subset: tag, .class, #id, [attr], [attr="v"], descendant combos) ---
  _descendants() {
    const out = [];
    const walk = (n) => { for (const c of n.children) { out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  matches(sel) { return matchSimple(this, parseSimple(sel.trim())); }
  querySelector(sel) {
    const compound = parseSelector(sel); // throws on invalid/empty, like a real browser
    for (const node of this._descendants()) if (matchChain(node, compound, this)) return node;
    return null;
  }
  querySelectorAll(sel) {
    const compound = parseSelector(sel);
    return this._descendants().filter((node) => matchChain(node, compound, this));
  }
  closest(sel) {
    const simple = parseSelector(sel);
    let n = this;
    while (n) { if (matchChain(n, simple, null)) return n; n = n.parentNode; }
    return null;
  }
}

// --- selector engine -------------------------------------------------------
function parseSelector(sel) {
  if (typeof sel !== 'string') throw new SyntaxError('selector must be a string');
  const trimmed = sel.trim();
  if (trimmed === '') throw new SyntaxError("Failed to execute 'querySelector': The provided selector is empty.");
  // descendant combinator → array of simple selectors (right-most last)
  const parts = trimmed.split(/\s+/).map(parseSimple);
  return parts;
}

function parseSimple(s) {
  // supports a chain like: tag#id.cls[attr][attr="v"]
  const m = {
    tag: null, id: null, classes: [], attrs: [],
  };
  const re = /([#.]?[\w-]+)|(\[[^\]]*\])/g;
  let match;
  let any = false;
  let consumed = 0;
  while ((match = re.exec(s))) {
    // Reject garbage between tokens (e.g. "##nope", "a b!c") like a real browser.
    if (match.index !== consumed) throw new SyntaxError('invalid selector: ' + s);
    consumed = re.lastIndex;
    any = true;
    const tok = match[0];
    if (tok.startsWith('#')) m.id = tok.slice(1);
    else if (tok.startsWith('.')) m.classes.push(tok.slice(1));
    else if (tok.startsWith('[')) {
      const inner = tok.slice(1, -1);
      const am = inner.match(/^([\w-]+)(?:=["']?([^"']*)["']?)?$/);
      if (!am) throw new SyntaxError('bad attribute selector: ' + tok);
      m.attrs.push([am[1], am[2]]);
    } else m.tag = tok.toUpperCase();
  }
  if (!any || consumed !== s.length) throw new SyntaxError('invalid selector: ' + s);
  return m;
}

function matchSimple(node, m) {
  if (m.tag && node.tagName !== m.tag) return false;
  if (m.id && node.attributes.id !== m.id) return false;
  for (const c of m.classes) if (!node.classList.contains(c)) return false;
  for (const [name, val] of m.attrs) {
    const present = name in node.attributes;
    if (!present) return false;
    if (val !== undefined && node.attributes[name] !== val) return false;
  }
  return true;
}

function matchChain(node, chain, root) {
  // chain is right-most last; verify ancestry up to (but excluding) root
  if (!matchSimple(node, chain[chain.length - 1])) return false;
  let i = chain.length - 2;
  let anc = node.parentNode;
  while (i >= 0) {
    let found = false;
    while (anc && anc !== root) {
      if (matchSimple(anc, chain[i])) { found = true; anc = anc.parentNode; break; }
      anc = anc.parentNode;
    }
    if (!found) return false;
    i--;
  }
  return true;
}

// --- document / window factory --------------------------------------------
export function makeDocument() {
  const doc = new El('#document');
  doc.body = new El('body');
  doc.appendChild(doc.body);
  doc.readyState = 'complete';
  doc.createElement = (tag) => new El(tag);
  // document-level query/listen delegate to body subtree (+ a real listener target)
  const origQS = doc.querySelector.bind(doc);
  const origQSA = doc.querySelectorAll.bind(doc);
  doc.querySelector = (sel) => origQS(sel);
  doc.querySelectorAll = (sel) => origQSA(sel);
  return doc;
}

export function installGlobals() {
  const document = makeDocument();
  const clipboardStore = { text: null, fail: false };
  globalThis.document = document;
  globalThis.window = globalThis;
  const navigator = {
    clipboard: {
      writeText: async (t) => {
        if (clipboardStore.fail) throw new Error('clipboard blocked');
        clipboardStore.text = t;
      },
    },
  };
  // navigator is a read-only global in modern Node; override it for the test run.
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });
  return { document, clipboardStore };
}

// Build an element subtree from a compact spec for terse tests.
export function h(tag, props = {}, children = []) {
  const el = new El(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') v.split(/\s+/).forEach((c) => c && el.classList.add(c));
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else if (k === 'disabled') el.disabled = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) el.appendChild(c);
  return el;
}
