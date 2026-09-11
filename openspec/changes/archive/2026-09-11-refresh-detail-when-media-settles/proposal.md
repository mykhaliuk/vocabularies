VKB-187 — https://linear.app/myka/issue/VKB-187

## Why

A word opened while its media is still being processed shows "normalisation…"
until the page is reloaded, even after the media has turned ready: the word
detail screen fetches its entry once and never looks again. The feed follows
processing entries by itself, the detail screen does not. Since QStash was
restored on dev (2026-09-11) the compose sheet closes right after the upload
confirms, so the person now lands on the detail screen exactly while the media
is processing, and this gap is what they see.

## What Changes

- While the word's media is processing, the detail screen checks the word again
  on a bounded interval (every 4 seconds, for about 5 minutes) and switches to
  the playable media, or to the failure line, as soon as the row settles. No
  reload is needed.
- It stops checking once the media is ready or failed, when the person leaves
  the screen, and after its budget runs out.
- A check that fails leaves the word on screen as it is: a transient error does
  not replace the word with an error state. A 401 hands the person to sign-in,
  as every other request on this screen does.
- A new clip on the same word (a different media id) gets a fresh budget.

## Capabilities

### New Capabilities

- `media-status`: a screen showing a word's media while it is processed follows
  it until it settles, without a reload, and within a bounded number of checks.

### Modified Capabilities

None. `screen-loading` is about the first load and stays as it is.
`media-playback` is untouched: the settled payload primes the playback cache
the same way the first load does.

## Non-goals

- **The feed's poll.** Its budget is keyed by entry ids rather than media ids
  (the ticket's related observation). This change does not touch the feed; the
  detail screen simply does not repeat that choice.
- **A shared polling composable.** The feed follows a set of entries and
  reconciles a cached list; the detail screen follows one media row and
  replaces one payload. They share an interval and a budget, not a shape.
  Extract when a third consumer shows what is really common.
- **Progress or a percentage.** The API reports a status, not progress.
- **Push instead of polling** (SSE, a websocket). A different architecture for a
  five-minute window.

## Impact

- `pages/entries/[id].vue`: a bounded, client-only poll while the media is
  processing, writing the fresh payload into the page's data.
- `e2e/authed/entry-detail.spec.ts`: processing → ready and processing → failed
  on an open detail screen, the poll's stopping conditions, and a transient
  failure mid-poll.
- No server, API, database or copy change. The capability graph is unaffected:
  the page already calls `GET /api/entries/:id`.
