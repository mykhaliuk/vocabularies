## 1. Detail screen

- [x] 1.1 In `pages/entries/[id].vue`, derive the processing media id (`null` unless the media is `processing`) and `watch` it: start a bounded poll when it appears, stop when it clears, restart with a fresh budget when it changes
- [x] 1.2 Each tick fetches `GET /api/entries/:id` with `$fetch` (not `refresh()`), skips if the previous check is still in flight, and on success merges `media` and `playback` into `data`, dropping a response that a date edit or a post-save `refresh()` has overtaken (`retry: 0`, a timeout, only started checks count)
- [x] 1.3 Handle a failed check: 401 → `navigateTo('/login')` (caught and logged), 404 → stop, anything else → log and keep the screen
- [x] 1.4 Stop after 75 attempts at 4000 ms, abort an in-flight check and clear the interval on unmount; client-only

## 2. Tests

- [x] 2.1 `e2e/authed/entry-detail.spec.ts`: with the service worker blocked, route the entry request to report the media as processing, open the word, then flip the route to ready and assert the player replaces the processing line without a reload
- [x] 2.2 Same, flipping to failed: the failure line replaces the processing line
- [x] 2.3 After the settle, and after leaving the screen while processing, assert no further entry requests over more than one interval; a word opened with ready media makes no further entry requests
- [x] 2.4 A check answered 500 mid-poll keeps the word and its processing line on screen, and a later check still switches to the player
- [x] 2.5 A check answered 401 mid-poll hands the person to sign-in
- [x] 2.6 Run 2.1 once against the pre-change page and confirm it fails

## 3. Verification

- [x] 3.1 Run the full CI check set: `ds:check`, `proto:check`, `i18n:check`, `layering:check`, `graph:check`, `spec:check`, `commits:check`, `lint`, `fmt:check`, `typecheck`, `typecheck:e2e`, `test:unit`, `fonts:check`, `test:e2e`, `test:e2e:authed`
- [x] 3.2 Rendered check of the processing → ready switch on the detail screen, in both themes
- [x] 3.3 Adversarial `/code-review` on the diff; fix confirmed findings and re-review the delta
- [x] 3.4 Archive the change inside the PR (`openspec archive`)
