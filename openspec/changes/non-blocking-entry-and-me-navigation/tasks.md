## 1. Word detail screen

- [ ] 1.1 Pass `lazy: true` to the entry's `useAsyncData` in `pages/entries/[id].vue` and read its `status`
- [ ] 1.2 Keep the setup-time `redirectWhenSignedOut()` for the SSR pass and add a `watch` on the fetch error that runs it for a client-side load
- [ ] 1.3 Render a loading state in the `.detail__state` block (spinner + `app.entry.loading`, `role="status"`) while the request is pending and there is no entry yet
- [ ] 1.4 Confirm the playback cache is still primed from the payload once it arrives (the existing `watchEffect`), with no extra entry request on first play

## 2. Account settings

- [ ] 2.1 Pass `lazy: true` to `useFetch('/api/me')` in `pages/me.vue`
- [ ] 2.2 Keep the setup-time 401 redirect and fatal error for SSR; add a `watch` on the error that redirects on 401 and otherwise calls `showError(createError({ …, fatal: true }))` on the client
- [ ] 2.3 Render `<p role="status">` with `me.loading` while `/api/me` is pending

## 3. Copy

- [ ] 3.1 Add `app.entry.loading` and `me.loading` to `en`, `fr` and `uk`, sentence case and warm, matching the feed's "loading your words…" register

## 4. Tests

- [ ] 4.1 `e2e/authed/entry-detail.spec.ts`: with the service worker blocked and hydration settled, hold `/api/entries/:id` behind a gate, tap the card, and assert the word's URL and the loading state before release, then the word after release
- [ ] 4.2 Same file: the existing client-navigation failure specs (500 → load-error copy with "try again"; 401 → `/login` with no state block) become the late-arrival path once the page is lazy. Keep them green unchanged, and add the missing 404-on-client-navigation case (not-here copy, no retry). Assert the loading state by its class, not `getByRole('status')`: the app shell keeps an always-present toast region with the same role
- [ ] 4.3 Same file: a direct load of the word's page shows the word with no loading state in the first paint
- [ ] 4.4 `e2e/authed/profile-name.spec.ts`: from the profile tab, hold `/api/me`, follow "account settings", and assert the `/me` URL and loading state before release, then the greeting after release; fulfil it with 401 and assert `/login`
- [ ] 4.5 Prove each gate spec fails on the pre-change code (run it against the unmodified page once) so none of them passes vacuously

## 5. Verification

- [ ] 5.1 Run the full CI check set: `ds:check`, `proto:check`, `i18n:check`, `layering:check`, `graph:check`, `spec:check`, `commits:check`, `lint`, `fmt:check`, `typecheck`, `typecheck:e2e`, `test:unit`, `fonts:check`, `test:e2e`, `test:e2e:authed`
- [ ] 5.2 Drive both screens in a browser against a production build, with the API delayed, in both themes: the loading state appears at once and settles on content; screenshot before/after
- [ ] 5.3 Adversarial `/code-review` pass on the diff; fix the confirmed findings and re-review the delta
- [ ] 5.4 Archive the change inside the PR (`openspec archive`), so `openspec/specs/screen-loading/` lands with the merge
