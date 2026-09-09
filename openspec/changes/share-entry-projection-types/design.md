## Context

See proposal.md — Why. What matters for the approach:

- `server/utils/entry-view.ts` is already the single place the entry payloads
  are built. It is not the single place they are _typed_: the envelope around
  the projections is only an inline return literal in four handlers.
- The client→server `import type` path is established, not new. Six files
  already take types from `~/server/utils/*`, and
  `components/compose/MediaAttach.vue` already types a `defineProps` field
  with an imported `MediaView`. So the pattern is proven for both plain TS
  and the Vue macro.
- `media.kind` and `media.status` are `text()` columns. `peaks` on the same
  table is already narrowed with `$type<number[]>()`, and `speakers.tone` is a
  `pgEnum` whose derived `SpeakerTone` reaches the client today through
  `EntrySpeakerView`. Both precedents exist in the same schema.
- `MediaManifest.kind` in `server/utils/media-process.ts` independently
  declares `'audio' | 'video'`, and `recordMediaReady` writes it straight into
  the column. The union already has two server-side homes before the client is
  considered at all.
- The client copies are not merely duplicates, they are _narrower_ than the
  server type. That asymmetry is what makes the naive import fail, and it is
  why the fix runs server-first.

## Goals / Non-Goals

**Goals:**

- One declaration per shape, with the compiler enforcing that the payload a
  handler returns matches the type the client consumes.
- Narrowing that arrives by inference — `MediaRow` → `MediaView` → props — with
  no cast, no assertion and no re-statement of the union at any hop.
- A diff a reviewer can check mechanically: every deletion is matched by an
  import of a type that is structurally identical to what was deleted.

**Non-Goals** (design-level; scope-level ones are in proposal.md — Non-goals):

- No runtime validation of `kind` / `status` on read. This design narrows types,
  it does not add a parse step; a row holding an unexpected value keeps
  behaving exactly as it does today.
- No re-typing of the media upload/poll surface beyond `MediaManifest.kind`.
  `useMediaUpload` and `/api/media/status` keep their own request/response
  shapes in this pass.

## Decisions

### D1 — Narrow at the Drizzle column with `$type<>()`, not with a `pgEnum` and not with a cast

`db/schema/media.ts` gets the closed sets as `as const` tuples with derived
literal unions (`.claude/rules/feedback_no_ts_enums.md`), applied to the columns:

```ts
export const MEDIA_KINDS = ['audio', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_STATUSES = ['processing', 'ready', 'failed'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

kind: text('kind').$type<MediaKind>().notNull(),
status: text('status').$type<MediaStatus>().notNull().default('processing'),
```

_Why here._ The column is the only point every consumer passes through.
Narrowing it makes `MediaRow`, `toMediaView`, `MediaView` and every domain
read correct at once, and makes a future widening (a third kind) a one-line
change with the compiler listing the places that must handle it.

_Alternatives._

- **`pgEnum` + migration**, as `speakers.tone` does. Genuinely stronger — an
  invalid value becomes a database error rather than a type-level fiction —
  and it is the direction the schema's own comment on `tone` argues for. It is
  out of scope here because it converts a type-only refactor into a data
  migration over live rows, which is a different review and a different risk
  profile. It stays available: `$type<MediaKind>()` and a `pgEnum` produce the
  same TypeScript union, so adopting the enum later touches the schema and the
  migration only, not a single consumer.
- **Cast inside `toMediaView`** (`row.kind as MediaKind`). Rejected. The cast
  would sit exactly where the project's own guidance says a conversion means
  the type upstream is wrong; it also leaves `server/domain/media.ts` reading a
  `string`, so the duplication just moves rather than ends.

_Accepted consequence._ The guarantee is compile-time only. The database will
still accept `text`. This is stated in proposal.md — Non-goals so it is a
recorded decision, not an oversight.

_No ADR._ The rule is that hard-to-reverse, surprising or trade-off decisions
land in `docs/adr/`. This one is a trade-off but it is cheap to reverse (add
the enum and a migration; consumers do not move) and it is already the shape of
two existing decisions in the same file. An ADR here would record a preference,
not a constraint.

### D2 — The union lives in `db/schema/media.ts`, next to the columns it constrains

This mirrors `db/schema/speakers.ts`, which exports `SpeakerTone` beside the
`speakerTone` enum, and it keeps the definition adjacent to the thing that can
invalidate it. `server/utils/entry-view.ts` and
`server/utils/media-process.ts` import it; the client never needs the raw union
because it receives it through `MediaView`.

_Alternative:_ `shared/media-types.ts`, which already exists and is visible to
both sides. Rejected because that file is the _MIME roster_ for uploads — a
different concept that happens to share the word "media" — and because putting
the union anywhere other than the schema reintroduces the question of whether
the column and the union agree.

### D3 — Response envelopes are declared in `server/utils/entry-view.ts` and the handlers are annotated

```ts
export interface FeedEntryView extends EntryView {
  media: MediaView | null;
}

export interface FeedResponse {
  entries: FeedEntryView[];
  nextCursor: string | null;
}

export interface EntryDetailResponse {
  entry: EntryView;
  media: MediaView | null;
  playback: MediaPlaybackUrls | null;
}
```

Annotating the handler's return type is what makes this load-bearing rather
than decorative: without it the type and the literal can drift the same way the
client copies did, only one file further along.

`interface … extends` rather than an intersection alias, so the composed shape
is a single named object type — better error messages, and it keeps the object
shape stable in the sense `metaskills-js-conventions` asks for.

_Alternatives._ Nitro's inferred `$fetch` typing was considered and rejected
in proposal.md — Non-goals: the two call sites that matter use template-literal
paths and `useRequestFetch`, where inference does not hold. Declaring the
envelopes in `shared/` was rejected in D2's terms — the projections they wrap
live in `server/utils`, and splitting the two across directories would leave
the envelope further from the code that produces it than from the code that
consumes it.

### D4 — The client adopts the types by `import type`, and nothing is relocated

`import type` is erased before bundling, so importing from
`~/server/utils/entry-view.ts` does not pull `presignGet` or the storage
client into the client bundle. This is how `MediaAttach.vue`, `EntryCard.vue`, `useCompose.ts` and
`pages/me.vue` already work.

Mapping, one line per deletion:

| Deleted                                                                                    | Replaced by                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `pages/feed.vue` — `FeedMedia`/`FeedSpeaker`/`FeedEntry`/`FeedResponse`                    | `FeedEntryView`, `FeedResponse`            |
| `pages/entries/[id].vue` — `EntryMedia`/`EntrySpeaker`/`EntryDetail`/`EntryDetailResponse` | `EntryDetailResponse`                      |
| `components/feed/EntryCard.vue` — inline `entry` prop                                      | `FeedEntryView`                            |
| `components/feed/MediaBlock.vue` — `FeedMedia`                                             | `MediaView`                                |
| `composables/useEntryPlayback.ts` — `PlaybackUrls`, local `EntryDetailResponse`            | `MediaPlaybackUrls`, `EntryDetailResponse` |

### D5 — One PR, not an extraction PR followed by a feature PR

The "extractions ship first" rule exists because pulling shipped code into a
shared module carries regression risk that must not hide inside a low-risk
feature diff. That asymmetry is absent here: nothing is extracted — the server
types already exist, the new envelope types are fresh declarations, and the
client half is pure deletion plus imports. Both halves are behaviour-neutral by
construction, because the entire change is erased before anything runs. Split
into two PRs, the first would be a server diff that no consumer exercises,
which is harder to review, not easier.

The tasks are still ordered server-first: the client cannot compile against a
narrowed type that does not exist yet.

## Risks / Trade-offs

- **A `string`-typed writer meets a narrowed column** → typecheck is the
  detector, and it runs before anything ships. The fix is to narrow that
  writer (as `MediaManifest.kind` does), never to cast at the boundary.
  `server/domain/media.ts` writes literal strings (`'ready'`, `'failed'`,
  `'processing'`) and `manifest.kind`, which is already the same union, so it
  is expected to compile unchanged — expected, and verified in the task list
  rather than assumed.
- **The type now claims more than the database guarantees** → accepted in D1.
  Concretely: a row holding an unexpected `status` is typed as one of three
  values but is none of them. Behaviour is unchanged, because `MediaBlock`'s
  `v-if` chain already falls through to rendering nothing and the client
  already declared the same narrow union today. No new failure mode is
  introduced; an existing one is made visible.
- **A dropped `type` keyword on an import turns an erased type import into a
  runtime one**, dragging `presignGet` and the S3 client into the client
  bundle. Nothing in the lint config (`.oxlintrc.json` runs `correctness` and
  `suspicious` only) enforces `import type`. Mitigation: keep the imports
  type-only and named as such, and let the build size / a client-side crash on
  a server-only dependency be the loud signal — the same exposure the five
  existing client→server imports already carry.
- **`defineProps` with an imported type** relies on the Vue compiler resolving
  the type across files. Proven in this repo by `MediaAttach.vue`; if it were
  to fail it fails at build, not at runtime.
- **Nothing verifies the envelope types describe the real wire payload** beyond
  the handler annotations added in D3. That is the point of annotating the
  returns; the authed e2e specs for feed and word detail remain the end-to-end
  check that the payload still renders.

## Migration Plan

None. No schema migration (D1), no data change, no wire-format change, so no
staged rollout and no feature flag. Rollback is `git revert` of the single PR.
