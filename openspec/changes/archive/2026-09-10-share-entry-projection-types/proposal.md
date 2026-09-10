Linear: VKB-116 — Client re-declares the API response shapes the server already projects.

## Why

`server/utils/entry-view.ts` owns the projections every entry-shaped endpoint
returns (`EntryView`, `EntrySpeakerView`, `MediaView`, `MediaPlaybackUrls`).
The client does not use them. Five files re-declare the same shapes by hand:

| File                              | Duplicated                                                         |
| --------------------------------- | ------------------------------------------------------------------ |
| `pages/entries/[id].vue`          | `EntryMedia`, `EntrySpeaker`, `EntryDetail`, `EntryDetailResponse` |
| `pages/feed.vue`                  | `FeedMedia`, `FeedSpeaker`, `FeedEntry`, `FeedResponse`            |
| `components/feed/EntryCard.vue`   | the whole `entry` prop, media object inline                        |
| `components/feed/MediaBlock.vue`  | `FeedMedia`                                                        |
| `composables/useEntryPlayback.ts` | `PlaybackUrls` (= `MediaPlaybackUrls`), `EntryDetailResponse`      |

Nothing couples the copies to the originals, so drift is silent: renaming a
field in `toEntryView` leaves every copy typechecking and turns the field into
a runtime `undefined` on screen. The project already treats this as the wrong
shape of coupling — `EntrySpeakerView`, `MediaView`, `SpeakerView`,
`Entitlements` and `MeResponse` are all imported client-side today
(`components/feed/EntryCard.vue`, `components/compose/MediaAttach.vue`,
`composables/useCompose.ts`, `pages/me.vue`). The entry feed and detail screens
are simply the places that never got the same treatment.

VKB-108's review deferred it for a concrete reason, still true: a naive import
does not compile. `MediaView.kind` and `.status` are `string`, because the
Drizzle columns are `text()`; `FeedMediaBlock` and the feed card need the
narrowed literal unions they render on. Adopting the server type without
narrowing it first would widen the client, not align it.

A second gap surfaced while scoping: the response envelopes
(`{ entry, media, playback }`, `{ entries, nextCursor }`) are not declared
anywhere server-side. They exist only as the inline return literals of four
handlers, so there is no type for the client to adopt even in principle.

## What Changes

- **Narrow the media union at its source.** `db/schema/media.ts` gains
  `MEDIA_KINDS` / `MEDIA_STATUSES` (`as const` tuples plus derived literal
  unions, per `.claude/rules/feedback_no_ts_enums.md`) and applies them to the
  columns with `$type<MediaKind>()` / `$type<MediaStatus>()`. This mirrors how
  `SpeakerTone` already reaches `EntrySpeakerView.tone` from the schema, and
  how `peaks` is already narrowed with `$type<number[]>()`. The narrowing then
  flows into `MediaRow` → `MediaView` → every consumer with no cast anywhere.
- **`MediaManifest.kind` (`server/utils/media-process.ts`) adopts `MediaKind`**
  instead of re-declaring `'audio' | 'video'` three times in that file — it is
  the same union, and it is what `recordMediaReady` writes into the column.
- **Declare the response envelopes** next to the projections in
  `server/utils/entry-view.ts` (`FeedEntryView`, `FeedResponse`,
  `EntryDetailResponse`) and annotate the handlers that return them, so the
  compiler checks the payload against the type it publishes.
- **Delete the client duplicates** and `import type` the server projections in
  all five files, including `MediaPlaybackUrls` in `useEntryPlayback.ts`.
- Not **BREAKING**: no wire format, field, route or runtime behaviour changes.
  `$type<>()` is erased at build; the whole diff is types plus deletions.

## Non-goals

- **No `pgEnum` migration for `media.kind` / `media.status`.** Considered and
  rejected for this pass: it would turn a Refactor ticket into a schema change
  with a migration over existing rows, and it needs its own decision record.
  The consequence is accepted explicitly — the narrowing here is compile-time
  only, and the database will still accept any text.
- **No DTO classes and no mapper-per-entity layer** (`feedback_no_dto_in_js`).
  The projection functions that exist are serialization and stay as they are;
  this change shares their inferred types, it does not add a layer.
- **No move of the projections into `shared/`.** The client→`server/utils`
  `import type` is the established path here and it costs nothing at runtime;
  relocating already-shipped code is a separate extraction PR under the
  "extractions ship first" rule, not a rider on this one.
- **No switch to Nitro's inferred `$fetch` typing.** The calls this change
  touches use template-literal paths and `useRequestFetch`, where inference is
  unreliable; explicit response types are what actually holds.
- **No new fields, no rendering changes, no i18n copy.** Nothing on screen
  moves.
- `speaker-view.ts`, `entitlements.ts` and `auth.ts` consumers are already
  aligned and stay untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change is type-only: it does not add, remove or alter a single
externally observable behaviour, so there is no requirement to write down.
`skip_specs: true` is set in this change's `.openspec.yaml` rather than
inventing a requirement to satisfy validation.

## Impact

**Server**

- `db/schema/media.ts` — `MEDIA_KINDS`, `MEDIA_STATUSES`, `MediaKind`,
  `MediaStatus`; `$type<>()` on `kind` and `status`. No migration.
- `server/utils/entry-view.ts` — `MediaView.kind` / `.status` narrowed; three
  response-envelope types exported.
- `server/utils/media-process.ts` — `MediaManifest.kind` and the two local
  `'audio' | 'video'` annotations adopt `MediaKind`.
- `server/api/entries/index.get.ts`, `[id].get.ts`, `[id].patch.ts`,
  `index.post.ts`, `server/api/media/status.get.ts` — return annotations.
- `server/domain/media.ts` — writes literal strings already; expected to keep
  compiling unchanged (verified at implementation time, not assumed).

**Client**

- `pages/feed.vue`, `pages/entries/[id].vue`, `components/feed/EntryCard.vue`,
  `components/feed/MediaBlock.vue`, `composables/useEntryPlayback.ts` — inline
  types deleted, replaced by `import type` from `~/server/utils/entry-view`.

**Checks** — `bun run lint`, `bun run fmt:check`, typecheck,
`bun run layering:check`, `bun run spec:check`, `bun run test:e2e` and
`bun run test:e2e:authed` (feed and word-detail screens are covered there).
`ds:check` and `graph:check` are unaffected but run as part of the CI set.

**Risk** — the whole change is compile-time. The one way it can bite is a
narrowed column meeting a `string`-typed writer somewhere in the media
pipeline; typecheck is the detector, and the fix is to narrow that writer too
rather than cast at the boundary.
