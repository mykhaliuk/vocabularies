## 1. Waveform

- [x] 1.1 `utils/waveform.ts`: `downsamplePeaks` (max per group, proportional group bounds, short input unchanged), `normalizePeaks` (reference = p95, never below half the loudest bar; clamped 0..1; silent clip → zeros), `waveformBars` composing both at `WAVE_BAR_COUNT = 48`
- [x] 1.2 `components/feed/AudioPlayer.vue`: render `waveformBars(peaks)`; bar width and gap proportional to the wave box via a bar-count custom property; drop the fixed `min-width` and pixel gap

## 2. Tests

- [x] 2.1 `tests/unit/waveform.test.ts`: every group keeps its loudest peak, a late spike survives, proportional bounds cover every peak exactly once, one transient does not flatten speech, a short loud event still stands out of an even recording, silence
- [x] 2.2 `e2e/authed/waveform.spec.ts`: a real upload (`assets/late-spike.m4a`, loud burst at 80–85% of the clip) through the pipeline; in the feed and on the detail screen, and in the feed at a 320px viewport: every bar inside the wave box, and the full-height bars at the burst's time
- [x] 2.3 Run 2.2 once against the pre-change player and confirm it fails

## 3. Verification

- [x] 3.1 Run the full CI check set: `ds:check`, `proto:check`, `i18n:check`, `layering:check`, `graph:check`, `spec:check`, `commits:check`, `lint`, `fmt:check`, `typecheck`, `typecheck:e2e`, `test:unit`, `fonts:check`, `test:e2e`, `test:e2e:authed`
- [x] 3.2 Rendered before/after check of the feed and detail players, in both themes
- [x] 3.3 Adversarial `/code-review` on the diff; fix confirmed findings and re-review the delta
- [x] 3.4 Archive the change inside the PR (`openspec archive`)
