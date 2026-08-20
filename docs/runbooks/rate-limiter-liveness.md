# Runbook: rate-limiter liveness alert

Every limiter in `server/utils/ratelimit.ts` **fails open**: on an Upstash
error the request is allowed and abuse control silently drops to zero
(VKB-74 — the dev instance was dead for weeks before anyone noticed). This
runbook covers the detection added in VKB-78 and what to do when it fires.

## How detection works

Two complementary signals, both landing in Sentry with the tag
`alert:ratelimit-failopen`:

- **Fail-open capture.** Every rate-limiter catch path calls
  `reportRatelimitFailOpen(source, error)`
  (`server/utils/ratelimit-alert.ts`). Sources: `magic-link`, `auth-poll`,
  `auth-callback`, `auth-confirm`, `media-upload`. Events are fingerprinted
  per source (one Sentry issue each) and throttled in-process to one event
  per source per 5 minutes, so a dead limiter cannot storm. Fires on every
  stage the moment real traffic hits a dead limiter.
- **Scheduled probe.** A Vercel Cron (`vercel.json`, daily at 06:00 UTC)
  hits `/api/cron/ratelimit-probe`, which runs a real `SET`/`GET`/`DEL`
  against the limiter Redis — an archived Upstash instance may still resolve
  DNS yet reject data ops, so a ping is not enough. On failure it reports to
  Sentry (source `probe`) and returns 503, which also marks the cron
  invocation failed in the Vercel dashboard. The daily write doubles as a
  keep-alive. Vercel Crons run against **production only**; dev relies
  on the fail-open capture. (`/api/health` checks redis with a bare `ping`,
  which a deleted or rotated instance fails but an archived-yet-resolving
  one may pass — acceptable since the PAYG instances are not idle-archived,
  but do not treat a green health check as proof the limiter is live.)

The fail-open policy itself is unchanged — this is detection only.

## One-time setup (outside the repo)

- **Sentry alert rule** (per project, once): Alerts → Create Alert →
  Issues → condition "an event's tags match `alert` equals
  `ratelimit-failopen`" → action: notify email. Set action interval to
  1 hour — dedup is already handled by fingerprint + throttle.
- **`CRON_SECRET`** in Vercel (every non-local stage): any random string.
  Vercel sends it as `Authorization: Bearer <secret>` on cron invocations;
  the probe rejects other callers with 401. If unset outside local, the
  probe fails closed with 500 — a misconfiguration, not an open endpoint
  (same invariant as the retired cleanup-tokens cron).

## When the alert fires

1. Confirm by hitting the probe with the secret
   (`curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/ratelimit-probe`).
   `/api/health` usually shows `redis: error` too, but its bare ping can
   stay green in the archived-yet-resolving case — trust the probe.
2. Check the Upstash console: is the instance alive? Topology (as of
   VKB-74): `vocabu` (production), `vocabu-stage` (dev only — the name is a
   leftover from when two stages shared it, see VKB-169;
   keys namespaced by `vocabu:<stage>:rl:*`). Both are pay-as-you-go, which
   is not idle-archived — a dead instance now means deletion, credentials
   rotation, or an Upstash outage.
3. If the instance is gone: create a new PAYG Redis in Upstash, then
   repoint `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` in the
   affected env (Vercel env for deployed stages, `.env.dev`
   for local runs) and redeploy.
4. Verify recovery: `/api/health` shows `redis: ok` and the probe returns
   `{ "probe": "ok" }`.

Knowledge base: `kb-personal/projects/vocabu/trap-upstash-dev-dead.md`
carries the incident history and topology.
