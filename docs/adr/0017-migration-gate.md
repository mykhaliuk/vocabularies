# ADR-0017: the migration gate reads the environment's shape, not a flag

- Status: Accepted
- Date: 2026-08-16
- Refs: VKB-113, VKB-46, `scripts/migrate-deploy.js`,
  `scripts/vercel-ignore.js`

## Context

`vercel-build` runs `scripts/migrate-deploy.js` before `nuxt build`. Until now
the script printed a banner and **exited 0** whenever `DATABASE_URL_UNPOOLED`
was unset, so a deploy whose environment had lost that variable shipped
un-migrated code on a green build. Nothing downstream distinguished "migrations
ran" from "migrations were skipped"; the gap surfaced as
`relation "users" does not exist` on the first request instead of at build time.

The early exit is not a mistake, though — a build with no database must still
succeed. Per VKB-46 and `scripts/vercel-ignore.js`, only `main` (production) and
`dev` (preview) carry runtime env vars; any other branch can opt into a preview
build with a `[preview]` commit marker and gets **no env at all**.

That policy is what defeats the fix VKB-113 originally proposed. An explicit
`SKIP_MIGRATIONS` opt-out "that the database-less build sets deliberately"
cannot work as the primary mechanism, because the database-less builds are
exactly the ones with no environment configuration to set it in. Scoping the
flag to "Preview: all branches" in Vercel would also hit `dev`, which is the one
preview that must migrate. The flag is unsettable precisely where it is needed.

Vercel's own `VERCEL_ENV` does not separate the two cases either: the `dev`
preview and an opt-in branch preview are both `preview`.

## Decision

**Ask the environment what it is, in this order:**

1. `SKIP_MIGRATIONS=1` → skip. Kept as a human override for the rare
   deliberate case, not as the mechanism the common path depends on.
2. `DATABASE_URL_UNPOOLED` present → migrate, and exit with `drizzle-kit`'s
   status.
3. Absent **and** `VERCEL_ENV=production` → **fail the build.** A production
   deploy without a database is never legitimate.
4. Absent **and** `DATABASE_URL` present → **fail the build.** A half-set pair
   is the signature of a misconfigured environment, not of a database-less one:
   nobody provisions a pooled URL for a build that has no database.
5. Otherwise → skip, and say why, naming the two conditions that would have
   failed.

The signal is the _shape of the environment_, which the misconfiguration itself
changes, rather than a branch name (which would duplicate `vercel-ignore.js`'s
policy constant in a second file, where the two copies could drift apart
undetected) or a flag (unsettable, per Context).

### Parity with `vercel-ignore.js`

Two scripts now answer questions that derive from the same fact — which refs
carry runtime env (VKB-46). They are deliberately not sharing a constant, so
the table below is the record of where they agree and where they do not.
`vercel-ignore.js` is the reference semantics: it decides whether a build
happens at all, and this gate only ever sees builds it let through.

| Build                         | vercel-ignore                  | this gate     | agree?        |
| ----------------------------- | ------------------------------ | ------------- | ------------- |
| `main`                        | builds (production)            | migrates      | yes           |
| `dev`                         | builds (only preview with env) | migrates      | yes           |
| other ref, `[preview]` marker | builds                         | skips, no env | yes           |
| other ref, no marker          | never built                    | never runs    | n/a           |
| `main` with env deleted       | builds                         | **fails**     | by design     |
| `dev` with both URLs deleted  | builds                         | skips         | **deviation** |

The last row is the residual gap below. The deviation exists because this gate
reads env shape while `vercel-ignore.js` reads the ref: an env-less `dev` is
indistinguishable here from an opt-in preview, and only the ref could tell them
apart.

## Consequences

An environment that should have a database can no longer lose one silently:
deleting `DATABASE_URL_UNPOOLED` from Production, or from either environment
while leaving `DATABASE_URL` behind, now stops the build with the reason on
screen. Opt-in previews keep building exactly as before.

**The residual gap, stated rather than hidden:** deleting _both_ database
variables from the `dev` preview still reads as a legitimately database-less
build, and still skips. Closing it would require hardcoding `dev` here — the
duplicated-policy problem above — to defend against an act that is deliberate
and two-step. It is a worse trade than the hole it closes. If a third ref ever
gains runtime env, revisit this ADR together with `vercel-ignore.js`.

The gate is also not a proof that the schema matches the code: it verifies that
migrations _ran_, not that they were _complete_. Drift between the committed
migrations and the code that reads the tables is a different problem.
