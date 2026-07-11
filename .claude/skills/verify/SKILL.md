---
name: verify
description: Build, run, and drive the Vocabu app locally to verify a change end-to-end (no DB needed for static/head/PWA surfaces)
---

# Verifying Vocabu changes

## Build + run (no database)

```bash
bun install --frozen-lockfile
bun run build
PORT=4173 node .output/server/index.mjs   # background it
```

Works without Postgres/Redis env: `/` and `/offline` are prerendered,
`/login` renders; only flows that hit the DB (magic-link submit, `/me`)
need `bun run start:local` + docker infra instead.

## Drive it

- Plain HTTP: `curl -s http://localhost:4173/` for SSR head/HTML,
  `/manifest.webmanifest`, static files in `public/`.
- Real browser (client-injected tags, service worker): Playwright is a
  dev dep — `node -e "import('playwright').then(...)"` with
  `chromium.launch()`, then `page.evaluate` / `page.screenshot`.
- Service worker registers on localhost; check via
  `navigator.serviceWorker.getRegistration()`.

## Gotchas

- The PWA manifest link is injected by `<VitePwaManifest />` in
  `app.vue` (client-side), NOT present in SSR HTML — check it in a
  browser, not with curl.
- Icons are generated, not hand-drawn: `bun run icons:gen`
  (scripts/generate-icons.js, uses Playwright chromium).
- Check both themes for style changes: set
  `localStorage['vocabu-theme']` to `dark`/`light` before load.
