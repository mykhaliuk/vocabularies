// Every metric that differs between the feed row (`inline`) and the word
// detail page (`big`), in one frozen table that both players read.
//
// It lives out here rather than in the stylesheets so the table is pinnable:
// tests/unit/media-metrics.test.ts pins the numbers, and
// e2e/authed/media-ready.spec.ts (VKB-115) mounts a `ready` player against
// CI's MinIO and asserts the rendered players consume them. `inline` is
// what ships in the feed today and must not move; `big` is the word-detail
// variant (word-detail-spec.html §Anatomy step 4).

export type MediaVariant = 'inline' | 'big';

export type AudioMetrics = {
  maxWidthPx: number;
  buttonPx: number;
  waveHeightPx: number;
  glyphPx: number;
};

// An absent max-width is "no cap" — the feed row's shipped behaviour, and the
// reason the two variants cannot share one number here.
export type VideoMetrics = {
  maxWidthPx: number | undefined;
  buttonPx: number;
  portraitFramePx: number;
  landscapeFramePx: number;
  playGlyphPx: number;
  stripGlyphPx: number;
};

export const AUDIO_METRICS: Readonly<Record<MediaVariant, AudioMetrics>> =
  Object.freeze({
    inline: Object.freeze({
      maxWidthPx: 340,
      buttonPx: 38,
      waveHeightPx: 24,
      glyphPx: 16,
    }),
    big: Object.freeze({
      maxWidthPx: 360,
      buttonPx: 44,
      waveHeightPx: 30,
      glyphPx: 17,
    }),
  });

// The collapsed row's two glyphs start from different inline sizes (the play
// triangle reads heavier than the outline video mark), and the big variant
// levels them at 17 — the prototype's numbers, media.jsx VideoSample.
export const VIDEO_METRICS: Readonly<Record<MediaVariant, VideoMetrics>> =
  Object.freeze({
    inline: Object.freeze({
      maxWidthPx: undefined,
      buttonPx: 36,
      portraitFramePx: 300,
      landscapeFramePx: 176,
      playGlyphPx: 14,
      stripGlyphPx: 15,
    }),
    big: Object.freeze({
      maxWidthPx: 360,
      buttonPx: 44,
      portraitFramePx: 340,
      landscapeFramePx: 202,
      playGlyphPx: 17,
      stripGlyphPx: 17,
    }),
  });

const px = (value: number) => `${value}px`;

export const audioStyleVars = (variant: MediaVariant) => {
  const metrics = AUDIO_METRICS[variant];
  return {
    '--audio-max-w': px(metrics.maxWidthPx),
    '--audio-btn': px(metrics.buttonPx),
    '--audio-wave-h': px(metrics.waveHeightPx),
  };
};

export const videoStyleVars = (variant: MediaVariant) => {
  const metrics = VIDEO_METRICS[variant];
  const maxWidth = metrics.maxWidthPx;
  return {
    '--video-max-w': maxWidth === undefined ? 'none' : px(maxWidth),
    '--video-btn': px(metrics.buttonPx),
    '--video-frame-portrait': px(metrics.portraitFramePx),
    '--video-frame-land': px(metrics.landscapeFramePx),
  };
};
