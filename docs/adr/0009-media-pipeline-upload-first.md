# ADR-0009: upload-first media pipeline — two buckets, async ffmpeg, 720p derivatives

<!-- Renumbered from 0007: the number was minted twice in parallel PRs
     (transactional-email kept it as the indexed one). The core decision
     text is unchanged; the async-transport open end was later finalized
     by VKB-80. -->

- Status: Accepted
- Date: 2026-07-17 (async transport finalized 2026-07-21, VKB-80)
- Refs: VKB-63, VKB-80, VKB-81, ROADMAP "Media core", `server/utils/storage.ts`,
  `server/utils/media-process.ts`, `server/utils/media-queue.ts`

## Context

Media — a ≤20s audio or video _moment_ of the speaker — is the product's
killer feature and its riskiest technical surface. The original plan was
in-browser recording (MediaRecorder), which drags in the worst platform
risks: iOS Safari PWA microphone quirks, per-browser codec output, and
waveform capture at record time. Meanwhile the real capture behavior is
spontaneous: dictaphone or camera first, app second. Files arrive in
whatever format the device produces — including 4K60 HEVC `.mov` (~135MB
per 20s), which does not play outside Apple hardware, so "store as-is and
serve" is not an option for video.

## Decision

**Upload-first, no in-browser recording in v1.** The app accepts any
audio/video file up to 250MB. Duration limits are per kind: video ≤20s
(weight + transcode cost), audio ≤3min (cheap in every dimension — ~1MB
per minute of AAC, seconds to transcode). The client pre-checks duration
via `loadedmetadata` before uploading; the server is authoritative.

**Two buckets per stage.** `originals` — fully private ingest: browser
uploads via presigned PUT (signature pins Content-Type AND Content-Length),
transcoder reads, nothing is ever served from it. `media` — derivatives,
posters, avatars; GET-only for clients, future candidate for an R2 custom
domain with CDN caching. Bucket-level access profiles, per-bucket scoped
tokens, per-bucket CORS (`scripts/r2-cors-set.js`), independent lifecycle
rules. All stages read `S3_BUCKET_MEDIA` + `S3_BUCKET_ORIGINALS`; the
legacy single-bucket `S3_BUCKET` fallback was dropped once production
migrated to the two-bucket vars (VKB-72).

Scoped tokens landed 2026-08-15 (VKB-126): `storage.ts` builds one client
per bucket kind, each from its own pair (`S3_MEDIA_*`, `S3_ORIGINALS_*`),
built lazily on first use of that kind and never falling back to the other.
Ops scripts that need `r2:cors:*` carry a third, admin-scoped pair
(`S3_ADMIN_*`) the application never reads.

**Async normalization with ffmpeg, in the Nitro app on Vercel.** Confirm
returns immediately (`processing`); a queued job downloads the original,
probes it, enforces the 20s cap, and produces: video → 720p H.264/AAC MP4
(short edge 720, never upscaled) + poster JPEG; audio → AAC in M4A; both →
duration + waveform peaks (96 max-abs buckets from mono 8kHz PCM) stored in
a `manifest.json` next to the derivatives. Originals are kept forever as
source of truth; 720p (not 1080p) until there's revenue to justify the
bandwidth.

Measured on the worst-case input (20s 4K60 HEVC, 134MB, 4-core sandbox
comparable to Vercel performance tier):

| step                       | wall time |
| -------------------------- | --------- |
| transcode → 720p H.264     | ~20 s     |
| poster frame               | ~0.1 s    |
| PCM decode for peaks       | ~0.04 s   |
| audio-only leg (mp3 → m4a) | ~0.6 s    |

~15× headroom against the 300s `maxDuration` now set for Vercel functions.
Cloudflare Stream (the fallback candidate) is not needed: it would add a
vendor, a different player contract, and per-minute pricing to solve a
problem the numbers say we do not have.

## Consequences

- The client is trivial: pick file → PUT → poll. All format knowledge lives
  server-side in one module (`media-process.ts`).
- Peaks are computed from the file, so waveforms need no record-time
  capture — which is what made dropping in-browser recording free.
- The whole request path stays on the existing stack (Nitro/Vercel/R2); no
  new runtime.
- The ffmpeg binary rides in the function bundle
  (`@ffmpeg-installer/ffmpeg` ~66MB — npm-shipped, no postinstall
  downloads; its `__dirname`-relative resolution is visible to Nitro's
  tracer, verified in the build output). There is deliberately **no
  ffprobe**: `@ffprobe-installer` resolves its 76MB binary via a dynamic
  require the tracer cannot follow, so it silently missed the bundle —
  metadata is parsed from the `ffmpeg -i` banner instead (duration, stream
  kinds, codecs, dimensions), which halves the binary weight.
- The pinned build is from 2018; if a future iPhone codec variant fails to
  decode, bumping the binary package is the first move.

## Idempotency (VKB-81)

QStash's at-least-once delivery, plus the VKB-80 inline-fallback race
(`enqueueJSON` throws after QStash already accepted the job, so the same
job runs inline AND is later redelivered), means the same job can reach
`processMedia` twice. The `manifest.json` a completed run writes is the
idempotency token: a `'ready'` manifest is durable proof the transcode and
uploads already happened, so `processMedia` reads it first and returns
early instead of re-running ffmpeg. Two concurrent deliveries can both read
"not ready yet" and both run the full pipeline before either's manifest
write lands — accepted, not fixed with a distributed lock, because the
pipeline's output is deterministic: a duplicate run is wasted work, never a
corrupted or conflicting result. `force` is the deliberate-reprocess
opt-out (default `false`, bypasses the guard); it is a function parameter
only, never read from the QStash worker's request body, so a
retried/redelivered message can never use it to defeat the guard it exists
to be an exception to.

## Replacing an entry's moment (VKB-107, 2026-08-05)

An entry holds at most one moment (partial unique index on
`media.entry_id`). Replacing it therefore has to retire the incumbent, and
the only question is **when**.

**Decision: at the `ready` transition.** `POST /api/entries/:id/media` mints
a slot and records the destination in `media.pending_entry_id`, changing
nothing the user can see; `recordMediaReady` then claims the entry —
delete the incumbent, bind the replacement, clear the pointer — in one
transaction that locks the `entries` row first. Locking the entry before
any `media` row matches the order `DELETE /api/entries/:id` acquires them
through its cascade (no deadlock), and serialises two uploads racing for
one entry; without it that race raises `23505`, reproduced against local
Postgres. Clearing the pointer inside the transaction is what makes the
claim exactly-once under QStash's at-least-once delivery.

Rejected alternatives, both of which lose a recording the user still has:

- **At mint.** A slot is a promise of bytes. The client may never PUT and
  never confirm — a cancelled sheet, a dropped connection, a presign
  expiring after 600s — so the incumbent would be traded for nothing.
- **At confirm.** Tempting, because confirm is the first point the bytes
  provably exist: transport has just seen the object with `HeadObject`.
  But an object in a bucket is not yet a moment. Everything that can
  reject a file runs _after_ confirm — the duration cap, "could not read
  this file as audio or video", and the entitlement re-check on the
  **probed** kind (which exists precisely because the declared content
  type is untrusted). Replacing a kept 20s voice note with a 3-minute
  clip would delete the incumbent and leave a `failed` row.

At `ready` the replacement is transcoded, within limits and entitled, so
the delete is a retirement rather than a loss. Consistent with "originals
are kept forever": the retired row goes, its R2 objects stay.

`pending_entry_id` is `ON DELETE SET NULL`, not `cascade` — if the entry
is deleted mid-upload the swap is moot, but the media row is not the
entry's to take with it. It is deliberately unconstrained: any number of
uploads may be aimed at one entry, and only the one that reaches `ready`
takes it. `removeEntryMedia` clears pending pointers, since nothing else
expires them and an abandoned replace would otherwise restore a moment
the user had explicitly removed.

## Open ends (tracked, not blocking)

- **Async transport is QStash — final** (decided with the owner
  2026-07-21, VKB-80; already Upstash customers; retries + DLQ;
  signature-verified worker endpoint). QStash tokens and signing keys are
  account-level, so stage/prod isolation uses **named queues** —
  `vocabu-stage` (dev + preprod) and `vocabu` (prod), mirroring the Redis
  instance naming — selected via `QSTASH_QUEUE_NAME`. Locally the job
  still runs in-process. Swapping transports would touch only
  `media-queue.ts`.
- Audio canonical format chosen as AAC/M4A for universal playback (iOS
  Safari cannot play Opus-in-WebM); revisit only if size ever matters.
- Real-device playback checks (iOS Safari standalone, Android Chrome) run
  on the preview deploy via `/dev/media-spike`.

## Alternatives rejected

- **In-browser recording first** — maximal platform risk for a capture mode
  users don't actually start with; can be added later as just another
  source of files for the same pipeline.
- **Serve originals as-is** — iPhone HEVC doesn't play on non-Apple
  devices; 135MB per view is hostile to mobile data even where it does.
- **Synchronous transcode inside the confirm request** — couples a
  minutes-long CPU job to an HTTP round-trip and loses the work on client
  disconnect.
- **Cloudflare Stream** — right call if transcode didn't fit the function
  limits; it fits with 15× headroom, so the extra vendor isn't paying rent.
