# Pre-PR checklist

Born from the PR #80 retro: three tickets on one branch, and a review that
found 17 confirmed issues after "all checks green". Every item below maps to
a class of defect that actually shipped to that branch. Run it before opening
a PR (or flipping it ready); the agent execution contract in CLAUDE.md
requires it for agent-authored work.

## Scope — before writing code

- [ ] One Linear ticket = one branch = one PR. If the session/branch setup
      conflicts with this, STOP and flag it before implementing — a branch
      name is infrastructure, not a scope decision.
- [ ] If a ticket says it must not ride along with other work, believe it
      literally, even when sharing a branch is convenient.
- [ ] Follow-up ideas go to new Linear issues, not into the diff.
- [ ] Read `docs/capability-graph.md` and name the path the ticket needs:
      screen → route → domain operation → entity (and the columns it
      reads). Anything on that path that does not exist yet is a
      dependency to file as a blocking issue, not a surprise to discover
      halfway through the implementation.

## Failure paths — for every new statement in a request handler

- [ ] For each new `await`: what happens when it throws? Is it inside the
      right try/catch, and does the user get the friendly error path?
- [ ] Is any user-visible state already irreversible at that point (consumed
      token, sent email, charged card)? A failure after an irreversible step
      needs an explicit decision: fail open (log and continue) or fail
      closed — written down in a comment.
- [ ] Hygiene work (sweeps, cache refresh) must never be able to abort the
      interactive path it rides on.

## Data layer

- [ ] Every new WHERE / ORDER BY column: does an index cover it? A sweep or
      periodic delete without an index seq-scans the table on the hot path.
- [ ] New columns holding personal data (ip, user_agent, email): what deletes
      them, and when?

## Duplicated logic across environments

- [ ] Logic implemented twice (Vercel edge + Node, client + server, SW +
      server) gets a parity table in the ADR: inputs where the legs agree,
      inputs where they deviate, and which leg is the reference semantics.
      "Same rules as X" comments are banned unless literally true.
- [ ] Name the accepted deviations explicitly (q=0, case, header order — not
      just the generic "approximation"), so review argues with the record,
      not the code.
- [ ] The e2e-covered leg is named; the uncovered leg's verification story
      ("only checkable on deploy") is written in the ADR.

## Rosters and constants

- [ ] A list consumed in more than two places (locales, routes, cache names)
      lives in one shared module from the first PR — six hand-synced
      declarations is how prod and preview silently diverge.
- [ ] Derive, don't enumerate: hreflang clusters, route rules, og maps come
      from the roster via map/entries so a new entry cannot be dropped.

## Interaction sweep — anything touching `/`, cookies, redirects, caching

- [ ] Service worker: does a precached response answer this navigation
      before the server logic runs? Remember start_url makes `/` the
      default request of every installed-PWA launch.
- [ ] Cookie contracts: who else reads/writes this cookie (i18n module,
      theme override)? Does the new logic honor an explicit choice?
- [ ] Reachability: from every new page, can the user get back to every
      other variant? A redirect on `/` plus links pointing at `/` is a trap.
- [ ] Redirects that vary per visitor (cookie, Accept-Language) are sent
      no-store (`noStoreRedirect`), never bare `sendRedirect`.
- [ ] Paths: `event.path` includes the query string — compare pathnames.

## Localization

- [ ] Diff each locale file against the reference locale key-by-key: any
      value left in the source language is a finding (one 'you@email.com'
      in an otherwise Ukrainian file).
- [ ] Aria-labels and placeholders are copy too.

## Conventions (.claude/rules) — on every NEW file

- [ ] Naming: UPPER_SNAKE_CASE constants, boolean prefixes, verb functions.
- [ ] `undefined` for empty primitives, `null` for empty references.
- [ ] 80-char lines (the formatter does not split long string literals —
      check them by hand or with the in-file `+` precedent).

## Before flipping the PR ready

- [ ] `bun run lint && bun run fmt:check && bun run ds:check` (+
      `proto:check` when design files changed, `i18n:check` when locale
      files changed).
- [ ] `bun run graph:build` when the diff adds or removes an API call, a
      route, a domain operation or a schema column — then commit the
      regenerated `docs/capability-graph.md`. `graph:check` fails CI when
      it is stale, and the regenerated diff is where a reviewer sees the
      wiring change.
- [ ] `bun run test:e2e` when covered flows are touched; new behavior gets
      new coverage (including the negative case: query params, explicit
      refusals).
- [ ] `bun run test:e2e:authed` when the change touches a screen behind
      `middleware: 'auth'` — and the ticket adds its own spec there
      (`e2e/authed/README.md`). A UI ticket on an authed screen without an
      authed spec is not done.
- [ ] UI change → rendered check: screenshots of affected pages, both
      themes, mobile + desktop, actually looked at.
- [ ] Run the adversarial review (`/code-review`) BEFORE opening the PR and
      fix what it confirms — review-after-merge-request is how 17 findings
      landed on a green branch.
