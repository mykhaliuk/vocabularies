## Why

VKB-181. Thirteen client files import types from `~/server/**`, which
transitively pulls `server/utils/storage.ts` and the AWS SDK. The `type`
keyword on those fifteen import statements is the only thing keeping that out
of the browser bundle, and nothing verifies it. Drop the keyword on any one of
them and the S3 client ships to `_nuxt` with every gate still green.

`layering:check` is the guard that should have caught it and does not: it
scans `server/api|routes|middleware|plugins` only, and it audits the opposite
direction — transport reaching the db.

## What Changes

- `layering:check` grows a second rule and enforces the module boundary in
  **both** directions: transport must not touch the db (unchanged), and client
  code must not import server or db modules for anything but types.
- The client roots it scans are `pages`, `components`, `composables`,
  `layouts`, `middleware`, `plugins`, `utils` and `shared` — the Nuxt ones, not
  their `server/` namesakes.
- A violation names the file, the line and the specifier, the way the existing
  half does.
- The new half is statement-aware rather than line-based, because a real
  import in this repo already spans four lines with `from` on the last one.
- A unit test pins the rule, following the repo's `scripts/*` + `tests/unit/*`
  pairing.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

<!-- None: this is a check, not behaviour. `skip_specs: true`. -->

## Non-goals

- **oxlint's `consistent-type-imports`.** It normalises how a type-only import
  is *written*; it does not forbid a value import from a server module, which
  is the thing that ships the SDK. See design.md — D2.
- **Transitive analysis.** The guard stays lexical, like the half beside it. A
  client file importing a client file that imports a server value is out of
  reach, and the existing header already records that limit for the other
  direction.
- **Asserting bundle contents.** Checking `_nuxt` for `@aws-sdk` after a build
  would catch more, and would cost a build in a check that currently costs
  milliseconds. Worth its own ticket if the lexical guard proves too weak.
- **A migration.** Every import in the roots the ticket named already
  complies. One did not, and it is fixed here rather than filed: the guard's
  own second review found `sentry.client.config.js` value-importing
  `beforeSend` from `~/server/utils/sentry-scrub` — a root-level file the
  first version of the check did not scan. The module is imported by the
  client AND server Sentry configs, so it belongs in `shared/`, where it now
  lives. That is one move and two import lines, not a migration.

## Impact

- `scripts/layering-check.js` — a second rule set and a wider walk.
- `tests/unit/layering-check.test.ts` — new.
- `shared/sentry-scrub.ts` — moved out of `server/utils/`, with the two
  Sentry configs' import lines following it. `docs/capability-graph.md`
  regenerates because of the move.
- `AGENTS.md` — its one-line description of `layering:check` currently says
  "zero db references in transport", which will no longer be the whole story.
- No workflow change: CI already runs `bun run layering:check` as its own step,
  which is what makes extending it rather than adding a script the workable
  option (design.md — D1).
- No product code changes, so no route, schema or capability-graph movement.
