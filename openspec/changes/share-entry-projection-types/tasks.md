Order is server-first by necessity: the client cannot compile against a
narrowed type that does not exist yet. Everything below is erased before
runtime, so `bun run typecheck` — not a rendered check — is the verification
that carries the weight.

## 1. Narrow the media union at its source

- [ ] 1.1 Add `MEDIA_KINDS` / `MEDIA_STATUSES` (`as const` tuples) and the
      derived `MediaKind` / `MediaStatus` types to `db/schema/media.ts`, beside
      the `media` table. Verify: `bun run typecheck` passes and the new exports
      resolve from both `server/` and `db/` (no TS enum introduced — grep the
      diff for `enum` returns nothing).
- [ ] 1.2 Apply `$type<MediaKind>()` to `media.kind` and `$type<MediaStatus>()`
      to `media.status`. Verify: `bun run typecheck` passes with no cast added
      anywhere, and `bun run db:generate` produces **no** new migration file
      (`$type` is compile-time only — a generated migration means something
      other than a phantom type changed, and the task is wrong).
- [ ] 1.3 Confirm `server/domain/media.ts` still compiles unchanged — it writes
      `'ready'`, `'failed'`, `'processing'` and `manifest.kind`, all expected to
      satisfy the narrowed columns. Verify: `bun run typecheck`. If any writer
      is typed `string`, narrow that writer; do not add a cast (design.md — D1).

## 2. Retire the server-side copies of the same union

- [ ] 2.1 In `server/utils/media-process.ts`, type `MediaManifest.kind` as
      `MediaKind` and replace the two other `'audio' | 'video'` annotations
      (`durationLimitSec`'s parameter, and the manifest-shape guard around
      line 509) with the imported type. Verify: `bun run typecheck` passes and
      `grep -n "'audio' | 'video'" server/` returns only the tuple's own
      definition.
- [ ] 2.2 Confirm `MediaView.kind` / `.status` are now the literal unions with
      no edit to `toMediaView` — the narrowing must arrive by inference from
      `MediaRow`. Verify: hover/`tsc` shows `MediaView.kind: MediaKind`, and
      the `entry-view.ts` diff contains no cast.

## 3. Declare the response envelopes

- [ ] 3.1 Add `FeedEntryView` (extends `EntryView`, adding a nullable
      `media` field), `FeedResponse` and `EntryDetailResponse` to
      `server/utils/entry-view.ts`, next to the projections they wrap. Verify:
      `bun run typecheck`.
- [ ] 3.2 Annotate the return types of `server/api/entries/index.get.ts`
      (`FeedResponse`) and `server/api/entries/[id].get.ts`, `[id].patch.ts`,
      `index.post.ts` (`EntryDetailResponse`) so the compiler checks each
      literal against the published type. Verify: `bun run typecheck` passes;
      then temporarily rename one field in the returned literal and confirm the
      typecheck fails — this is the whole point of the task, and an annotation
      that does not fail is decorative. Revert the temporary edit.
- [ ] 3.3 Confirm `bun run layering:check` is still green — the change adds
      types to transport handlers only, no db access. Verify: command exits 0.

## 4. Adopt the types on the client

- [ ] 4.1 `pages/feed.vue` — delete `FeedMedia`, `FeedSpeaker`, `FeedEntry`,
      `FeedResponse`; `import type { FeedEntryView, FeedResponse }` and update
      the `useState`/`useAsyncData` generics and the local helper signatures
      (`isOlderThan`, `applyFirstPage`). Verify: `bun run typecheck`, and the
      diff removes more type lines than it adds.
- [ ] 4.2 `pages/entries/[id].vue` — delete `EntryMedia`, `EntrySpeaker`,
      `EntryDetail`, `EntryDetailResponse`; type-import the exported
      `EntryDetailResponse` and use it for both the `useAsyncData` fetch and
      the PATCH `$fetch` generic. Verify: `bun run typecheck`.
- [ ] 4.3 `components/feed/EntryCard.vue` — replace the inline `entry` prop
      object type with `FeedEntryView`; drop the now-unnecessary
      `EntrySpeakerView` import if `FeedEntryView` covers it (imports are
      updated in the same pass — `.claude/rules/feedback_refactor_imports.md`).
      Verify: `bun run typecheck` and `bun run lint` report no unused import.
- [ ] 4.4 `components/feed/MediaBlock.vue` — replace `FeedMedia` with
      `MediaView` in `defineProps`. Verify: `bun run typecheck`; the Vue macro
      must resolve the imported type (precedent: `MediaAttach.vue`).
- [ ] 4.5 `composables/useEntryPlayback.ts` — replace the local `PlaybackUrls`
      with `MediaPlaybackUrls` and the local `EntryDetailResponse` with the
      exported one; update the module cache's generic. Verify:
      `bun run typecheck`.
- [ ] 4.6 Confirm every client import of the projections is `import type`, so
      nothing from `server/utils/storage.ts` can reach the browser bundle.
      Verify: grepping `components`, `pages` and `composables` for imports
      from `~/server/utils/entry-view` shows `import type` on every line, and
      `bun run build` succeeds.

## 5. Full verification

- [ ] 5.1 Run the complete CI set, not a subset: `bun run lint`,
      `bun run fmt:check`, `bun run typecheck`, `bun run ds:check`,
      `bun run layering:check`, `bun run graph:check`, `bun run spec:check`,
      `bun run test:unit`. Verify: every command exits 0.
- [ ] 5.2 Run `bun run test:e2e` (smoke) and `bun run test:e2e:authed`. The
      authed suite is what proves the payload still renders — `feed.spec.ts`,
      `entry-detail.spec.ts`, `entry-media.spec.ts`, `entry-date.spec.ts` and
      `playback-cache.spec.ts` all cross the shapes this change re-types.
      Verify: both suites green, run WITHOUT piping to `tail` (a piped
      Playwright run reports the pipe's exit code, not Playwright's).
- [ ] 5.3 **No new e2e spec is added.** The schema rule asks for one when a UI
      task touches an authed screen; this change adds no behaviour and no
      rendered difference, so a new spec would assert what 5.2's existing specs
      already assert. Recorded here as a decision, not an omission.
- [ ] 5.4 Open the feed and one word detail screen in a running app and confirm
      an entry with media renders exactly as before (both themes). Verify: the
      before/after screenshots are indistinguishable — for a change that is
      entirely erased at build time, any visible difference is a bug.
- [ ] 5.5 Run the adversarial `/code-review` pass from `docs/PR-CHECKLIST.md`
      and fix confirmed findings. Verify: checklist walked, findings triaged.

## 6. Ship

- [ ] 6.1 Commit with a Conventional Commits subject scoped `entry-view`, on
      the `refactor/vkb-116-share-projection-types` branch, authored
      and SSH-signed as `claude-agent-myka` with the owner's co-author trailer
      (CLAUDE.md — Agent identity). Verify: `git log --show-signature -1`.
- [ ] 6.2 Archive this change inside the PR (`openspec archive`) so
      `openspec/specs/` advances with the merge. Verify: `bun run spec:check`
      passes after archiving.
- [ ] 6.3 Open a ready (not draft) PR into `dev` with `Closes VKB-116`, assign
      the owner, request review from `mykhaliuk` only. Verify: PR is ready, CI
      green, VKB-116 moves to In Review.
