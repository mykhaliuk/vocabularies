# Design handoff — media affordance (feed video card + compose media picker)

**Status:** ANSWERED (2026-07-25) — design delivered, product decisions settled
**Feeds:** VKB-66 (feed video card) · VKB-67 (compose media picker)
**Blocked by:** VKB-91 (entitlements exposed to the client)
**Related:** ADR-0009 (upload-first media), ADR-0011 (entitlements / capability roles)

The design round is done. The delivered spec is
`docs/design/prototype/project/Vocabu/media-spec.html` (+ the `media.jsx`
component) — read those for the visuals and the state machine. This file is now
the **decision record**: the brief that was asked, and the answers that came back.

## Decisions (implement to these)

- **Q1 — one control or two:** tier decides. Premium gets one combined
  "voice or video" control (kind inferred from the file); free gets voice plus a
  visibly locked video control. The lock needs its own body, otherwise the gate
  only ever appears as a failure after the fact.
- **Q2 — locked video:** a muted chip with a `Lock`, legible at rest (no hover).
  Tap opens a small sheet. The **disabled video control is the carrot** for free
  users — keep it visible, never hide it.
- **Q3 — feed video:** **no poster card, and — for v0 — no poster image.** The
  collapsed row is a neutral `--surface-sunk` strip (36px, inside a 44px tap
  area) carrying a video **glyph** and the audio player's exact rhythm —
  play · strip · duration — so audio and video occupy the same vertical volume
  in a mixed feed. Tap expands the inline player. *This narrows the delivered
  spec, which had the real `poster.jpg` filling that strip (`cover`). Product
  chose the glyph for now, so the feed list needs no poster URL and the API is
  untouched. Dropping the real frame in later is a presentation change plus a
  `posterUrl` on the list projection — deliberately deferred, not rejected.*
- **Upsell destination:** a "coming soon" screen — copy: *"The feature video
  will be available under this plan."* No pricing, no billing.
- **Duration:** hard reject over the limit. **No trimmer** in v0.

## Still open

Nothing blocking design. The remaining dependency is technical: the client
cannot branch on tier until **VKB-91** exposes an entitlements projection —
`GET /api/me` returns only `{ email, displayName, hasAvatar }` today, and
ADR-0011's one-door rule keeps `plan`/`grants` server-side.

---

## Original brief (kept for context)

This was a **handoff brief**, not a solution. It stated the product rules and the
open questions so a design round (Claude Design) could explore the visual/interaction
options.

---

## Why this is paused

The prototype (`docs/design/prototype/project/Vocabu/`) only ever designed the
**audio** moment (waveform player, blue). It never designed:

1. the **video card** in the feed, and
2. how the **compose media picker** presents *audio vs video vs a locked upsell*.

Both hinge on the same product rule (below), so they should be designed together
as one "media affordance" system.

## Product rules (fixed — design around these)

- **Audio is available to everyone.** Any user can attach an audio moment.
- **Video is premium-gated.** The server enforces `can(user, 'videoUpload')`
  (premium / vip / admin). A non-entitled user who declares a `video/*` upload
  gets **403 `VIDEO_UPLOAD_FORBIDDEN`**; a video smuggled as `audio/*` is caught
  after the ffmpeg probe and the row goes `failed` with
  `"video moments require a premium plan"`. UI must never *rely* on hiding video —
  the server is the gate — but it should present the state honestly.
- **Non-premium** compose: audio attach is available, and video is shown as a
  **visible but locked affordance** — an upsell that signals "video is a premium
  moment," not a hidden/absent feature.
- **Premium** compose: both audio and video are available.
- Limits (server-authoritative, mirror client-side best-effort): **video ≤ 20 s**,
  **audio ≤ 180 s**, ≤ 250 MB. Allowed types are the standard phone
  audio/video containers (mp4/m4a/aac/mp3/ogg/wav/webm/amr/3gpp; mov/webm/mkv/3gpp).

## Open questions to explore ("повертеть")

1. **Premium: one control or two?** When both audio and video are allowed, is it
   two affordances (an audio icon *and* a video icon) or a **single combined
   "attach media"** control that accepts either and infers kind from the file?
2. **Non-premium locked-video treatment.** How does the locked video affordance
   read as an upsell without feeling broken — lock glyph, muted state, a tap that
   opens an upgrade hint? It must coexist with the always-available audio path.
3. **Feed video card.** The media block for a video entry: **poster** (from the
   720p derivative, `poster.jpg`) + a play affordance; **tap → inline playback**
   of the 720p mp4. It should harmonize with the existing **audio card** (a blue
   waveform player). Consider portrait vs landscape — the derivative keeps the
   **short edge at 720** (portrait stays 720 wide), never upscales.

## States to cover (both surfaces)

`idle` (no media) → `picking` → `uploading` (progress %) → `processing`
(normalizing) → `ready` (inline preview/playback) → `failed` (with retry).
The audio card already defines `ready`/`processing`; match its rhythm.

## Constraints for the designer

- **Tokens only** (production CSS): accents `--primary` (rose) / `--secondary`
  (blue, used for audio/media today), `--scrim` for sheet backdrop, radii
  `--r-sm`/`--r-card`/`--r-xl`, `--font-hand` (Caveat) reserved for headwords only.
  No raw hex in shipped `.vue`/CSS (ds:check gate).
- Icons: `lucide-vue-next` (e.g. `Play`, `Pause`, `Mic`, `Video`, `Lock`, `Upload`,
  `Check`, `RefreshCw`). 44 px minimum tap targets. Light **and** dark.
- Respect `prefers-reduced-motion`; honor `--safe-bottom` in the sheet footer.

## What is on the branch today (provisional)

Written before the design landed, held unmerged until the surfaces above are
built:

- **Compose:** a functional audio dropzone driving the real
  upload → progress → confirm loop. The plumbing stands; the *affordance layer*
  (combined vs voice+locked-video, the upsell sheet) is what gets replaced.
- **Feed:** a video entry renders a neutral "video · design pending" placeholder
  where the collapsed row + inline player belong.

Everything else on the branch — the feed data layer, entry card, empty state,
audio player, upload sequence, compose form — is final.
