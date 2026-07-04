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
  embeds its OWN DS copy under `_ds/<id>/`, which lags when the DS changes, and
  patches gaps with `ds-bridge.css`; the prototype's effective tokens are
  (embedded DS) + (bridge). Compared to canon it reports: DRIFT — embedded DS
  defines a token with a different value (real disagreement → fails); COVERED —
  a canon token the embedded DS lacks but the bridge supplies at the canon value
  (re-bind the prototype's DS in Claude Design, then delete the bridge);
  BRIDGE≠ — the bridge supplies a token at a different value; GAP — absent from
  both; REDUNDANT/ORPHAN — dead or unknown bridge lines. Only DRIFT fails,
  because the embedded DS is re-bound in Claude Design, not in the repo.
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

## Project management — Linear

Work is tracked in Linear: team **Vocabu team** (prefix `VKBT`), project
**Vocabu**, milestones `M1…M11` mirroring ROADMAP.md. ROADMAP.md stays the
narrative source of truth; Linear tracks execution state.

- Every code task starts from a Linear issue (`VKBT-N`). Create or decompose
  issues via the Linear MCP before starting work.
- Branch naming: `<type>/vkbt-<n>-<short-desc>` (e.g. `feat/vkbt-15-i18n-setup`).
  The `vkbt-<n>` segment lets Linear auto-link the branch and move the issue to
  In Progress; `<type>/` follows the usual feat/fix/chore/refactor prefixes.
- PRs target `dev` and include `Closes VKBT-<n>` in the description so the
  merge closes the issue; an open PR moves it to In Review.
- Labels mirror change types: Feature, Bug, Improvement, Chore, Refactor,
  Docs, Test, plus Design (DS/tokens/prototype) and Ops (infra/deploy/env).
- Flow: issue → agent implements in a worktree → draft PR → human review and
  merge → Vercel deploy (`dev` = preview, `main` = production).
