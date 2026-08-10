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
- **Type:** one family — **Rubik** (headings weight 500, body 400), chosen for
  full Latin + Cyrillic coverage with italics. The only sanctioned extra is
  **Caveat** (`--font-hand`) for rendered headwords.
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

### E2E suites

Two Playwright suites, both CI-enforced, split by what infra they need:

- **smoke** — `bun run test:e2e`, specs in `e2e/*.spec.ts`. Routes that render
  with no DB (landing, login, offline, 404) against a production preview. It
  must stay infra-free: never add a spec here that needs a session.
- **authed** — `bun run test:e2e:authed`, specs in `e2e/authed/*.spec.ts`.
  Everything behind `middleware: 'auth'`, against a migrated Postgres with a
  real magic-link sign-in. **A UI ticket on an authed screen adds its spec
  here**; `e2e/authed/README.md` is the how-to.

`e2e/local/` is a third runner (poll/claim + compose) that needs MinIO and
transcoding and never runs in CI — see its own README.

### Code rules (mandatory reading before writing code)

`.claude/rules/*.md` is the full rulebook for HOW code is written here —
JS conventions and V8-friendly optimizations, error handling, GoF pattern
usage, data structures, no-DTO policy, refactor hygiene. Every executor
(local, CI) MUST read these files before producing code; they are
not summarized here on purpose — the files ARE the summary.

Maintenance: the source of truth lives outside the repo on the owner's
machine; after a rule changes there, run `bun run rules:sync` and commit
the diff. Do not hand-edit `.claude/rules/` in the repo.

### Server layering (ADR-0010)

Three layers under `server/`; the boundary is structural, never a
judgement call:

- **transport** — every request-facing Nitro surface: `server/api/**`,
  `server/routes/**`, `server/middleware/**`, `server/plugins/**`. Auth
  guard, zod validation, rate limits, calling the domain, HTTP error
  mapping, response projection. **Transport never touches the db.**
- **domain** — `server/domain/**`: business logic and invariants. Every db
  access is a **domain operation** — a function named by business intent
  (`updateDisplayName`, `getFeedPage`), whether it wraps one Drizzle line
  or a five-way join. If it reads or writes the db, it is a domain
  operation; "too simple to extract" is not a thing here.
- **infra** — `server/utils/**`: resources (db, storage, redis, email) and
  platform helpers.

Rules that keep it honest:

- No Repository layer, no per-table CRUD modules, no DTOs (see
  `.claude/rules/feedback_no_dto_in_js.md`) — Drizzle IS the data-access
  abstraction; domain operations exist per product need, not per table.
- A query needed identically by 2+ operations may move to a shared helper
  inside the domain (plain DRY, not a pattern).
- Resources are reached via lazy `use*()` module singletons (`useDb()`),
  imported exactly where used — never bundled into a god context. A context
  object carries request-scoped state only (`user` — identity plus resolved
  `entitlements`, per ADR-0012 — and tx) with a fixed shape. Where this narrows the resource-injection sentence of
  `feedback_no_dto_in_js.md` ("inject resources as a context object"),
  ADR-0010 wins until the upstream rule is aligned via `rules:sync`.
- Enforced by `bun run layering:check` (CI): zero db references in
  transport outside the shrinking legacy allowlist in
  `scripts/layering-check.js`. Never add a file to that list; remove
  entries as legacy routes migrate (opportunistically, when touched).

### Capability graph (ADR-0013)

`docs/capability-graph.md` is the derived map of what the product can
actually do today: client file → route → domain operation → entity, plus
every entity's columns. It is **generated** (`bun run graph:build`), never
hand-edited, and `bun run graph:check` fails CI when the committed file
drifts from the code.

- **Read it when scoping a ticket.** Name the path the feature needs and
  check it against the graph; a missing route, operation, column or
  entity is a dependency to file, not a mid-implementation surprise. The
  layering above is what makes this extractable at all.
- **Findings are actionable, observations are not.** An `ORPHAN ROUTE`
  means a route nothing calls. Wire it, delete it, or declare why —
  with the annotation that tells the truth, because the two are not
  interchangeable:
  - `// graph-allow-orphan: <reason>` — no client will EVER call it (a
    queue callback, an emailed link).
  - `// graph-pending: VKB-<n> — <reason>` — a client will, once that
    issue lands. The ticket is required; a pending gap without one is an
    excuse, not a plan. These move to a **Pending wiring** section:
    still visible, just not drowning the findings list.

  Both go stale on their own: once callers appear, the annotation itself
  becomes a finding, so it cannot outlive the gap it describes. A client
  surface with no API call is only listed, never flagged; placeholders
  are legitimate.

- **A computed endpoint** (`$fetch(url)`) cannot be read lexically and is
  reported as `UNRESOLVED`; declare it with `// graph-endpoint: /api/…`.
- **Regenerate and commit** whenever the diff moves an API call, a route,
  a domain operation or a column.

## Project management — Linear

Work is tracked in Linear: team **Vocabu team** (prefix `VKB`), project
**Vocabu**, milestones `M1…M11` mirroring ROADMAP.md. ROADMAP.md stays the
narrative source of truth; Linear tracks execution state.

- Every code task starts from a Linear issue (`VKB-N`). Create or decompose
  issues via the Linear MCP before starting work. Linear is the live view of
  execution state (milestones, what's done / in progress / blocked) — read it
  there; don't reconstruct current state from git branches or issue archaeology.
- Base branch: cut every feature/fix branch (and its worktree) from `dev` by
  default — never from `main`, even though `main` is the repo's default HEAD, so
  worktree tooling may seed a branch there. Only `hotfix/` and `hotfeat/` (work
  explicitly targeting production) branch from `main`. If a worktree lands on
  `main`, rebase it onto `dev` (`git reset --hard origin/dev`) before starting.
- Branch naming: `<type>/vkb-<n>-<short-desc>` (e.g. `feat/vkb-15-i18n-setup`).
  The `vkb-<n>` segment lets Linear auto-link the branch and move the issue to
  In Progress; `<type>/` follows the usual feat/fix/chore/refactor prefixes.
- PRs target `dev` and include `Closes VKB-<n>` in the description so the
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
- **Fetch too — agents have no SSH.** `git@github.com` resolves to the owner's
  1Password agent, which requires a Touch ID approval no headless process can
  give; the failure is `Permission denied (publickey)`, and the silent version
  is a stale `origin/*` that makes a pushed branch look unpushed. Read over
  HTTPS with the same Keychain token:
  `GH_TOKEN=$(security find-generic-password -s vocabu-agent-pat -w) git -c credential.helper='!gh auth git-credential' -c url.https://github.com/.insteadOf=git@github.com: fetch --all --prune`
  The flags live only inside that call, so the clone keeps its SSH remote for
  the owner. Never rewrite the remote and never hand an agent the owner's SSH
  key — the bot PAT is its own identity, which is the point.
- PRs opened by the bot request review from `mykhaliuk` — real review
  requests work because author ≠ reviewer.
- In GitHub Actions (`@claude` mention flow, `.github/workflows/claude.yml`)
  the Keychain identity is unavailable; there the agent acts as `claude[bot]`
  via the Claude GitHub App — also a distinct identity. Local conventions
  that CI agents must still follow: Conventional Commits, `vkb-<n>` in the
  branch name when the issue mirrors a Linear ticket, PRs ready (not draft),
  the co-author trailer.

### Agent execution contract (any executor: local, Actions)

This section is the single source of truth for HOW agents work in this repo.
If an executor cannot satisfy a point, it must say so in the PR instead of
silently skipping it.

- **Commits:** Conventional Commits — `<type>(<scope>): <subject>`, imperative,
  lowercase, no trailing period, ≤ 72 chars. Types: feat, fix, chore, refactor,
  docs, test, perf, ci, build, style. Branch: `<type>/vkb-<n>-<short-desc>`.
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
  Linear issues instead of expanding the diff. One ticket = one branch =
  one PR; if the session or branch setup conflicts with that, flag it
  BEFORE implementing instead of following the setup.
- **Extractions ship first.** When a ticket needs code pulled out of an
  already-shipped component into a shared module, that extraction is its
  own PR, merged BEFORE the feature PR that motivated it. The extraction
  carries the regression risk — it changes code already in use — while the
  new surface carries almost none, because nothing depended on it yet;
  bundling them buries the risky half inside the harmless half. The split
  also changes the question each review answers: an extraction PR is
  reviewed as "did behaviour stay identical?", a mechanical and checkable
  question, and the feature PR as "is this right?". So PR 1 must be
  behaviour-neutral by construction — same rendered output, same numbers,
  ideally pinned by a unit test against what shipped before. Name the
  extractions when scoping, not mid-implementation. If an extraction only
  makes sense once its consumer exists, the abstraction is being invented
  rather than discovered: write the feature inline and extract in a
  follow-up. Applies to component/composable/util extractions and
  shared-type moves; not to brand-new modules only the new feature uses.
- **Comments are a liability, not a deliverable.** The code carries the
  explanation; a comment is what is left over when it cannot. Before writing
  one, decide which of three it is:
  - **Restates what the code does → delete it.** It is a second source of
    truth that no check verifies, and it rots the moment the code moves.
    VKB-107 shipped six comments dating the media swap "at confirm" after
    the swap had moved to the ready transition — one of them contradicting
    the correct paragraph three lines below it. The reviewer's findings were
    all prose, no code.
  - **Records a decision, a rejected alternative or a trade-off → it belongs
    in the ADR or the ticket**, where it is dated, reviewed and findable.
    Reference it from the code only if the pointer earns its line.
  - **Names a genuinely non-obvious local constraint** — a platform bug, an
    ordering the types cannot express → keep it, one or two lines.

  Reach for a better name, a smaller function or an extracted helper before
  reaching for a comment. Prose above a five-line function is a sign the
  function is misnamed, not that it is subtle. A file whose comment count
  approaches its code count is a design smell, not thoroughness — and this
  applies to tests as much as to source: a test name that needs a paragraph
  above it is a test name that has not been written yet.

- **Pre-PR checklist:** run `docs/PR-CHECKLIST.md` before opening a PR or
  flipping it ready — including the adversarial `/code-review` pass; fix
  confirmed findings first.
- **Decisions & vocabulary:** `docs/adr/` is the decision log — before
  proposing to change or reverse an architectural choice, read it and argue
  against the recorded reasoning, not from scratch. A new hard-to-reverse /
  surprising / trade-off decision lands as an ADR in the same PR that
  implements it. `docs/GLOSSARY.md` pins the project's terms — use them in
  code, copy, and issues; when planning settles a new term or decision, the
  planning round is not done until both files reflect it.
