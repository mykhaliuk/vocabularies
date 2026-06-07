# Vocabu

Mobile-first PWA for keeping a personal dictionary of the memorable ways the
people you love talk. Stack: Nuxt 4 (Vue 3), Drizzle/Postgres, bun as package
manager + CI runner, `node` to run repo scripts, oxlint + oxfmt.

## Design system — single source of truth

The design system is **authored in the browser** (claude.ai design) and cannot
run locally. The repo holds an **exported snapshot** that is the contract for
production UI:

```
[browser DS]  ──manual export──▶  docs/design/design-system/project/
 (authoring)                       _ds_manifest.json   ← SOURCE OF TRUTH
                                          │
                                     bun run ds:check   (CI-enforced)
                                          ▼
                                   assets/css/*.css     ← production tokens
```

- **Source of truth:** `docs/design/design-system/project/_ds_manifest.json`.
- **Production tokens** live in `assets/css/`: non-color tokens in `tokens.css`,
  colors in `theme-light.css` / `theme-dark.css` (dark literals are private
  `--_dk-*` vars re-assigned under the dark selectors), utilities in
  `typography.css`. These are the ONLY files allowed to contain raw literals.
- **Reference skill:** `vocabu-design` (symlinked into `.claude/skills/`) carries
  the brand rules, palette, type, and the `ui_kits/app/` JSX to mirror into Vue.
  It is reference knowledge, not a runnable tool.

### Keeping things in sync

- Run `bun run ds:check` before/after touching any CSS or design token. CI runs
  it on every push/PR to `main`/`dev`.
- It enforces **token parity** (every manifest token must exist in production CSS
  with the same value) and **adherence** (no raw hex in `.vue` or non-token CSS —
  use a `var()` token; annotate a deliberate exception with `ds-allow-hex`).
- Production MAY add tokens the manifest lacks (extensions are allowed and
  reported, e.g. `--font-hand: 'Caveat'` for headwords). Production MUST NOT
  contradict a manifest value.
- When the browser DS changes: re-export `_ds_manifest.json` + `colors_and_type.css`
  into `docs/design/...`, then update `assets/css/*.css` until `ds:check` is green.

### The triad — one contract, three consumers

The design-system manifest is the single contract; three artifacts are checked
against it so none drifts:

- **Production CSS** — `bun run ds:check` (CI gate; strict).
- **Prototype** — `bun run proto:check`. The prototype (`docs/design/prototype`)
  embeds its OWN DS copy under `_ds/<id>/`, which lags when the DS changes. This
  flags STALE tokens (re-sync the prototype's DS in Claude Design and re-export),
  value CONTRADICTIONS (real drift → fails), and an obsolete `ds-bridge.css`
  (a shim for tokens the DS has since shipped — delete it on next export).
- `bun run ds:verify` runs both legs at once.

Drift can't be prevented at authoring time (DS and prototype are edited
independently in the browser) — it is caught at integration time by these
checks. The coupling is the check, not a convention.

## Brand rules (enforced by review, not just the linter)

- **Tokens only.** Reference design-system tokens via `var()`; never hard-code
  hex or one-off colors in components.
- **Type:** one family — **Hanken Grotesk** (headings weight 500, body 400). The
  only sanctioned extra is **Caveat** (`--font-hand`) for rendered headwords.
- **Color:** `--paper #FBFEFF` canvas, `--ink #1B1D1E` text, rose `--rose-500
#ED5379` (primary), blue `--blue-500 #1F9EDB` (secondary). White-label buttons
  sit on `--primary-action` / `--secondary-action` (AA-safe), not on the raw
  accents.
- **Radii:** buttons `--r-btn 12px` (rounded-rect, never pill); chips/FAB/avatars
  round; cards 14–20px.
- **Icons:** Lucide outline; only the heart fills (rose) when loved.
- **Layout:** mobile-first thumb-zone — primary nav + compose at the bottom; rare
  actions top-left.
- **Voice:** warm, plain, sentence case; no emoji in chrome.

## Conventions

- Scripts are ESM, run with `node` (see `scripts/*.js`); `bun run <script>` wraps
  them. Node >= 24.
- Lint/format: `bun run lint`, `bun run fmt:check` (oxlint + oxfmt).
- All in-source artifacts are English (identifiers, comments, log strings).
