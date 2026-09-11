## Context

See proposal.md, Why. Both pages fetch in setup and `await` the result:

- `pages/entries/[id].vue`: `await useAsyncData('entry:<id>', …)`, then
  `await redirectWhenSignedOut()` in setup, a `failure` computed that maps the
  error to `signed-out | gone | hiccup`, and a template that renders the
  `<article>` when `entry` exists or the `.detail__state` block when
  `stateCopy` is non-empty. The playback cache is primed from the payload in a
  `watchEffect`.
- `pages/me.vue`: `await useFetch('/api/me')`, then, in setup, a 401 →
  `navigateTo('/login')` or any other error → `throw createError({ fatal })`.
  The template is `<main v-if="me">`. There is no `definePageMeta`, so no route
  guard runs in front of it: the page's own fetch is the session check.

The feed solved the same freeze in VKB-144 (`pages/feed.vue`): `lazy: true`,
a `status === 'pending'` loading branch, and the 401 answer handled twice, once
in setup for the SSR pass and once in a `watch(error)` for a client-side load.
The route guard (`middleware/auth.ts`) does not probe on hops between authed
routes, so the page's own await is the only thing blocking these transitions.

## Goals / Non-Goals

**Goals:**

- Mirror the VKB-144 pattern exactly, so all three data screens behave and
  read alike.
- Keep every failure answer identical to what ships (spec: second
  requirement), whichever path the request takes.

**Non-Goals:**

- No shared "lazy page data" composable. Two pages plus the feed differ in what
  they do with the data (cache reconciliation, error mapping, a fatal error
  page), so the common part is one option and a watcher; an abstraction here
  would be invented rather than discovered.
- No change to the SSR output of either page.

## Decisions

**`lazy: true` on the existing composable, not a rewrite.** Nuxt's `lazy`
option resolves the handler after the route loads on the client while SSR still
awaits it, which is precisely the split the spec asks for (instant client
navigation, content in the first paint of a hard load). The alternatives were
worse: dropping the `await` without `lazy` still suspends the transition, and
`useLazyAsyncData` is the same option under another name, so matching the feed's
spelling keeps the three pages greppable together.

**The 401 answer runs in setup and in a watcher.** The setup check stays: on
the server it is the only place where a redirect still makes it into the
response (the feed code records that a watcher can lose the race against
response finalisation). On the client the error arrives after setup has
returned, so a `watch(fetchError)` applies the same `redirectWhenSignedOut`.
The detail page's `retry` already re-runs it after `refresh()`, so all three
entry points converge on one function.

**`/me`'s fatal error keeps being fatal.** Today a non-401 failure throws a
fatal error from setup, which renders the app error page. On the SSR path that
stays as is. On the client path the watcher calls
`showError(createError({ …, fatal: true }))`, which is the documented client
equivalent. An inline error state on `/me` was considered and rejected: it
would change what the person sees on failure, which is outside this change.

**Loading state.** On the detail page it reuses the `.detail__state` block that
already carries the not-found and retry states: a spinner (`Loader2`, as the
feed's loading state uses) and one line of copy, with `role="status"`. It sits
under the same top bar, whose actions stay hidden until `entry` exists, as they
do for the failure states. It renders only while `status === 'pending'` and
there is no entry yet. `/me` is an unstyled page today (no layout, plain
elements), so its loading state is a single `<p role="status">` in the same
register, not a new visual component. Copy: `app.entry.loading` and
`me.loading`, in all three locales.

**e2e technique: the VKB-144 gate.** Each "does not wait" scenario blocks the
service worker (it proxies same-origin `/api/*` network-first, and requests it
forwards bypass `page.route`), establishes hydration first (a click before
hydration is a full page load that SSR serves in-process, invisible to the
gate), holds the screen's request behind a promise with `page.route`, asserts
the URL and the loading state, then releases the gate and asserts the content.
The late-failure scenarios fulfil the held request with the status under test
instead of releasing it.

## Risks / Trade-offs

- [A reader briefly sees a loading state where the old build showed nothing
  and then the page] → That is the change. On a fast network the pending state
  lasts one round-trip, the same wait as before, now on the right screen.
- [A 401 that arrives late flashes the loading state before the redirect] →
  Acceptable and truthful: nothing about the word or the account is claimed.
  `stateCopy` stays empty for `signed-out`, as it does today.
- [`/me` has no route guard, so a signed-out person now sees the account
  settings loading state for one round-trip before sign-in] → Same answer,
  later. Adding `middleware: 'auth'` to `/me` would change its session model
  and is out of scope.
- [An e2e gate that never engages makes a blocking build pass] → Each spec
  asserts the loading state while the gate is closed. A blocking build never
  shows it, so the spec fails red rather than passing vacuously.

## Migration Plan

Client-only change, no data or API migration. Rollback is a revert of the PR.
