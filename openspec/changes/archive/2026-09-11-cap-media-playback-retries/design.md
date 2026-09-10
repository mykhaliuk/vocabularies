## Context

See proposal.md — Why. What shapes the approach:

- **The loop is engine-dependent, and that is the whole ticket.** `retrying`
  is reset in a `finally`, so it is closed only for the length of one refresh.
  Whether the next `error` lands inside that window or after it is left to the
  engine, and the two disagree. Measured with the pre-fix handler against an
  unreachable source, over 5s: **Chromium 1 refresh, WebKit 61**. Driving the
  real feed player through the authed suite says the same — Chromium issues 2
  resolves, WebKit 172 before the spec gives up. So on Chromium the bound
  exists by accident, which is why reading the code and watching it in a
  desktop browser disagree; on WebKit there is no bound at all. Vocabu is an
  iOS-first PWA, so WebKit is the engine its users are on.
- Every project in `playwright.authed.config.ts` is Chromium, including the
  one named `phone` — its own comment says so, because CI does not install
  WebKit. A defect that only appears on WebKit is therefore invisible to the
  whole check set.
- Both players learn about a failure from the media element's `error` event.
  That event carries a `MediaError` code, not an HTTP status: an expired
  signature and a permanently missing object both arrive as
  `MEDIA_ERR_SRC_NOT_SUPPORTED`. The browser gives the client no way to tell
  the recoverable case from the hopeless one.
- `resolvePlayback` is not a signal either. It answers correctly and quickly
  for a broken object — the API is healthy, the bucket contents are not — so
  the existing terminal branch, which needs a falsy or throwing resolve, is
  unreachable for exactly the failures that loop.
- CI *can* reach these players, contrary to the comment each of them carries.
  The `e2e-authed` job starts a MinIO container, and `e2e/authed/`
  drives the real audio player against it twice: `media-ready.spec.ts` walks
  presign → PUT → confirm → transcode → rendered player, and
  `playback-cache.spec.ts` counts the entry fetches a play costs. Those specs
  post-date the "nothing in CI ever looks at this component" comments, which
  are simply stale. Believing them would have cost this change its only real
  regression guard.
- `playback-cache.spec.ts` is the shape this change needs: it blocks the
  service worker, counts requests to `/api/entries/:id` from the browser, and
  asserts an exact number. A retry bound is the same assertion with a
  different number.
- `utils/*.ts` is auto-imported on the client and is where these components
  already push values they cannot check in place — `utils/media-metrics.ts`
  has `tests/unit/media-metrics.test.ts` for precisely that reason.
- The two `onError` handlers are the same shape with the same comment. The
  audio element is built imperatively (`new Audio`, `addEventListener`); the
  video element is a template `<video>` with bound `@` handlers. Any shared
  piece has to be indifferent to that difference.

## Goals / Non-Goals

**Goals:**

- A failure that a refresh cannot fix costs a bounded, small number of
  requests and then stops.
- The recoverable case the current code was written for — a signature that
  expires — keeps working exactly as it does today.
- The bound is pinned by a test that fails on the current code: an authed e2e
  spec asserting the request count, not only a unit test of the rule.

**Non-Goals:**

- Reworking how playback URLs are resolved or cached. `useEntryPlayback` is
  untouched.
- Extracting the players' shared structure. Only the retry rule moves; the
  rest of the duplication between the two components is out of scope and
  would make this a refactor PR rather than a fix.
- See proposal.md — Non-goals for failure classification, backoff, and
  server-side repair.

## Decisions

### D1 — Bound the attempt, do not classify the failure

The client cannot distinguish "expired" from "gone" (see Context), so the fix
is a bound on how many times an attempt may resolve a new URL, not a decision
about which failures deserve a retry. One refresh per attempt is what the
existing comment already claims the code does.

_Alternative — probe the URL with `fetch` to read the status:_ it would let us
separate 403-expired from 404-missing, at the cost of an extra request per
failure and a second code path that can itself fail. It buys a better log
line, not better behaviour: both cases still end in one refresh then stop.

_Alternative — exponential backoff:_ backoff spaces out repeated requests. With
a cap of one there is no repetition left to space out, and a delay would only
postpone the retry that is expected to succeed. Rejected as complexity that
does not change the outcome.

### D2 — Only a request from the person restores the allowance

The allowance is spent by a refresh and restored by a tap. Nothing else
restores it — in particular not the element reporting `playing`.

Restoring on `playing` was the first design here and it was wrong. It bounds
only the media that never produces output. A clip that plays and then fails —
a truncated or corrupt transcode raising `MEDIA_ERR_DECODE`, a connection lost
mid-stream — would run `playing` → restore → `error` → refresh → `playing` →
… with no bound at all, at one API call plus one bucket request per cycle.
That is the same request storm the change exists to stop, reached by a
different door, and the first version of this design walked through it.

The cost is that a signature expiring twice within one mount recovers
automatically only the first time; the second needs a tap. That is a tap, not
a storm, and D3 makes the tap work.

_Alternative — restore on measured progress_ (currentTime past a threshold,
or `timeupdate` rather than `playing`): it would keep the automatic recovery
and still refuse the pathological case. Rejected as a second tuned number
whose right value nobody knows, to buy back one tap in a session that has
already lasted two hours.

### D3 — A request from the person rebuilds the source, it does not replay it

Restoring the allowance on a tap is not enough on its own, because a media
element that has already failed will not try again. Per the HTML spec,
`play()` on an element whose `error` is set returns an already-rejected
promise: resource selection does not re-run, no `error` event fires, and so
the handler that would spend the restored allowance is never reached. Handed
its own failed element back, the player is dead for as long as it is mounted —
even once the object behind it becomes reachable again.

So the two players make the tap real, each in the way its element is owned:

- **Audio** builds its element imperatively, so a tap on a failed player
  discards it and constructs a new one from a freshly signed URL.
- **Video**'s element belongs to the template and only exists while expanded,
  so giving up collapses the player back to its row and drops the cached
  source. The next tap runs the ordinary expand path, which resolves a fresh
  URL and mounts a new element.

Collapsing also fixes what would otherwise be a silent failure: `failed` is
rendered only in the collapsed row, so a video that gave up while expanded
showed a blank frame and said nothing. One change answers both, and adds no
new copy or UI.

### D4 — The rule lives in `utils/`, not in the two components

A tiny module exporting the allowance and the operations on it, imported by
both players.

The reason is drift, not testability — D6 covers testability. The bound and,
more importantly, the condition that restores it have to stay identical
between audio and video. Those two `onError` handlers are already a
copy-paste pair that drifted from their shared comment once; a fix applied
twice by hand is the same setup again. One definition means the e2e spec that
covers the audio path also constrains the video path, because there is only
one rule to be wrong about.

_Alternative — a local counter in each component:_ three lines each, no new
file, and honest enough on its own. Rejected because it leaves the video
player's copy of the rule pinned by nothing, and doubling the e2e spec to
cover it would cost a second full transcode in CI for a rule that does not
need to exist twice.

_Alternative — a composable in `composables/`:_ the thing has no reactive
state and no lifecycle; it is a counter. `utils/` is where this codebase puts
non-reactive client helpers, next to the metrics module the same components
already use.

Per AGENTS.md the extractions-ship-first rule does not apply: this is a new
module only the fix uses, not code pulled out of an already-shipped component.

### D5 — The allowance is one refresh

Not two, not configurable. A signature expiry is fixed by exactly one refresh;
anything a second refresh would fix is not signature-shaped, and a second
refresh doubles the cost of the failure case for a scenario nobody has
described.

### D6 — The regression guard is an authed e2e spec that counts requests

`e2e/authed/playback-retry.spec.ts`, modelled on `playback-cache.spec.ts`:
bring an entry to `ready` through the real path, rewrite the API's answer so
the playback URL cannot load, press play, and assert the number of
`/api/entries/:id` resolves is exactly the bound.

The engine decides whether it is a regression test or a guard, and both are
worth having:

| | Chromium | WebKit |
| --- | --- | --- |
| unfixed | 2 | 172 |
| fixed | 2 | 2 |

On WebKit it fails before the fix and passes after — the property a
regression test needs. On Chromium it cannot fail before the fix, because
Chromium's ordering already bounds the loop; there it guards against a future
change that removes the bound outright.

Counting resolves is the assertion because the ticket is about requests. A
spec asserting only the "unavailable" message would pass on code that still
looped in the background — pre-fix WebKit does show that message while
issuing its 172 requests.

_Alternative — a unit test only:_ kept as well, because it names the rule
directly and runs in milliseconds. But on its own it would pin a counter
while leaving the thing that actually loops — the `error` handler wired to
that counter — untested.

### D7 — WebKit runs opt-in, and CI coverage is a separate ticket

The spec needs a real WebKit project to be a regression test, and CI installs
Chromium only. Adding WebKit to the install step is an edit to
`.github/workflows/ci.yml`, which the agent PAT cannot push (no `workflow`
scope) and which widens CI's browser matrix — a decision of its own size. So
the project is declared behind `E2E_WEBKIT=1`, off by default: the fix ships
now, the spec is runnable and its red/green recorded, and a follow-up ticket
carries the CI half with this measurement as its evidence.

_Alternative — pin WebKit on unconditionally:_ it would fail every CI run
until the workflow is updated, in a PR that cannot update it.

## Risks / Trade-offs

- **A transient network blip during playback now ends the attempt sooner than
  before** → In practice the media element reports transient stalls as
  `stalled` / `waiting`, not `error`, so this path is not the one that fires.
  Where it does fire, D3 leaves the person one tap from another attempt, and
  the previous behaviour — retrying forever — is not a defensible fallback.
- **`playing` may not fire if playback is blocked by autoplay policy** → then
  the allowance stays spent for that attempt. The attempt is user-initiated in
  every path here, so the policy should not block it; and D3 covers it if it
  does.
- **A broken object now shows "unavailable" quickly instead of appearing to
  keep trying** → this is the intended change, and it is the honest report.
  The loop never recovered; it only looked busy.
- **The e2e spec covers the audio player only** → the video player shares the
  rule module (D4) but not the coverage; its wiring is checked by reading and
  by hand. A second transcoding spec is not worth the minutes, and the PR
  says which half is machine-checked rather than implying both are.
- **Until the follow-up lands, nothing in CI can catch this class of bug
  again** → the guard is the opt-in project plus the unit test. This is a
  real gap and it is named, not papered over: the `phone` project's name
  suggests iOS coverage the config does not provide.
- **Route interception is not a real 403 from the bucket** → it reproduces the
  observable input to the players (a media request that always fails), which
  is what the bound reacts to. The genuinely-missing-object case is the one
  verified by hand against MinIO.

## Migration Plan

None. Client-only behaviour change, no data, no API, no stored state. Rollback
is reverting the commit.
