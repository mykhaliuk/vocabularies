# ADR-0015: PWA updates are offered, not applied

- Status: Accepted
- Date: 2026-08-09
- Refs: VKB-79, `service-worker/sw.js`, `nuxt.config.js` `pwa` block,
  `components/UpdatePrompt.vue`

## Context

The worker registered with `registerType: 'autoUpdate'` and called
`self.skipWaiting()` on install, so a new build took over and reloaded the page
mid-session. Worse, the page it replaced kept its old precached assets until
that reload happened, and an iOS standalone PWA only truly closes when swiped
out of the app switcher — so during VKB-70 QA an installed client ran the
pre-VKB-70 login form against post-VKB-70 endpoints and read as a product bug.
An auth flow whose client must match the server cannot rely on the user
guessing that a force-quit is what fixes it, and VKB-132 puts a local store on
the device, where a stale client stops being a wrong screen and becomes wrong
data.

## Decision

The service worker waits. `self.skipWaiting()` is no longer called on install;
instead the worker activates only when it receives the `SKIP_WAITING` message
that `workbox-window`'s `messageSkipWaiting()` posts. `registerType` is
`'prompt'`, so `@vite-pwa/nuxt` raises `needRefresh` when a worker is waiting,
and `<UpdatePrompt>` — mounted once in `app.vue` — shows a dismissible toast
whose Reload button calls `updateServiceWorker(true)`. The reload is the user's
action, never ours. `clientsClaim()` stays: it governs who controls the page
once the worker activates, not when it activates.

Registration mode, a waiting worker and a mounted prompt are one decision, not
three: under `'prompt'` an unconditional `skipWaiting()` means `needRefresh`
never becomes true and the toast never appears — implemented, shipped,
invisible. `tests/unit/pwa-update.test.ts` pins all three so none can be
reverted alone.

## Consequences

- No forced mid-session reload. A user mid-compose keeps their draft.
- Waiting is only half of it: the browser looks for a new worker at
  registration, which for an installed PWA that resumes rather than relaunches
  may not happen for days — the prompt would be correct and never fire. So
  `<UpdatePrompt>` calls `registration.update()` itself when the document
  becomes visible and after a router navigation, throttled to once a minute.
  Those are the two moments a user would call "opening the app", which is the
  bar VKB-79 set: a prompt within one app open or navigation.
- Dismissing hides the toast but leaves the worker waiting, so the next launch
  offers the update again. There is no "never ask me" state, by design.
- **Only the first update a given document discovers is announced.** Once
  `workbox-window` sees an update more than a minute after registration it
  classifies it as externally triggered and stops listening for `updatefound`
  — and every check `<UpdatePrompt>` makes is, by construction, outside that
  window. The update in hand still surfaces (verified), but a user who
  dismisses and then stays in the same document across a _second_ deploy is
  not asked again until the app is relaunched. Accepting reloads, which
  re-registers and clears this, so it only bites the dismiss path.
- If the waiting worker never takes over, the Reload button falls back to a
  plain `location.reload()` after four seconds. That does **not** activate
  the worker — the new document is still a client of the old one — but the
  navigation is `NetworkOnly` and the new hashed assets match no route, so the
  fresh document and its code do arrive over the network while the old worker
  keeps its stale precache. The toast returns on the new document and a second
  tap usually completes; it is a degraded retry, not a resolution. When there
  is no waiting worker at all, Reload says so and reloads at once instead of
  spinning for four seconds over a message with no recipient.
- Accepting in one tab reloads the others. `clientsClaim()` fires
  `controllerchange` everywhere, and the library's reload listener is armed in
  every tab that saw the prompt — including one where the user dismissed it.
  Desktop multi-tab only, and not reachable through the library's API.
- One-time cost at the deploy that lands this: clients still running the
  `autoUpdate` bundle have no `waiting` listener, so they get no prompt, and a
  waiting worker cannot activate while they hold the old one. They stay on
  the old bundle until a genuine relaunch — an app-switcher close, not a
  resume — the pre-VKB-79 status quo for one more cycle, not a new wedge.
  Shipping `'prompt'` and the message handler one release _before_ removing
  `skipWaiting()` would migrate that cohort automatically, at the cost of a
  release that is deliberately a no-op.

## Alternatives rejected

- **Keep `autoUpdate`, reload on `controllerchange`** — the reload it forces
  is exactly the interruption to avoid: it can land mid-form or mid-upload,
  and gating it to "safe routes" hard-codes a screen list that goes stale.
- **`skipWaiting()` / `clientsClaim()` alone** — they change which worker
  answers the next request; the loaded page keeps its old assets, which is the
  bug, not the fix.
- **Switch `registerType` only** — a silent no-op while the worker still calls
  `skipWaiting()` unconditionally.
- **`client.periodicSyncForUpdates`**, the module's own polling option — a
  background interval does not run in a suspended PWA, so it fires late on
  exactly the resume it should catch.
