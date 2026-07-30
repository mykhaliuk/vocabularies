# Vocabu — prototype export (refreshed)

Drop-in replacement for the `project/` folder of the Claude Design handoff
bundle. Unzip and replace `design/prototype/project/` with this folder's
contents (or just its `Vocabu/` and `_ds/` subfolders).

## What's inside
- `project/Vocabu/` — the clickable prototype (entry point: `Vocabu/index.html`;
  also `landing.html` and `404.html`). Built with React + Babel inline JSX.
- `project/_ds/` — the bound **Vocabu Design System** snapshot the prototype
  links (`colors_and_type.css`, `_ds_bundle.js`, manifest, adherence, README).

## What changed since the previous export
- **Design system rebound** to the current version (145 tokens). The bound
  `_ds/colors_and_type.css` now natively ships `--primary-action` (#CF3A60),
  `--secondary-action` (#1378A6) and `--font-hand` (Caveat), plus the Caveat
  `@import` and the dark theme under `[data-theme="dark"]`.
- **`ds-bridge.css` removed.** It was a temporary local shim providing those
  three tokens before the DS shipped them — now redundant. Its `<link>` and the
  now-redundant local Caveat `<link>`s were removed from `index.html`,
  `landing.html` and `404.html`. Single source of truth = the design system.

## Run it
Open `project/Vocabu/index.html` in a browser. Pages reference `../_ds/…`
relatively, so keep `Vocabu/` and `_ds/` siblings under `project/`.

## Pages
- `index.html` — the app: magic-link login → feed (with empty state, on-this-day
  band) → compose (voice upload) → word detail → discover / saved / profile /
  settings; offline state; light + dark.
- `landing.html` — marketing landing with magic-link capture.
- `404.html` — "not in the dictionary" error page.
