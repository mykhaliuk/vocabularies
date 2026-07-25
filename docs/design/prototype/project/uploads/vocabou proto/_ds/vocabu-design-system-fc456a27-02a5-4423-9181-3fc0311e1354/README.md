# Vocabu — Design System

> **Never lose your sweet moments.**

Vocabu (from *vocabulary*) is a mobile-first **progressive web app** for keeping a personal dictionary of **the memorable ways the people in your life talk** — a toddler's first words, a friend's ridiculous catchphrase, a grandparent's saying, a parent's hard-won wisdom. Each entry captures the **word or phrase**, an optional short **meaning**, the **story** behind it, and — ideally — an **audio sample** of them actually saying it. It feels like a gentler, more personal Twitter: a flowing feed of entries, but warm, unhurried, and built for keeping rather than performing.

This repository is a **brand + product design system**: design tokens, type and color foundations, brand assets, voice guidelines, and a high-fidelity UI kit that recreates the core app experience.

---

## ⚠️ About this system's origins

This design system was generated from a **written brief plus a follow-up clarification** from the founder — no codebase, Figma file, or existing assets were provided. The brand name, tagline, and visual direction come from the brief; the product concept (a personal dictionary of how loved ones talk, with optional audio and a social feed) was confirmed in conversation. **The logo, font, and icon set are still chosen defaults** and should be reviewed. See **CAVEATS** at the bottom.

---

## Product context

- **One product:** the Vocabu PWA (installable, mobile-first).
- **The entry (core object):** a *word or phrase* + who said it (speaker + relation, e.g. “Mira · my daughter · 22 mo” or “Dad”) + an optional one-line meaning/gloss + an unfoldable story + an optional **audio sample** (waveform player). Entries live in collections (“Mira's words”, “Dad's wisdom”, “Theo-isms”).
- **Core loop:** open the feed → read entries from your own and followed dictionaries → tap compose (thumb-reachable, bottom-centre) → type the word, who said it, a meaning + story, record their voice, file it in a collection → it's kept forever and appears in the feed.
- **Social aspect:** like, reply, save; follow other people's dictionaries; “On this day” resurfaces a past entry.
- **Key surfaces recreated in the UI kit:** Feed, Compose, Word detail (+ replies), Saved / Collections, Profile (“my dictionary”). (See `ui_kits/app/`.)

### Sources given
- Written brief: company = *Vocabu* (short for *vocabulary*), tagline = *"Never lost your sweet moments."*, notes on PWA / mobile-first / thumb-zone UX / clean near-white + near-black with bright rose & light blue accents / Twitter-like / quiet interactive elements / single sans-serif type.
- Founder clarification: it's a personal dictionary of how the people you love talk — a child's first words, a friend's funny phrases, a parent's wisdom — each with word/phrase, an unfoldable description, and an optional audio sample.
- No external links, repos, or files were attached.

---

## CONTENT FUNDAMENTALS — how Vocabu writes

The voice is **warm, plain, and intimate** — a close friend, not a product. Moments are precious but never precious *about themselves*.

- **Person:** Speaks to the user as **"you"**, and lets the user speak as **"I"**. The app rarely refers to itself; it stays out of the way. ("Kept." not "Vocabu has saved your entry.") The *words themselves* belong to the people quoted — never sanitise or correct them.
- **Tone:** Quiet, tender, a little funny. It treats a toddler's mispronunciation and a grandfather's proverb with the same affection. Grounded, specific, never saccharine.
- **Casing:** **Sentence case everywhere** — buttons, titles, labels. Title Case feels corporate. ALL CAPS only for tiny tracked overlines ("ON THIS DAY").
- **Length:** Short. UI copy is one breath. Empty states are one warm line, not a paragraph.
- **Punctuation:** Gentle. Periods and the occasional em-dash. Avoid exclamation marks and hype.
- **Emoji:** **None in the product UI / chrome.** Users may of course type emoji into their own entries — that's their voice, not ours.
- **Numbers / data:** De-emphasized. Counts are small and quiet; no dashboards, streaks, or "engagement." This is a keepsake, not a game.

**Examples**

| Context | ✓ Vocabu | ✕ Not Vocabu |
|---|---|---|
| Compose placeholder | `The word or phrase` / `Who said it` | `Share your thoughts!` |
| Empty feed | `No words yet. Keep the first thing someone says that makes you smile.` | `No posts found.` |
| Save confirmation | `Kept.` | `Entry successfully added!` |
| On-this-day | `A year ago you saved your dad's “Don't trust a quiet dog.”` | `MEMORY UNLOCKED 🎉` |
| Button | `New word` | `Create Post` |

---

## VISUAL FOUNDATIONS

The whole system reads **clean, bright, and almost-monochrome**, with two vivid accents used sparingly. Interactive elements are present but quiet — accessible without shouting.

- **Color vibe:** Clean near-white (`--paper #FCFCFB`) canvas; near-black (`--ink #1E1C1A`) text — *never* pure `#FFF`/`#000`. Two bright, vivid accents: **rose** (`#ED5379`, primary — actions, likes, emphasis, the emotional accent) and **light blue** (`#1F9EDB`, secondary — links, info, calm). Accents appear in small, confident doses against lots of clean neutral. Semantic colors stay slightly softer (sage, amber, terracotta) so they don't fight the two brand accents.
- **Type:** **One family — Hanken Grotesk** (warm humanist grotesque), used everywhere: UI chrome, body, moment text, and display. Hierarchy comes from weight and size, not a second face. Display/headlines are heavy (700–800) with tight tracking (`-0.02em`); moment + body text is 400 with comfortable line-height (~1.5–1.55). No serif.
- **Spacing:** 4pt base. Screen gutter is 16px. Compact but breathable — inputs and rows are kept tight (≈8–11px padding), the feed stays uncluttered.
- **Backgrounds:** Flat color. **No gradients** as decoration (the only gradients are small accents — a story ring, collection tiles). No textures, no patterns, no full-bleed hero imagery in chrome. **Imagery comes only from user content** (photos attached to moments) — render those warm, with rounded corners; never apply heavy filters or B&W. Use neutral placeholder blocks (initials, soft color) where the user hasn't supplied an image.
- **Corner radii:** Soft but not pill-shaped on buttons. **Buttons use `--r-btn 12px`** (rounded-rect). Cards `14–20px`, sheets `28px`. **Chips, the compose FAB, and avatars** stay fully round (`--r-pill` / circle). Inputs `10px`.
- **Cards:** White surface, 1px hairline border (`--hairline`), `--shadow-sm` (very soft). Rounded `--r-lg (20px)`. Cards feel like paper laid on the canvas, not floating UI panels.
- **Shadows / elevation:** Soft, very lightly warm-tinted (never harsh black). Four steps: `sm` (resting cards), `md` (menus/popovers), `lg` (sheets/modals), and **`float`** — a soft rose-tinted glow reserved for the compose FAB so the primary action gently lifts off the page.
- **Borders:** Hairline `1–1.5px`. Inputs use a slightly stronger border that turns rose on focus with a soft 3px focus ring.
- **Transparency / blur:** Used sparingly — a frosted (`backdrop-blur`) translucent layer behind the top bar and bottom tab bar so content scrolls softly underneath. Never decorative glassmorphism.
- **Animation:** **Gentle, never bouncy.** Standard ease is `cubic-bezier(0.22,0.61,0.36,1)`; durations 120/200/320ms. Transitions are fades and small slides (sheets rise from the bottom, content cross-fades). No springs, no overshoot, no infinite loops. Respect `prefers-reduced-motion`.
- **Hover states (where a pointer exists):** Slight darken of accent (`--primary` → `--primary-hover`) or a faint wash on neutral surfaces. Subtle.
- **Press states (touch-first):** A small **scale-down** (`0.97`) plus a brief darken — quick and tactile. The like (heart) fills with rose and does a single gentle pop.
- **Protection:** Top/bottom bars use translucent fills + hairline + blur rather than hard gradients; small text over user photos gets a soft scrim only when needed.

### Dark theme
A full dark theme ships in `colors_and_type.css` under `[data-theme="dark"]`. It overrides the **raw** neutral and accent steps; the semantic roles (`--bg`, `--text`, `--primary`, …) are `var()` references, so they re-resolve automatically — only genuinely two-faced tokens are restated. The canvas becomes a deep, cool near-black (`--paper #0E1417`); cards lift by getting *lighter* than the canvas (`--surface #161F22`) while wells sink below it. Rose and blue stay vivid (nudged a touch brighter for legibility); the near-white soft washes (`--rose-50`, `--blue-50`) flip to dark tinted fills, and a pair of `--on-primary-soft` / `--on-secondary-soft` tokens carry the text/icons that sit on those washes (kept separate from avatar foregrounds, which keep their light `-200`/`-700` bubble pairs). Translucent chrome, the modal scrim, and the phone-frame backdrop are tokenised (`--bar-bg`, `--scrim`, `--frame-bg`) so they retune too. The app sets `data-theme` on `<html>` from a stored choice, falling back to the OS `prefers-color-scheme`; a sun/moon toggle in the feed header flips it (persisted in `localStorage`).

### Thumb-first layout rules (mobile)
- Primary navigation lives in a **bottom tab bar** (`--bottom-nav-h 62px` + safe-area inset), always reachable by the thumb.
- The **compose action is bottom-and-centered/right** — the most important, most frequent action sits in the easiest reach.
- Destructive or rare actions (settings, sign-out) live **top-left**, the hardest-to-reach corner.
- Minimum touch target **44px**. Generous tap spacing.

---

## ICONOGRAPHY

- **System:** [**Lucide**](https://lucide.dev) (the open-source successor to Feather), loaded from CDN. Chosen for its **light, even ~2px stroke and rounded line-caps** — friendly and quiet, so icons sit back and don't compete with content. This matches the brief's "interactive elements should not take too much attention."
  - ⚠️ **Substitution flag:** No icon set was specified in the brief; Lucide is a chosen default. Swap freely if the team prefers Phosphor (regular), Feather, etc. — keep to one light-stroke outline set.
- **Usage:** Outline (stroke) style only at rest. The **only filled icon** is the heart when a moment is *loved* (fills with `--like` rose). Default icon color is `--ink-2` (quiet); active tab / selected state is `--primary` rose. Sizes: 18px inline in cards, 23px in the tab bar.
- **Key glyphs:** `feather` (compose / new moment — also echoes the brand), `home` (feed), `search` (discover), `bookmark` (saved / collections), `user` (you), `heart` (love), `message-circle` (replies), `map-pin` (place), `lock` (private), `more-horizontal` (overflow).
- **Logo / brand mark:** Custom — a **bookmark with a small heart** (saving a sweet moment). See `assets/`. This is original artwork created for this generated brand; replace with official artwork when available.
- **Emoji as icons:** Never in chrome. **Unicode** is not used decoratively.

---

## Index — what's in this folder

| Path | What it is |
|---|---|
| `README.md` | This file — context, voice, visual foundations, iconography. |
| `colors_and_type.css` | All design tokens: color palette + semantic roles, type families/scale/classes, spacing, radii, shadows, motion. **Import this first.** |
| `SKILL.md` | Agent Skill manifest (for use as a downloadable Claude skill). |
| `assets/` | Brand assets: `logo-mark.svg`, `logo-wordmark.svg`. |
| `fonts/` | Note on the webfonts (loaded via Google Fonts CDN — see below). |
| `preview/` | Small specimen cards that populate the Design System tab (colors, type, spacing, components, brand). Not for production use. |
| `ui_kits/app/` | High-fidelity, click-through recreation of the Vocabu PWA. See its own README. |

### Fonts
Fonts load from **Google Fonts CDN** (`Hanken Grotesk` — the single family), imported at the top of `colors_and_type.css`. No font files are bundled. To ship offline/PWA, download the `.woff2` files into `fonts/` and replace the `@import` with `@font-face` rules. ⚠️ Hanken Grotesk is a *chosen* default, not from an existing brand — confirm or replace. A legacy `--font-serif` token still exists but now **aliases the sans stack** so older references resolve to one family.

---

## CAVEATS — please review

1. **Product concept is confirmed; the detail is interpreted.** Vocabu = a personal dictionary of how the people you love talk (kid's words, friend's phrases, parent's wisdom), with optional audio + a social feed. The exact screen flow, field set (speaker/relation, meaning, story, audio, collections), and social model (follow other dictionaries) are my interpretation — tell me what to adjust.
2. **Audio is cosmetic in the kit.** The waveform player animates a fake progress bar; wire it to real recording/playback in production.
2. **Logo is original placeholder artwork.** The bookmark-and-heart mark and the wordmark were created from scratch. Replace with official brand assets.
3. **Font & icons are chosen defaults**, not pulled from an existing brand. Swap if you have a brand typeface or a preferred icon set.
4. **Exact accent hues** are a bright interpretation of "rose / light blue" — easy to nudge in `colors_and_type.css`.
