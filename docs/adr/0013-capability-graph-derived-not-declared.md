# ADR-0013: The capability graph is derived from code, never declared

- Status: Accepted
- Date: 2026-07-26
- Refs: VKB-92

## Context

Work arrives as a screen to build, but whether that screen can be built
depends on a chain — route, domain operation, entity, column — that nobody
holds in their head. The chain breaks silently: `/api/entries/*` shipped in
VKB-64 and the tab shell in VKB-65, and nothing connected them; `PATCH
/api/me` can rename a user that no UI can rename. Neither gap is visible
in a diff, in Linear, or in the ADRs. The obvious fix — draw the map — is
the one that fails, because a hand-drawn map is stale within a sprint and
a stale map is worse than none: it answers confidently and wrongly.

## Decision

`docs/capability-graph.md` is generated from the source tree by
`scripts/capability-graph.js` and committed. `bun run graph:check` rebuilds
it in memory and fails CI when the committed file differs, so the artifact
cannot drift from the code that produced it. Each edge is extracted by the
cheapest method still reliable for that edge: routes from Nitro filenames,
route→operation and module→entity from non-type named imports, columns from
a runtime import of the Drizzle schema (exact — `getTableColumns`, no
parsing), and client→route from `/api/…` literals inside `$fetch`/`useFetch`
calls and locals bound to `useRequestFetch()` (the SSR-safe idiom binds the
fetcher to an arbitrary name, so the binding is read rather than guessed). Reading the graph when scoping a ticket is a step in
`docs/PR-CHECKLIST.md`, not a new ritual.

## Consequences

The graph is always true, and the wiring change is visible in a PR diff —
"this PR connected `feed.vue` to `/api/entries`" reads as a diff line. The
price is churn: any PR moving a call, route, operation or column must
regenerate and commit the file, which is why the output is sorted
throughout and carries no timestamp.

The client half is lexical and therefore weaker than the server half. A
computed endpoint cannot be resolved by reading text, so instead of
dropping such a call — silence being indistinguishable from "all clear" —
the tool reports `UNRESOLVED` and asks for a `graph-endpoint` annotation.
Legitimate non-client callers (a queue callback, an emailed link) are
declared in the file itself with `graph-allow-orphan: <reason>`, mirroring
`ds-allow-hex`; the reason lives next to the code and dies with it.

A known gap is a different claim from a permanent one, and collapsing the
two is how a real gap gets silenced for good — so `graph-pending: VKB-<n>`
is a separate annotation that **requires an issue**, lists the route in a
Pending wiring section rather than under findings, and is itself reported
once callers appear. The findings list stays empty when nothing is wrong,
which is the only state in which a new finding is noticeable; the gaps it
excludes stay on the page with the ticket that will close them.

Admitted debt: entity edges are per module, not per operation. Splitting
them means guessing where a function body ends, which misattributes
silently once a helper appears between exports. Exit condition: when a
domain module grows past a handful of operations, resolve edges through
the AST rather than by span, and only then.

## Alternatives rejected

- **Hand-maintained map (Obsidian, wiki, KB note)** — rots in a sprint;
  the KB's own rule forbids speculative mapping for this reason.
- **Declared "intended wiring" file diffed against reality** — reintroduces
  the hand-maintained artifact through the back door, and it is the first
  thing to go stale.
- **Full AST parsing (oxc/TS compiler API)** — precise, but needs a new
  dependency plus a Vue SFC parser, while every current call site is a
  plain literal. Precision bought before it is needed.
- **Reading Nitro's build manifests** — ties the tool to build state and to
  Nuxt internals, and buys nothing: filenames already determine routes.
- **Report-only, not committed** — no PR-visible history of wiring changes,
  and an agent in a fresh worktree must build before it can plan.
