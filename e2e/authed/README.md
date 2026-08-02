# Authed e2e suite (VKB-101)

Playwright specs for everything behind `middleware: 'auth'`. Runs **in CI** —
this is the suite a UI ticket on an authed screen adds coverage to.

```sh
bun run test:e2e:authed
```

That brings up local Postgres + MinIO (`infra:up`), applies migrations, and
runs `playwright.authed.config.ts` under the local env. CI does the same with a
Postgres service container and its own migrate step (`.github/workflows/ci.yml`,
job `e2e-authed`).

From a **git worktree**, skip the first link: `docker-compose.yml` pins
`container_name: vocabu-postgres`, so `infra:up` collides with the containers
the main checkout already started (same for `test:poll-claim`). The containers
are global — run the rest directly:

```sh
bun run db:migrate
node scripts/with-env.js local playwright test --config playwright.authed.config.ts
```

Run one Playwright suite at a time locally. Both build into the same `.output`,
so a concurrent smoke run would serve half of this one's bundle; the separate
port (below) only avoids a listener collision, not that.

## Which suite does my spec belong to?

| Suite      | Command                   | Runs in CI | For                                                           |
| ---------- | ------------------------- | ---------- | ------------------------------------------------------------- |
| smoke      | `bun run test:e2e`        | yes        | routes that render with no DB: landing, login, offline, 404   |
| **authed** | `bun run test:e2e:authed` | yes        | anything needing a session — feed, profile, detail, settings  |
| local      | `bun run test:poll-claim` | no         | poll/claim + compose: needs MinIO, transcoding, a real device |

If the page has `middleware: 'auth'`, it belongs here.

## Adding a spec

```ts
import { expect, test } from './fixtures';

test('the saved tab lists loved words', async ({ authedPage }) => {
  await authedPage.goto('/saved');
  await expect(
    authedPage.getByRole('heading', { name: /saved/i }),
  ).toBeVisible();
});
```

- `authedPage` is a normal Playwright page whose context is already signed in
  as a **brand-new user**, sitting on `/feed`. A fresh user per test means an
  empty feed and no cleanup step; tests never see each other's data. The cost
  is that rows accumulate: CI throws its database away, your local one keeps
  every `authed-*@example.com` user and their entries until
  `bun run infra:reset`.
- Seed what the screen needs through the API on that same context —
  `authedPage.request.post('/api/entries', { data: { word: 'appo' } })` — and
  reload. The context carries the session cookie, so page navigations and
  `page.request` calls are equally authenticated.
- Need two users, or the address itself? Call `signIn(page)` directly; it
  returns the email it used, and takes one if you supply it.
- Clicking anything whose effect is JS-driven (a `@click` button, the compose
  FAB) goes through `clickUntil` — server-rendered markup passes every
  actionability check before Vue attaches its listener, so a single early click
  is silently dropped. Plain links need no such care. Because it retries, point
  it only at controls that are safe to click twice and are not covered by their
  own effect: never a submit, never a button an opening overlay lands on.

## How the session is minted

The real magic-link flow, not a forged cookie: the fixture POSTs
`/api/auth/magic-link`, reads the link the console emailer printed, and opens
it. The callback sets `vocabu_session` on the browser context.

Reading the link is the one piece of machinery worth knowing about. A spec
cannot read the stdout of a server Playwright spawned, so
`scripts/e2e-server.js` runs the built app and mirrors its output to
`tmp/e2e-authed-server.log`; the fixture scans that file for the line matching
its own address. No test-only endpoint, no second email driver, and a broken
sign-in path fails this suite instead of hiding behind a seeded cookie.

Consequences worth remembering:

- `APP_ENV` must be `local` — that is what selects the null Redis/rate-limit
  drivers and a non-Secure cookie (this suite talks plain http). It is
  necessary but not sufficient for the console emailer: `RESEND_API_KEY` +
  `EMAIL_FROM` select Resend at any stage. The config refuses to start on
  either mistake.
- The server runs on **port 3100**, so it does not collide with a dev server
  or the smoke suite on 3000. `reuseExistingServer` is off: a server this
  config did not start writes no log to read links from.
- Global setup fails with a named fix if the database is unreachable or the
  tables are missing, rather than letting every spec die on an opaque 500.
