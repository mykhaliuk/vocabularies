# Fonts

Vocabu uses two families, loaded from **Google Fonts CDN** via the `@import` at the top of `../colors_and_type.css`:

- **Rubik** — UI + body (friendly geometric sans, full Cyrillic coverage)
- **Newsreader** — display, headlines, and moment text (literary serif)

No font files are bundled in this folder.

## To ship offline / inside the PWA
1. Download the `.woff2` files for both families (weights used: Rubik 400/500/600/700/800 + italic 400/500; Newsreader 400/500/600 + italic 400/500).
2. Drop them here in `fonts/`.
3. Replace the `@import` line in `colors_and_type.css` with `@font-face` rules pointing at these files.

⚠️ Both families are **chosen pairings**, not from an existing Vocabu brand. Replace if the team has official typefaces.
