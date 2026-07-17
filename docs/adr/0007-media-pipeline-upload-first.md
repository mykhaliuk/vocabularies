# ADR-0007: upload-first media pipeline — two buckets, async ffmpeg, 720p derivatives

- Status: Accepted (async transport provisional — see Open ends)
- Date: 2026-07-17
- Refs: VKB-63, ROADMAP "Media core", `server/utils/storage.ts`,
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
audio/video file up to 20s / 250MB.

**Two buckets per stage.** `originals` — fully private ingest: browser
uploads via presigned PUT (signature pins Content-Type AND Content-Length),
transcoder reads, nothing is ever served from it. `media` — derivatives,
posters, avatars; GET-only for clients, future candidate for an R2 custom
domain with CDN caching. Bucket-level access profiles, per-bucket scoped
tokens, per-bucket CORS (`scripts/r2-cors-set.js`), independent lifecycle
rules. Legacy `S3_BUCKET` is still read as the media bucket until envs
migrate to `S3_BUCKET_MEDIA` + `S3_BUCKET_ORIGINALS`.

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

## Open ends (tracked, not blocking)

- **Async transport is provisionally QStash** (already Upstash customers;
  retries + DLQ; signature-verified worker endpoint). Locally the job runs
  in-process. The owner wants a dedicated discussion before this is final —
  swapping transports touches only `media-queue.ts`.
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
