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

### Code rules (mandatory reading before writing code)

`.claude/rules/*.md` is the full rulebook for HOW code is written here —
JS conventions and V8-friendly optimizations, error handling, GoF pattern
usage, data structures, no-DTO policy, refactor hygiene. Every executor
(local, CI) MUST read these files before producing code; they are
not summarized here on purpose — the files ARE the summary.

Maintenance: the source of truth lives outside the repo on the owner's
machine; after a rule changes there, run `bun run rules:sync` and commit
the diff. Do not hand-edit `.claude/rules/` in the repo.

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
- Flow: issue → agent implements in a worktree → PR ready for review → human
  review and merge → Vercel deploy (`dev` = preview, `main` = production).
  Previews of other branches are skipped by default; opt in by ending the
  head commit subject with `[preview]` (see `scripts/vercel-ignore.js`).
  Agents open PRs as **ready**, not draft — a finished agent task IS the
  review handoff (ready flips the Linear issue to In Review and triggers the
  CODEOWNERS auto-request). Use draft only for explicitly unfinished WIP.

### Agent identity (claude-agent)

Agent-authored work is committed and pushed as the **claude-agent-myka**
GitHub machine account, so authorship is visible in history and PRs. The
human's own commits keep their normal identity.

- Git author: `claude-agent-myka <299917915+claude-agent-myka@users.noreply.github.com>`
- Token: macOS Keychain — `security find-generic-password -s vocabu-agent-pat -w`
  (classic PAT, `repo` scope, collaborator with Write). Never write the token
  to disk or into git config; read it from Keychain at use time.
- Commit (signed): agent commits are SSH-signed with a key held in Keychain
  (`vocabu-agent-signing-key`) via the `~/.config/vocabu/bin/agent-ssh-sign`
  wrapper — no key file on disk. Full incantation:
  `git -c gpg.format=ssh -c gpg.ssh.program=$HOME/.config/vocabu/bin/agent-ssh-sign -c user.signingkey="key::$(cat $HOME/.config/vocabu/claude-agent-signing.pub)" -c commit.gpgsign=true -c user.name=claude-agent-myka -c user.email=<noreply> commit …`
- Every agent commit message ends with the co-author trailer (after a blank
  line): `Co-authored-by: Volodymyr Mykhaliouk <18505201+mykhaliuk@users.noreply.github.com>`
  Never put the owner's personal email into any commit field or repo file —
  the GitHub noreply address is the only allowed form.
- Push / gh: run with `GH_TOKEN=$(security find-generic-password -s vocabu-agent-pat -w)`
  so pushes and `gh pr create` act as the bot.
- PRs opened by the bot request review from `mykhaliuk` — real review
  requests work because author ≠ reviewer.
- In GitHub Actions (`@claude` mention flow, `.github/workflows/claude.yml`)
  the Keychain identity is unavailable; there the agent acts as `claude[bot]`
  via the Claude GitHub App — also a distinct identity. Local conventions
  that CI agents must still follow: Conventional Commits, `vkbt-<n>` in the
  branch name when the issue mirrors a Linear ticket, PRs ready (not draft),
  the co-author trailer.

### Agent execution contract (any executor: local, Actions)

This section is the single source of truth for HOW agents work in this repo.
If an executor cannot satisfy a point, it must say so in the PR instead of
silently skipping it.

- **Commits:** Conventional Commits — `<type>(<scope>): <subject>`, imperative,
  lowercase, no trailing period, ≤ 72 chars. Types: feat, fix, chore, refactor,
  docs, test, perf, ci, build, style. Branch: `<type>/vkbt-<n>-<short-desc>`.
- **Verify hands-on, never ship blind.** For any UI-affecting change: install
  deps (`bun install`), run the app (`bun run dev`, or `bun run build` +
  preview), open the affected pages with Playwright (already a dev dep),
  capture before/after screenshots and actually look at them. Check both
  themes when styles are involved. A UI change without a rendered check is
  not done.
- **Checks before shipping:** `bun run lint`, `bun run fmt:check`,
  `bun run ds:check` (plus `proto:check` when design files are touched), and
  `bun run test:e2e` when the change affects covered flows. CI enforces these,
  but run them yourself first.
- **Known sandbox limits:** flows requiring live Postgres or real email
  (magic-link login, `/me`) cannot be fully exercised in agent sandboxes.
  State explicitly in the PR what was verified and what needs a local check.
- **No scope creep:** implement the ticket; file follow-up ideas as new
  Linear issues instead of expanding the diff.
