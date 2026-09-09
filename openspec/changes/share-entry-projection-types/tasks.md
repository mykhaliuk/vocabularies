Order is server-first by necessity: the client cannot compile against a
narrowed type that does not exist yet. Everything below is erased before
runtime, so `bun run typecheck` — not a rendered check — is the verification
that carries the weight.

## 1. Narrow the media union at its source

- [x] 1.1 Add `MEDIA_KINDS` / `MEDIA_STATUSES` (`as const` tuples) and the
      derived `MediaKind` / `MediaStatus` types to `db/schema/media.ts`, beside
      the `media` table. Verify: `bun run typecheck` passes and the new exports
      resolve from both `server/` and `db/` (no TS enum introduced — grep the
      diff for `enum` returns nothing).
- [x] 1.2 Apply `$type<MediaKind>()` to `media.kind` and `$type<MediaStatus>()`
      to `media.status`. Verify: `bun run typecheck` passes with no cast added
      anywhere, and `bun run db:generate` produces **no** new migration file
      (`$type` is compile-time only — a generated migration means something
      other than a phantom type changed, and the task is wrong).
- [x] 1.3 Confirm `server/domain/media.ts` still compiles unchanged — it writes
      `'ready'`, `'failed'`, `'processing'` and `manifest.kind`, all expected to
      satisfy the narrowed columns. Verify: `bun run typecheck`. If any writer
      is typed `string`, narrow that writer; do not add a cast (design.md — D1).

## 2. Retire the server-side copies of the same union

- [x] 2.1 In `server/utils/media-process.ts`, type `MediaManifest.kind` as
      `MediaKind` and replace the two other `'audio' | 'video'` annotations
      (`durationLimitSec`'s parameter, and the manifest-shape guard around
      line 509) with the imported type. Verify: `bun run typecheck` passes and
      `grep -n "'audio' | 'video'" server/` returns only the tuple's own
      definition.
- [x] 2.2 Point `MediaView.kind` / `.status` at `MediaKind` / `MediaStatus`.
      The plan assumed the narrowing would reach `MediaView` by inference from
      `MediaRow`; it does not — the interface is hand-declared, so it said
      `string` and kept saying it. Verify with a throwaway `.ts` probe that
      assigns `MediaView['kind']` to a `MediaKind` and typechecks — it must
      fail before the edit and pass after, and `entry-view.ts` must contain no
      cast (the column narrowing is what makes the assignment legal).

## 3. Declare the response envelopes

- [x] 3.1 Add `FeedEntryView` (extends `EntryView`, adding a nullable
      `media` field), `FeedResponse` and `EntryDetailResponse` to
      `server/utils/entry-view.ts`, next to the projections they wrap. Verify:
      `bun run typecheck`.
- [x] 3.2 Annotate the return types of `server/api/entries/index.get.ts`
      (`FeedResponse`) and `server/api/entries/[id].get.ts`, `[id].patch.ts`
      (`EntryDetailResponse`) so the compiler checks each
      literal against the published type. `index.post.ts` was in this list and
      is dropped: it returns `{ entry, media, upload }` with no `playback`, so
      it is a different envelope, not this one. Giving it a type belongs with
      the compose surface, which this change does not touch. Verify:
      `bun run typecheck` passes;
      then temporarily rename one field in the returned literal and confirm the
      typecheck fails — this is the whole point of the task, and an annotation
      that does not fail is decorative. Revert the temporary edit.
- [x] 3.3 Confirm `bun run layering:check` is still green — the change adds
      types to transport handlers only, no db access. Verify: command exits 0.

## 4. Adopt the types on the client

- [x] 4.1 `pages/feed.vue` — delete `FeedMedia`, `FeedSpeaker`, `FeedEntry`,
      `FeedResponse`; `import type { FeedEntryView, FeedResponse }` and update
      the `useState`/`useAsyncData` generics and the local helper signatures
      (`isOlderThan`, `applyFirstPage`). Verify: `bun run typecheck`, and the
      diff removes more type lines than it adds.
- [x] 4.2 `pages/entries/[id].vue` — delete `EntryMedia`, `EntrySpeaker`,
      `EntryDetail`, `EntryDetailResponse`; type-import the exported
      `EntryDetailResponse` and use it for both the `useAsyncData` fetch and
      the PATCH `$fetch` generic. Verify: `bun run typecheck`.
- [x] 4.3 `components/feed/EntryCard.vue` — replace the inline `entry` prop
      object type with `FeedEntryView`; drop the now-unnecessary
      `EntrySpeakerView` import if `FeedEntryView` covers it (imports are
      updated in the same pass — `.claude/rules/feedback_refactor_imports.md`).
      Verify: `bun run typecheck` and `bun run lint` report no unused import.
      Also caught here: `components/entry/DeleteSheet.vue` held a sixth copy
      (`mediaKind?: 'audio' | 'video' | null`), fed by the detail page's
      `keptMediaKind`. It now takes `MediaKind | null`. It was not in the
      scoped list because the scan that built that list looked for the
      response shapes, not for the bare union.
- [x] 4.4 `components/feed/MediaBlock.vue` — replace `FeedMedia` with
      `MediaView` in `defineProps`. Verify: `bun run typecheck`; the Vue macro
      must resolve the imported type (precedent: `MediaAttach.vue`).
- [x] 4.5 `composables/useEntryPlayback.ts` — replace the local `PlaybackUrls`
      with `MediaPlaybackUrls` and the local `EntryDetailResponse` with the
      exported one; update the module cache's generic. Verify:
      `bun run typecheck`.
- [x] 4.6 Confirm every client import of the projections is `import type`, so
      nothing from `server/utils/storage.ts` can reach the browser bundle.
      Verify: grepping `components`, `pages` and `composables` for imports
      from `~/server/utils/entry-view` shows `import type` on every line, and
      `bun run build` succeeds.

## 5. Full verification

- [x] 5.1 Run the complete CI set, not a subset: `bun run lint`,
      `bun run fmt:check`, `bun run typecheck`, `bun run ds:check`,
      `bun run layering:check`, `bun run graph:check`, `bun run spec:check`,
      `bun run test:unit`. Verify: every command exits 0.
- [x] 5.2 Run `bun run test:e2e` (smoke) and `bun run test:e2e:authed`. The
      authed suite is what proves the payload still renders — `feed.spec.ts`,
      `entry-detail.spec.ts`, `entry-media.spec.ts`, `entry-date.spec.ts` and
      `playback-cache.spec.ts` all cross the shapes this change re-types.
      Verify: both suites green, run WITHOUT piping to `tail` (a piped
      Playwright run reports the pipe's exit code, not Playwright's).
      Smoke: 24 passed locally and again in CI. Authed: **221 passed in CI**
      (run 34350883608, job 102464007275) — it could not run locally, because
      `infra:up` from a worktree hits the fixed `container_name:
      vocabu-postgres` and starting the existing container fails on host port
      5433, held by an unrelated project's `maestra-postgres-1`. The task asks
      for both suites green, not for where they ran, so this is done.
- [x] 5.3 **No new e2e spec is added.** The schema rule asks for one when a UI
      task touches an authed screen; this change adds no behaviour and no
      rendered difference, so a new spec would assert what 5.2's existing specs
      already assert. Recorded here as a decision, not an omission.
- [ ] 5.4 Open the feed and one word detail screen in a running app and confirm
      an entry with media renders exactly as before (both themes). Verify: the
      before/after screenshots are indistinguishable — for a change that is
      entirely erased at build time, any visible difference is a bug.
      **Still open — the one thing this change owes.** Same port conflict as
      5.2 blocked it locally, and CI does not close it: the authed suite
      asserts rendered output (`no-overflow`, `type-scale`, the entry specs,
      221 passed) but nobody has looked at the two screens in both themes.
      For a change erased at build time the residual risk is small, which is
      an argument for doing it quickly, not for calling it done. Needs the
      owner's eyes, or an explicit waiver.
- [x] 5.5 Run the adversarial `/code-review` pass from `docs/PR-CHECKLIST.md`
      and fix confirmed findings. Verify: checklist walked, findings triaged.
      No bugs found; the diff was confirmed behaviour-neutral, including that
      nothing from `drizzle-orm` reaches `.output/public/_nuxt`. Three
      lower-severity findings, triaged:
      - **Fixed.** `DeleteSheet.vue` was the only client file importing
        `~/db/schema`, and nothing in CI would catch the day someone drops the
        `type` keyword and pulls drizzle into the browser bundle.
        `MediaKind` / `MediaStatus` are now re-exported from
        `server/utils/entry-view.ts`, so client→db imports are back to zero.
      - **Fixed.** The `as readonly string[]` cast in `isReadyManifest` was
        inert — `existing.kind` is already `MediaKind`. Removed; the comment
        above it stays, because it is what stops the check being deleted as a
        tautology.
      - **Out of scope, recorded not skipped.** `e2e/authed/entry-media.spec.ts`
        keeps its own `{ mediaId: string; status: string }`. Adopting the
        shared type would mean wiring a `~/` path mapping into
        `tsconfig.e2e.json`, whose whole point is that the Playwright graph is
        separate from the app's. That is its own change.

      Re-reviewed after the fixes (no skipping a round): no defects. Two
      observations, both accepted rather than actioned here:
      - The `import type` keyword is the only thing keeping the AWS SDK out of
        the browser bundle, and this change takes the client files type-
        importing `entry-view` from three to eight. Pre-existing pattern,
        widened here; a grep-based CI assertion would close it. Filed as
        VKB-181 rather than smuggled into a refactor PR — a new gate does not
        belong in a diff whose review question is "did anything change?".
      - `[id].get.ts` and `[id].patch.ts` each carry two import statements for
        the same module (one value, one type). That is the shape oxfmt
        produces and the convention the repo already uses; cosmetic, left.

## 6. Ship

- [x] 6.1 Commit with a Conventional Commits subject scoped `entry-view`, on
      the `refactor/vkb-116-share-projection-types` branch, authored
      and SSH-signed as `claude-agent-myka` with the owner's co-author trailer
      (CLAUDE.md — Agent identity). Verify: `git log --show-signature -1`.
- [ ] 6.2 Archive this change inside the PR (`openspec archive`) so
      `openspec/specs/` advances with the merge. Verify: `bun run spec:check`
      passes after archiving. **Deferred to the end of the PR, deliberately.**
      `spec:check` fails an archived change whose `tasks.md` still has an open
      box, and 5.2 / 5.4 are open on purpose — the gate is working. Archive
      once CI's authed run is green and those two can be ticked honestly; the
      change folder stays active until then, which is what it is for.
- [x] 6.3 Open a ready (not draft) PR into `dev` with `Closes VKB-116`, assign
      the owner, request review from `mykhaliuk` only. Verify: PR is ready, CI
      green, VKB-116 moves to In Review. Opened as #283.
