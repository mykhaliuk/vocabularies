---
name: vocabu-design
description: Use this skill to generate well-branded interfaces and assets for Vocabu, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Brand:** Vocabu (from *vocabulary*) — a mobile-first PWA for keeping a personal dictionary of **the memorable ways the people you love talk**: a kid's first words, a friend's catchphrase, a grandparent's saying. Each entry = a word/phrase + who said it + optional meaning + a story + optional audio. Social feed, Twitter-like but warm. Tagline: *"Never lose your sweet moments."*
- **Foundations:** `colors_and_type.css` — import first. Clean near-white `--paper #FCFCFB` canvas, near-black `--ink #1E1C1A` text, two bright accents: rose `--rose-500 #ED5379` (primary) and light blue `--blue-500 #1F9EDB` (secondary).
- **Type:** ONE family, **Hanken Grotesk**. Delicate — display/headings at weight 500, body/moments at 400. No serif.
- **Radii:** buttons `--r-btn 12px` (rounded-rect, never pill); chips/FAB/avatars are round; cards 14–20px.
- **Icons:** Lucide (light outline). Only the heart fills (rose) when loved.
- **Layout:** mobile-first, thumb-zone — primary nav + compose live at the bottom; rare actions top-left.
- **Voice:** warm, plain, intimate; sentence case; no emoji in chrome; quiet about numbers.
- **Assets:** `assets/logo-mark.svg`, `assets/logo-wordmark.svg`.
- **UI kit:** `ui_kits/app/` — reusable JSX components (`WordCard` with audio player + unfoldable meaning, `Compose`, screens) + a working click-through prototype.

Honor the CAVEATS in README.md — the brand was generated from a brief, so confirm product behavior, logo, and font with the user when it matters.
