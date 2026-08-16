# ADR-0018: a limiter that was never built is a build failure, not a fail-open

- Status: Accepted
- Date: 2026-08-16
- Refs: VKB-138, VKB-78, ADR-0017, `scripts/ratelimit-gate.js`,
  `server/utils/ratelimit.ts`, `server/utils/ratelimit-alert.ts`

## Context

Rate limiting fails open by deliberate policy: an Upstash outage must not turn
every login into a 500, because availability beats abuse control for a personal
dictionary. VKB-78 exists to alert when that happens.

Two different failures reach that policy through the same door, though. Every
call site builds its limiter _inside_ the `try` that implements fail-open:

```js
const verdict = await useMediaUploadRatelimit().limit(userId);
```

so the catch absorbs both "Upstash is unreachable" and "the limiter could not
be built at all". The first is operational and transient. The second is a
deploy defect: it never self-heals, and the stage runs with abuse control at
zero for as long as it lives. Both produced one log line and one
`alert: ratelimit-failopen` event, which also degrades VKB-78's alert — a
signal that means "it may come back" was firing for a state that never will.

`createLimiter` already threw for a missing config on any non-local stage. That
guard was inert: the throw landed in the very catch written for the other case.
A guard that can only be observed by the code designed to swallow it is not a
guard.

## Decision

**Catch it at build time; classify it at runtime.**

1. **Build gate.** `scripts/ratelimit-gate.js` runs before `nuxt build` and
   refuses to build a configured stage without `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`. "Configured stage" is the same signal ADR-0017
   established — the environment carries a database — plus
   `VERCEL_ENV=production`. `SKIP_RATELIMIT_GATE=1` declares the omission.

   This is why the answer is not "fail the boot". On Vercel a boot failure is
   not a blocked deploy; serverless instances start per invocation, so it would
   be a 500 on every request until someone edits an env var. Failing the build
   keeps the previous deployment serving while the broken one never ships.

2. **Runtime classification.** The construction error carries a marker
   (`code: 'ERATELIMIT_CONFIG'`), and one router — `reportRatelimitFailure` —
   sends it to `alert: ratelimit-misconfigured` (level `fatal`, its own
   fingerprint) instead of `ratelimit-failopen`. Requests still fail open: the
   availability policy is unchanged and explicitly out of scope. Only the
   signal changes, so VKB-78's alert means what it says again.

   The router exists so the classification lives in one place. Five call sites
   each deciding would be five chances to copy the wrong neighbour.

### Parity with the migration gate

Two build gates now compute "is this a configured stage?" from the same env
shape, in two files. They are not sharing a constant — one boolean expression
does not earn a module, and the migration gate is already shipped — so the
agreement is asserted instead of assumed: `tests/unit/ratelimit-gate.test.ts`
runs both scripts over the same env matrix and fails if their answers diverge.

| Build env                      | migration gate      | rate-limit gate  |
| ------------------------------ | ------------------- | ---------------- |
| no env at all (opt-in preview) | skips               | skips            |
| `VERCEL_ENV=production`        | requires a database | requires Upstash |
| `DATABASE_URL_UNPOOLED` set    | migrates            | requires Upstash |

The coupling is the test, not the comment. If a third gate appears, that is the
moment the shared helper becomes worth extracting.

## Consequences

A stage cannot reach production without abuse control by accident any more, and
if one ever does, it says so in a distinct alert rather than hiding inside the
outage alert.

**Deviation, deliberate:** `server/api/cron/ratelimit-probe.get.ts` is left
alone. Its comment records the opposite decision on purpose — a missing config
there "must land in the same alert as a dead instance" — and it builds its
client through `useRedis()`, not `createLimiter`, so it never carries the
marker anyway. That probe belongs to VKB-78; changing its alerting is that
ticket's call, not this one's.

**Not closed:** the gate proves the variables are _present_, not that they
point at a live Upstash. A wrong URL or a revoked token still passes the build
and surfaces as fail-open at runtime — which is correct, because that is
genuinely the transient-outage shape from the request path's point of view, and
is what the VKB-78 probe is for.
