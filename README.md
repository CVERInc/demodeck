# demodeck

> **A polished dark "control panel" template for open-source demos.** A premium header, a two-column layout, and a kit of dark-themed controls — segmented buttons, sliders, color fields, toggles, styled selects, popovers, a live console terminal, and a copyable code box. Drop a live preview on the right and you have an interactive playground for your library in minutes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-success)](#)
[![Pure CSS](https://img.shields.io/badge/core-pure%20CSS-blue)](#)

🌐 日本語の紹介 → [cver.net/ja-jp/oss/demodeck](https://cver.net/ja-jp/oss/demodeck) ・ 繁體中文介紹 → [cver.net/zh-tw/oss/demodeck](https://cver.net/zh-tw/oss/demodeck)

> **[Live demo →](https://oss.cver.net/demodeck/)**

---

## Why

Every good OSS project deserves a demo where people can *play* with it — toggle options, drag sliders, watch the result update live. Building that chrome from scratch each time is a chore. `demodeck` gives you the whole interactive shell, dark and premium out of the box, so you can spend your effort on the thing you're actually demoing.

It pairs naturally with a live preview — including [liquidframe](https://github.com/CVERInc/liquidframe) if your project is mobile/web UI.

---

## Quick start

```html
<link rel="stylesheet" href="demodeck.css">
<script type="module" src="demodeck.js"></script>

<body class="dd">
  <header class="dd-header">…</header>
  <main class="dd-main">
    <div class="control-panel"><!-- your controls --></div>
    <div><!-- your live preview --></div>
  </main>
  <footer class="dd-footer">…</footer>
</body>
```

The fastest path is to **open `index.html`, view source, and copy the pieces you want** — it wires up every component against a live preview card.

Add `class="dd"` to `<body>` (or any wrapper) to opt in to the base page styling.

---

## Components

All styling is pure CSS. `demodeck.js` adds the interactive behaviors — include it and call `enhance()` (or just load it as a module script; it auto-runs).

| Component | Markup | Behavior (auto-wired) |
|---|---|---|
| **Segmented buttons** | `.option-group > .option-btn[data-value]` | Single-select; fires `dd:change` `{ value }` on the group |
| **Slider** | `input[type=range][data-output="#id"]` | Mirrors value into `#id` (+ optional `data-suffix`) |
| **Color field** | `.color-field` with `input[type=color]`, `.color-preview-circle`, `.hex-text-input` | Keeps all three in sync; fires `dd:color` `{ value }` |
| **Color presets** | `.color-presets > .color-btn` | Style only — wire clicks yourself |
| **Toggle** | `.switch > input[type=checkbox] + .slider-toggle` | Native checkbox; listen to `change` |
| **Styled select** | `select.dd-select` | Native select |
| **Popover** | `.header-edit-btn[data-popover="#id"]` + `.popover-card#id` | Toggles open; outside-click closes |
| **Live console** | `.live-console > … > .terminal-body#id` | Append lines with `log('#id', msg, type)` |
| **Code box** | `.code-snippet-box` with a `.copy-btn` | Copies the `<code>` inside (or `data-copy="#sel"`) |

### Events

```js
group.addEventListener('dd:change', (e) => console.log(e.detail.value));  // option group
field.addEventListener('dd:color',  (e) => console.log(e.detail.value));  // color field
```

### Console logging

```js
import { log } from './demodeck.js';
log('#console', 'Accent updated', 'state');   // types: info | system | state | error
```

---

## Theming

Override any of these in `:root` (or on a wrapper):

| Variable | Default | |
|---|---|---|
| `--dd-accent` | `#8b8bff` | primary accent |
| `--dd-accent-hover` | `#a9a9ff` | accent (hover/values) |
| `--dd-accent-ink` | `#14132b` | text on top of the accent |
| `--dd-bg` | `#0c0d12` | base background |
| `--dd-bg-gradient` | radial glow + `--dd-bg` | page background |
| `--dd-surface` | `rgba(255,255,255,.03)` | panel surface |
| `--dd-border` | `rgba(255,255,255,.08)` | borders |
| `--dd-text` / `--dd-text-muted` | near-white | text |
| `--dd-radius` | `16px` | base radius |
| `--dd-font` / `--dd-mono` | system stacks | fonts |

```css
:root { --dd-accent: #10b981; --dd-accent-ink: #04231a; }
```

---

## Layout

```
body.dd
├── .dd-header        logo + .dd-badge + .toggle-container + .dd-ghlink
├── .dd-main          two-column grid (stacks under 1024px)
│   ├── .control-panel
│   │   └── .panel-section ×N   (.panel-section-header > h3 + .header-edit-btn)
│   └── (your live preview)
└── .dd-footer        .footer-links + .link-underline
```

---

## Browser support

Every current evergreen browser (Chrome, Safari, Firefox, Edge). The clipboard copy needs a secure context (`https://` or `localhost`).

## License

MIT
