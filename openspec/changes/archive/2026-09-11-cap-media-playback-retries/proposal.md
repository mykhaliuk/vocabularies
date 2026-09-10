## Why

VKB-182. A presigned playback URL that fails for a permanent reason — 403, 404,
CORS, a missing object — puts the feed players into an unbounded retry loop.
`retrying` is reset in a `finally` block, so it only blocks re-entry within one
attempt; the next `error` event re-enters, and there is no attempt counter. One
tap therefore costs an endless stream of `GET /api/entries/:id` calls plus one
bucket request each, for as long as the screen is open, on a mobile-first PWA.
It is per component instance, so N players on screen means N parallel loops.

Which engine the person is on decides whether it bites, and the answer is the
bad one. Measured against an unreachable source: Chromium re-enters the
handler **once**, WebKit **61 times in five seconds**. Driving the real feed
player says the same — 2 resolves on Chromium, 172 on WebKit before the test
gives up. Chromium delivers the next `error` while `retrying` is still set, so
the bound exists there by accident; WebKit delivers it after the reset and
nothing stops it. Vocabu is an iOS-first PWA, so the engine without the bound
is the one its users are on — and every browser project in the authed e2e
config is Chromium, including the one named `phone`.

The refresh-on-error behaviour was written for an expired signature, where one
refresh does fix the problem. It has no answer for a failure that a refresh
cannot fix, and the terminal `failed` branch is unreachable in that case: it
needs `resolvePlayback` to return falsy or throw, and it does neither — the API
answers fine, it is the object that does not load.

## What Changes

- A playback attempt gets a **budget of one URL refresh**. A second `error`
  event within the same attempt stops retrying and shows the existing
  "playback unavailable" state instead of resolving again.
- The budget is **restored when playback actually starts** (the element's
  `playing` event), so a signature that expires an hour into a session is
  still recoverable — the behaviour the current code was written for.
- A fresh user gesture is a fresh attempt, so a person who taps play again
  after a failure gets another refresh. Retrying stays bounded by user
  action rather than by the element's own error events.
- The retry budget moves into a small unit-tested module so both players
  share one definition of the rule and CI can pin it. Neither player is
  reachable from any existing test — audio and video playback need MinIO —
  so today nothing would catch this regression a second time.
- `AudioPlayer.vue` and `VideoPlayer.vue` change together; they are the same
  shape with the same defect.

## Capabilities

### New Capabilities

- `media-playback`: how the client turns a ready entry's media into playback,
  and what it must do when the signed URL fails — including the bound on
  retries that this change introduces. First spec for this capability.

### Modified Capabilities

<!-- None: media-playback has no accepted spec yet. -->

## Non-goals

- **Classifying the failure.** The `error` event carries a `MediaError` code,
  not an HTTP status, and both an expired signature and a permanently missing
  object surface as the same code. Telling them apart would need a separate
  probe request; a bound on attempts is what actually stops the loop, and it
  works for both cases.
- **Exponential backoff.** With one refresh per attempt there is no repeated
  request left to space out. Adding a delay would only postpone the single
  retry that is expected to succeed.
- **Repairing the data.** A `ready` row whose object is missing is a real
  defect, but recovering or re-transcoding it is server-side work and a
  separate ticket. This change makes the client stop hammering it.
- **The server's presign path.** `GET /api/entries/:id` and the storage layer
  are untouched.
- **Retry UI.** No new button, copy, or state beyond the `failed` message the
  players already render.

## Impact

- `components/feed/AudioPlayer.vue`, `components/feed/VideoPlayer.vue` — the
  `onError` handlers and the guards they read.
- A new client module under `utils/` plus its unit test under `tests/unit/`,
  following the `media-metrics.ts` / `media-metrics.test.ts` pairing already
  used for numbers these components cannot test in place.
- No API, schema, route, or domain operation changes, so
  `docs/capability-graph.md` does not move.
- No design-system tokens or copy change.
