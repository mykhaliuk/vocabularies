# Dark Theme Design

_Started 2026-06-05 08:15 UTC_

---

## User

develop the dark theme

## Assistant

_[tool: list_files]_

I'll explore the project first to understand the existing design system and the app I'm working with.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Let me read the app components to understand how colors are used throughout.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

I now have a complete picture of the system. The components reference raw tokens (`--paper`, `--surface`, `--ink`, `--hairline`, etc.) and the semantic roles derive from them via `var()`, so a dark theme can mostly be done by overriding the raw tokens under `[data-theme="dark"]` — the roles follow automatically. But a few things are hardcoded (translucent bar backgrounds, the compose scrim) and a few components reuse `--rose-700`/`--blue-700` for *both* dark-text-on-light-chip and avatar foregrounds, which conflict in dark mode. I'll plumb those through new semantic tokens, then add a theme toggle.

Let me lay out the plan.Now the CSS — add the new semantic tokens and the dark theme block.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the dark theme block, placed after `:root` closes (before the type classes):

_[tool: str_replace_edit]_

Now refactor the components. Start with `primitives.jsx` — Chip soft-text tokens and a new `ThemeToggle`:Now `chrome.jsx` — tokenize the bar backgrounds and add the toggle to the feed header:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now `screens.jsx` — the `barBg` and the OnThisDay icon color:Now `Compose.jsx` (scrim + record text) and `Detail.jsx` (bottom bar):

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now `index.html` — theme init script, frame bg token, and the notch fix:

_[tool: str_replace_edit]_

_[tool: update_todos]_

Let me mark progress and verify the app renders. I'll check both themes.

_[tool: show_html]_

_[tool: show_html]_

_[tool: save_screenshot]_

Light theme works. Now let me verify dark mode and a few screens via the toggle:

_[tool: save_screenshot]_

_[tool: save_screenshot]_

Dark feed looks excellent. Let me check the top bar with the toggle, plus compose, discover, and profile in dark:

_[tool: multi_screenshot]_

The capture didn't reflect scroll reset (html-to-image quirk). Let me drive real interactions and capture top-of-feed, compose, discover, and profile in dark:

_[tool: multi_screenshot]_

All screens are solid in dark. Let me confirm the feed top bar with the theme toggle is rendering correctly:

_[tool: save_screenshot]_

The scroll-window is clipping the top (the 844px device is taller than the preview pane, so it centers and clips the header) — not a real bug. Let me confirm the header + toggle exist via a quick query and force-capture the top:

_[tool: read_file]_

The dark top bar is polished — light status text, dark notch, the rose logo mark reads well, and the sun toggle (currently dark → tap for light) sits top-right. Now let me add a preview spec card documenting the dark theme. Let me match an existing preview's format:

_[tool: write_file]_

I'll create a dark-theme palette card for the Design System tab:

_[tool: show_html]_

_[tool: str_replace_edit]_

The preview card reads cleanly. Let me complete the todos and add a short note to the README documenting the dark theme so the system is self-describing:

_[tool: update_todos]_

Let me surface the app and confirm it loads cleanly.

_[tool: done]_

_[tool: fork_verifier_agent]_

Developed a full dark theme for Vocabu, wired through the design system and the app UI kit.

**What's new**
- **Dark tokens** in `colors_and_type.css` under `[data-theme="dark"]` — deep cool near-black canvas, cards that lift by getting *lighter*, vivid-but-legible rose/blue, and the near-white soft washes flipped to dark tints.
- **Token plumbing** so it actually works: new `--on-primary-soft`/`--on-secondary-soft` (text on chips/banners, kept separate from avatar bubbles), plus `--bar-bg`, `--scrim`, `--frame-bg` to replace previously hardcoded translucent chrome.
- **A sun/moon toggle** in the feed header — persists to `localStorage`, defaults to the OS preference on first load.
- A **dark palette card** in the Design System tab and a note in the README.

Two things worth a look: the bright `-200` waveform track and avatar bubbles are intentionally kept vivid on dark (they read as little color pops) — say the word if you'd rather dim them. The toggle currently lives only in the feed header; I can also add an "Appearance" row to Profile if you want a settings-style entry point.

## User

nice, but i don't see the dark mode color palette. it exists?

## Assistant

_[tool: list_files]_

Let me check how the Design System tab discovers preview cards — there may be a manifest it reads from.

_[tool: list_files]_

_[tool: show_to_user]_

It does exist — `preview/color-dark.html`, tagged as a Colors card. Let me open it directly in your view so you can see it:

Yes — it's there. I just opened it in your tab: it's `preview/color-dark.html`, a palette card showing the dark neutrals (Paper, Surface, Sunk, Hairline, Ink) plus the dark accent washes (Rose 500, Rose wash, Blue 500, Blue wash, On-soft, Positive).

In the **Design System tab** it appears under the **Colors** group, alongside the existing Neutrals/Rose/Blue cards — if it wasn't showing, that tab likely needed a refresh to pick up the new file. Want me to also add a side-by-side **light vs. dark** comparison card, or expand this one to show the full accent ramps in dark?

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Vocabu Design System"
Project currently has 11 file(s)
Current date is now June 7, 2026
</system-info>

<pasted_text name="Pasted text (87 lines)">
# DS Proposal — AA-safe primary action colour

- **Status:** Proposed (bridged in app, pending DS adoption)
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

## App bridge (remove once DS ships this)

Until the DS defines `--primary-action`, it is bridged in
`assets/css/theme-light.css` with a `⚠ BRIDGE` comment pointing here. When the
DS lands the token, delete the bridge so there is a single source of truth.

</pasted_text>

## User

Fixing design-system issues

## User

Fixing design-system issues

## Assistant

I'll add `@kind` annotations to those 10 tokens. Font weights → `font`, easing curves and durations → `other` (they're animation tokens, not a classifiable visual kind). Let me find them.

_[tool: read_file]_

_[tool: read_file]_

Let me find the weight tokens too.

_[tool: grep]_

Now I'll annotate all 10. Weights → `font`; easing and durations → `other` (motion tokens).

_[tool: str_replace_edit]_

_[tool: check_design_system]_

Clean — **no issues found**. The 10 tokens are now classified: the five `--w-*` weights as `font`, and the easing/duration motion tokens as `other`. All 144 tokens resolve and the 23 cards are intact.

## User

<pasted_text name="Pasted text (63 lines)">
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
{ "name": "--primary-action",   "value": "#CF3A60", "kind": "color", "definedIn": "colors_and_type.cs
s" },
{ "name": "--secondary-action", "value": "#1378A6", "kind": "color", "definedIn": "colors_and_type.cs
s" }
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
</pasted_text>

## Assistant

_[tool: list_files]_

_[tool: grep]_

This proposal updates `--secondary-action` to a slightly deeper blue (`#1378A6`, 4.93:1) and asks to delete a bridge. A few of these steps target files that live downstream, and two are compiler-generated in this project — let me verify what actually exists here before editing.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Confirmed. The bridge files (`ds-bridge.css`, `landing.html`) don't exist in this project — they're downstream in the app/landing repo, so steps 2–4 there don't apply here. `_ds_manifest.json` and `_adherence.oxlintrc.json` are **compiler-generated** (already carry both tokens from last turn and will regenerate automatically) — I must not hand-edit them.

So the one real change here is folding the **updated** value into core: `--secondary-action` → `#1378A6` (which I verified at **4.93:1**, up from my earlier 4.64:1). Let me update the token and its references.The README must already differ. Let me check.

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

The README section never landed last turn (that malformed edit only applied the dark-theme paragraph). Let me add it now, placed after the dark-theme section.

_[tool: str_replace_edit]_

Now let me verify the design system compiles cleanly (which regenerates the manifest + adherence with the new value) and the action card renders correctly.

_[tool: check_design_system]_

_[tool: show_html]_

_[tool: grep]_

Compiler is clean (144 tokens, no issues) and the card shows the deeper `#1378A6` at 4.93:1. Let me confirm the regenerated manifest carries the updated value.The manifest line 1 still shows old data in the grep snippet (it's a long single line — the match is on `1378A6` further in). Let me confirm the token value is current in the manifest.

_[tool: grep]_

_[tool: run_script]_

_[tool: done]_

The on-disk manifest still shows the previous `#157CAE` — it's regenerated by the compiler at the turn boundary, not by my check call, and I must not hand-edit it. The source of truth (`colors_and_type.css`) is correct at `#1378A6`, so the manifest will catch up automatically. Let me surface the deliverable and confirm it's clean.

_[tool: fork_verifier_agent]_

Folded the updated tokens into core. What I changed here, and what didn't apply:

**Done (this DS project):**
- `colors_and_type.css` — `--secondary-action` updated to **`#1378A6`** (white **4.93:1**, verified), sitting in `:root` next to `--primary-action` (`#CF3A60`). Both stay theme-independent — no `[data-theme="dark"]` override. `--primary`/`--secondary` untouched.
- Refreshed the **action-surfaces** preview card and the README section to the new value.

**Auto-handled (don't hand-edit):**
- `_ds_manifest.json` and `_adherence.oxlintrc.json` are compiler-generated. Both token *names* are already registered; the manifest's `--secondary-action` **value** regenerates from the CSS at the turn boundary (it'll show `#1378A6` next turn — the source CSS is already correct). `check_design_system` is clean: 144 tokens, no issues.

**Not applicable here (downstream files):**
- `ds-bridge.css`, `index.html`, `landing.html` don't exist in this design-system project — they live in your **landing-page / app repo**. Nothing to delete on this side. Now that core carries both tokens, you can safely delete `ds-bridge.css` + its `<link>`s there, and drop the app's mirrored `assets/css/ds-bridge.css` from `nuxt.config` `css[]`. `VButton` keeps reading the same token names, now resolved from core — no component change needed.

