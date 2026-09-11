## 1. Characterization (before moving anything)

- [x] 1.1 Run the four existing e2e specs that pin both callers in both branches against the unmodified code and see them green

## 2. Extraction

- [x] 2.1 Add `utils/leave-to-feed.ts` exporting `leaveToFeed(router, navigate)`: `router.options.history.state.back` is a string → `router.back()`, otherwise `navigate('/feed', { replace: true })`
- [x] 2.2 Add `tests/unit/leave-to-feed.test.ts` pinning both branches, including that a non-string `back` (null, undefined) takes the replace branch
- [x] 2.3 Replace the inline rule in `TopBar.goBack` with `void leaveToFeed(router, navigateTo)`, moving its load-bearing comment to the util
- [x] 2.4 Replace `leaveTheDeletedWord`'s body with `await leaveToFeed(router, navigateTo)`, keeping the caller's catch

## 3. Verification

- [x] 3.1 The four characterization specs are green unchanged after the move
- [x] 3.2 Run the full CI check set: `ds:check`, `proto:check`, `i18n:check`, `layering:check`, `graph:check`, `spec:check`, `commits:check`, `lint`, `fmt:check`, `typecheck`, `typecheck:e2e`, `test:unit`, `fonts:check`, `test:e2e`, `test:e2e:authed`
- [x] 3.3 Adversarial `/code-review` on the diff ("did behaviour stay identical?"); fix confirmed findings and re-review the delta
- [x] 3.4 Archive the change inside the PR (`openspec archive`)
