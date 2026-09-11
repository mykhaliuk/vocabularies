VKB-149 — https://linear.app/myka/issue/VKB-149

## Why

Opening a word from the feed (`/entries/:id`) or account settings from the
profile tab (`/me`) freezes the screen the person is leaving for the whole API
round-trip, with no feedback. Both pages `await` their data in setup
(`await useAsyncData` / `await useFetch`), and on a client-side navigation that
await suspends the route transition itself. This is the bug class VKB-144 fixed
for the feed, still present on these two screens. The word detail screen
matters most: since QStash was restored on dev (2026-09-11), people land there
right after saving a word with media, which is a round-trip they now wait on
every time.

## What Changes

- `/entries/:id` loads its entry without blocking navigation. The route
  transition completes at once and the screen shows a loading state until the
  entry arrives. SSR still renders the entry on a hard load.
- `/me` does the same for `/api/me`, with its own loading state.
- The failure answers stay as they are, and now also reach a load that
  resolves after the screen is already shown: 401 still hands the person to
  `/login`, a missing or unaskable word still reads "this word isn't here any
  more", a transient failure still offers "try again", and a non-401 failure
  on `/me` still ends on the error page.
- New loading copy for both screens in `en`, `fr` and `uk`.

## Capabilities

### New Capabilities

- `screen-loading`: navigating to a screen never waits on that screen's data
  request. The screen appears at once, shows that it is loading, and then
  settles on its content or on the same failure answer it gives today.

### Modified Capabilities

None. `media-playback` is untouched: the detail screen still primes the
playback cache from its own payload, just later.

## Non-goals

- **A global `<NuxtLoadingIndicator>`.** The ticket raises it as a safety net
  for future blocking pages. After this change no page blocks, so it would
  guard nothing today, and a new app-wide bar is a design-system decision (a
  token, a placement, a motion), not a stabilization fix.
- **Rendering the word instantly from the feed's cache.** The feed already
  holds the entry the person tapped, so the detail screen could paint it with
  no wait at all. It is a real improvement, but it is a cache-coherence
  question (edits, deletes, a refreshed page one), not a navigation fix, and
  the ticket itself expects the detail screen to "just need the spinner".
- **Refreshing the detail screen when its media finishes processing.** That is
  VKB-187, which builds on the loading shape this change introduces.
- **Other screens.** `/feed` was fixed by VKB-144; `/profile`, `/saved` and
  `/discover` do not fetch in setup.

## Impact

- `pages/entries/[id].vue`, `pages/me.vue`: `lazy: true` on the data
  composable, a loading branch in the template, and the 401 / error handling
  moved to run on both the SSR and the client path.
- `i18n/locales/{en,fr,uk}.json`: two loading strings.
- `e2e/authed/`: specs that hold the API request open and assert the screen
  appears before it answers (the VKB-144 technique in `feed.spec.ts`), plus
  the failure answers on a late-arriving load.
- No server, API, database or design-token change. The capability graph is
  unaffected: the same routes are called from the same files.
