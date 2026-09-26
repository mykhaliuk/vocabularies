VKB-192 — https://linear.app/myka/issue/VKB-192 (GitHub #302)

## Why

Most audio waveforms in the feed look nearly flat. The server stores 96 peaks
per clip and the player draws one bar per peak, but the bar geometry
(`min-width: 2px`, `gap: 3px`) was sized for the prototype's 32-bar waves: 96
bars need at least 477px, the inline wave box is about 252px, and
`overflow: hidden` silently clips the last ~47% of the clip. The bars are
scaled to the loudest of all 96 peaks, so whenever that peak sits in the
hidden half every visible bar is measured against a bar nobody can see. The
played tint sweeps the visible width, so it also runs ahead of the audio.

The stored peaks are complete and correct; only the rendering loses them. So
every existing entry is repaired by a client-side fix, with no migration.

## What Changes

- The player draws a fixed number of bars (48) regardless of how many peaks
  are stored, downsampling by taking the loudest peak of each group, so every
  moment of the clip is represented and a loud moment can never be averaged
  away.
- Bar width and gap are proportional to the wave box instead of fixed pixel
  minimums, so the bars always fit — on a narrow phone they are thinner, never
  clipped.
- Bars are scaled to a high percentile (p95) of the clip rather than to its
  single loudest bucket, so one click or tap transient does not flatten the
  speech around it. The reference never drops below half the loudest bar, so
  a short shout or laugh in an even recording still stands out instead of
  every bar clamping to full height. The loudest moment always renders at
  full height.
- Because the bars now span the whole box evenly, the played tint reaches a
  bar when playback reaches that bar's time.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `media-playback`: adds the requirement that the audio waveform represents
  the whole clip.

## Non-goals

- **Changing stored peaks** (`PEAK_COUNT`, RMS buckets, a backfill). The data
  is fine; a layout number does not belong in stored rows.
- **Measuring the box at runtime** (`ResizeObserver`). The bar count would
  change after hydration; proportional geometry gets the same fit without it.
- **The synthesized wave** for entries without peaks. It already fits and is
  not audio.

## Impact

- `utils/waveform.ts` (new): pure downsampling and normalization.
- `components/feed/AudioPlayer.vue`: renders the downsampled bars with
  proportional geometry.
- Unit tests for the helpers; an authed e2e pinning that no bar overflows the
  wave box in either variant and that a late loud peak renders full height.
- No server, API, database or copy change; the capability graph is unaffected.
