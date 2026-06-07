# DS Proposal — AA-safe primary action colour

- **Status:** ✅ Resolved — shipped in DS core (2026-06-07); bridge removed
- **Date:** 2026-06-07
- **Raised from:** Vocabu landing page Lighthouse pass (accessibility)
- **Owner:** DS team

## Problem

Primary call-to-action buttons render **white text on `--primary` (rose-500,
`#ed5379`)**. That pairing is only **3.43:1**, which fails WCAG 2.1 AA (SC
1.4.3 requires **4.5:1** for normal-size text). It affects every primary CTA
(landing hero, `/login`, error page, etc.), and is **worse in dark mode**.

Measured WCAG contrast of white (`#ffffff`) on the rose ramp:

| token / step            | hex       | white text | AA (≥4.5) |
| ----------------------- | --------- | ---------- | --------- |
| `--primary` (rose-500)  | `#ed5379` | 3.43:1     | ❌ fail   |
| rose-600 (`--primary-hover`) | `#d93c64` | 4.39:1 | ❌ fail (just) |
| rose-700 (`--primary-press`) | `#b22f52` | 6.14:1 | ✅ pass  |
| dark rose-500 (`#f2658a`) | `#f2658a` | 3.00:1   | ❌ fail   |
| dark rose-600 (`#f0577e`) | `#f0577e` | 3.30:1   | ❌ fail   |

Note: even `rose-600` narrowly misses (4.39), and the dark-theme rose steps
fail badly — so the ramp **has no existing step** that is AA-safe with white
between "vivid" and "pressed".

## Scope / non-goals

`--primary` (rose-500) is **correct and should stay** for every non-text use:
hero washes, the eyebrow dot, focus rings, `--like`, soft fills. The gap is
specifically **text-on-accent** — a white label sitting on a rose surface.

## Proposal

Introduce a dedicated semantic role for the **actionable** primary surface,
separate from the brand accent:

```css
/* light + dark: theme-independent on purpose — this is the button surface,
   not a tinted role, so it must clear AA with white in both themes. */
--primary-action: #cf3a60; /* white text → 4.74:1  (AA pass, both themes) */
```

Candidates if a different balance is preferred (all pass AA with white):

| hex       | white text | feel                          |
| --------- | ---------- | ----------------------------- |
| `#d4385f` | 4.64:1     | closest to rose-600, vivid    |
| `#cf3a60` | 4.74:1     | **recommended** — vivid + safe margin |
| `#c9365d` | 5.04:1     | a touch deeper                |
| `#b22f52` | 6.14:1     | = rose-700, deepest / safest  |

Consumption (already wired in the app, will switch to the DS token verbatim):

```css
.v-btn--primary {
  background: var(--primary-action);
  color: var(--text-on-accent); /* #fff */
}
```

Hover keeps the existing `filter: brightness(0.94)` (no separate token needed).

## Related (same latent gap — please consider together)

- **Secondary/blue action:** white on `--secondary` (blue-500 `#1f9edb`) is
  ~2.9:1 — fails too. Recommend a parallel **`--secondary-action`** by the same
  logic (used by `VButton variant="blue"`).
- **Dark-mode accents generally:** the bright dark rose/blue steps are tuned
  for fills, not for white text. A theme-independent `*-action` pair sidesteps
  this cleanly.

## Acceptance criteria

1. White on `--primary-action` ≥ 4.5:1 in **light and dark**.
2. `--primary` (rose-500) unchanged for non-text accent uses.
3. Lighthouse accessibility `color-contrast` passes on the landing (it does
   with the bridge value).

## Resolution (2026-06-07)

1. The DS first adopted this as a stopgap **`ds-bridge.css`**, then (per the
   instructions below) **promoted both tokens into the DS core**
   `colors_and_type.css` `:root` — theme-independent, registered in
   `_ds_manifest.json` (now 144 tokens) and `_adherence.oxlintrc.json`. The
   DS no longer ships a bridge.
2. App followed downstream: `--primary-action` / `--secondary-action` now live
   in `assets/css/theme-light.css` (the core mirror); `assets/css/ds-bridge.css`
   and its `nuxt.config` `css[]` entry were **deleted**. `VButton` reads the
   same token names, unchanged.

Net: single source of truth in the DS core, no bridge anywhere. The
instructions below are kept for the record.

---

## Instructions that were sent to the DS developer — promote to core

The bridge (`ds-bridge.css`) was the right *first* step, but it leaves two
AA-safe tokens living outside the design system. Please fold them into the
**core** so the bridge can be deleted everywhere. Four edits + one deletion,
all inside the `_ds/.../` package.

### 1. `colors_and_type.css` — add the tokens to `:root`

In the **SEMANTIC ROLES** block (next to `--primary*` / `--secondary*`), add:

```css
  /* Actionable accent surfaces — white text sits ON these. --primary /
     --secondary are only 3.43:1 / 2.9:1 with white (fail WCAG AA 1.4.3);
     these clear 4.5:1, so they are theme-independent ON PURPOSE — do NOT
     re-declare them under [data-theme="dark"]. */
  --primary-action:   #CF3A60;  /* white text → 4.74:1 */
  --secondary-action: #1378A6;  /* white text → 4.93:1 */
```

Do **not** add overrides in the `[data-theme="dark"]` block — the values are
AA-safe against white in both themes, so a single `:root` definition is
correct. `--primary` / `--secondary` stay exactly as they are (washes, dots,
focus rings, `--like`, soft fills are non-text and already clear the 3:1 bar).

### 2. `_ds_manifest.json` — register both tokens

Append to the `tokens` array (same shape as the existing color tokens):

```json
{ "name": "--primary-action",   "value": "#CF3A60", "kind": "color", "definedIn": "colors_and_type.css" },
{ "name": "--secondary-action", "value": "#1378A6", "kind": "color", "definedIn": "colors_and_type.css" }
```

(Token count goes 142 → 144. No `scope` key, since they are theme-independent.)

### 3. `_adherence.oxlintrc.json` — allowlist both names

Add `"--primary-action"` and `"--secondary-action"` to the allowed-token list
(keep it sorted): `--primary-action` goes between `--primary` and
`--primary-hover`; `--secondary-action` goes between `--secondary` and
`--secondary-hover`.

### 4. Delete the bridge

- Delete `ds-bridge.css`.
- Remove `<link rel="stylesheet" href="ds-bridge.css" />` from **`index.html`**
  and **`landing.html`**.

### Acceptance criteria

1. White on `--primary-action` ≥ 4.5:1 **and** white on `--secondary-action` ≥
   4.5:1, in **light and dark** (theme-independent satisfies this).
2. `--primary` / `--secondary` unchanged.
3. Adherence lint passes; manifest lists both new tokens.
4. No `ds-bridge.css` and no `<link>` to it remain anywhere.

### After the DS ships this (downstream apps)

The Vocabu app currently mirrors the bridge in `assets/css/ds-bridge.css`. Once
the DS package carries the tokens in core, the app deletes that file + its
entry in `nuxt.config` `css[]`; `VButton` keeps reading the same token names,
now resolved from the core — no component change needed.
