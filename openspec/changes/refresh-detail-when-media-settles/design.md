## Context

See proposal.md, Why. The detail page (`pages/entries/[id].vue`, lazy since
VKB-149) loads `GET /api/entries/:id` once through `useAsyncData`, renders the
media through `FeedMediaBlock` (processing row, failure line, or a ready
player), and primes the playback cache from the payload in a `watchEffect`.
It already replaces its payload by hand when the said-on date changes
(`data.value = { ...data.value, entry }`; the ref is shallow), and calls
`refresh()` after an edit saved from the compose sheet.

The feed follows processing entries with its own `$fetch` (not `refresh()`), on
a 4 s interval with a 75-attempt budget (~5 min, the worker's ceiling), keyed
by the set of processing entry ids.

## Goals / Non-Goals

**Goals:**

- The spec's two requirements, on the detail screen only.
- A background check can never make the screen worse than it was: no error
  state, no flash of the loading state, no churn of a ready player.

**Non-Goals:**

- No shared composable, no change to the feed (proposal, Non-goals).

## Decisions

**Check with a separate `$fetch`, never `refresh()`.** `refresh()` goes
through `useAsyncData`: on failure it sets the page's error ref and resets
`data`, which the template renders as the load-failure state, and while pending
it flips `status`. A single transient 500 during a background check would
replace a perfectly good word with "we couldn't load this word". The feed
avoids `refresh()` for its poll for the same reason. The detail check instead
calls `$fetch` itself and, on success, assigns the whole payload
(`data.value = fresh`). The playback-cache `watchEffect` sees the new payload
and primes the fresh URLs, so the ready player needs no extra request.

**Key the poll by the processing media id.** A `watch` on the id of the media
while it is processing (`null` otherwise) starts the poll when an id appears,
stops it when the id disappears (ready, failed, removed), and restarts it with
a fresh budget when the id changes (a new clip). This is the feed's
`processingKey` idea applied to the one row this screen shows, and it avoids
the feed's entry-keyed blind spot without touching the feed.

**Own constants, same values.** `4000` ms and `75` attempts, declared in the
page. Two consumers do not justify a shared module (PR checklist: more than
two), and the values are the worker's ceiling rather than a coupling between
the two screens.

**Failure handling per status.** 401 → `navigateTo('/login')`, caught and
logged like the page's other redirects. 404 → stop checking; the word was
deleted elsewhere, and the next navigation will say so. Anything else → log,
keep the screen, and let the next tick try within the budget.

**Lifecycle.** Client-only (the interval is set in a watcher that runs only on
the client; SSR renders the first payload as today). An `AbortController`
cancels an in-flight check on unmount so a late response never writes into a
screen that is gone, and `onUnmounted` clears the interval. A tick is skipped
while the previous check is still in flight.

**e2e by payload substitution.** The spec routes `GET /api/entries/:id`, takes
the real response (`route.fetch()`), and rewrites `media` to a processing row
until the test flips it to ready or failed. This is deterministic and needs no
bucket; the real upload → transcode → ready path is already covered by
`media-ready.spec.ts`. Stopping is asserted by counting the entry requests
after the settle and after leaving the screen, over more than one interval.

## Risks / Trade-offs

- [Budget exhaustion is not e2e-tested: it takes ~5 minutes] → The stop
  condition is a single comparison next to the interval. It is reviewed rather
  than tested, and recorded here.
- [A check every 4 s for up to 5 min while a word is open] → Bounded, one small
  JSON request, on the one screen where the person is waiting for exactly
  this. It ends the moment the media settles.
- [The word's text changes elsewhere while the poll runs (another tab edits
  it)] → The fresh payload carries it, which is correct.
- [Vacuous pass] → The ready-transition spec is run once against the pre-change
  page, where the processing line never goes away, and must fail.

## Migration Plan

Client-only, no data or API change. Rollback is a revert of the PR.
