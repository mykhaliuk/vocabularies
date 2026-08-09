import { describe, expect, test } from 'bun:test';
import {
  AUDIO_METRICS,
  audioStyleVars,
  VIDEO_METRICS,
  videoStyleVars,
} from '../../utils/media-metrics';

// The one defence the media players have. A `ready` player needs MinIO and a
// transcoded file before it renders, so no CI test ever mounts one: without
// these numbers pinned here, handing the feed row the detail page's metrics
// is a change nothing goes red for. `inline` is what ships on `dev` today —
// every value below was read off that branch, not off the spec.
describe('AUDIO_METRICS', () => {
  test('inline keeps the feed row exactly as it ships', () => {
    expect(AUDIO_METRICS.inline).toEqual({
      maxWidthPx: 340,
      buttonPx: 38,
      waveHeightPx: 24,
      glyphPx: 16,
    });
  });

  test('big is the word-detail spec', () => {
    expect(AUDIO_METRICS.big).toEqual({
      maxWidthPx: 360,
      buttonPx: 44,
      waveHeightPx: 30,
      glyphPx: 17,
    });
  });
});

describe('VIDEO_METRICS', () => {
  test('inline keeps the feed row exactly as it ships', () => {
    expect(VIDEO_METRICS.inline).toEqual({
      // No cap in the feed — the row is as wide as the card gives it.
      maxWidthPx: undefined,
      buttonPx: 36,
      portraitFramePx: 300,
      landscapeFramePx: 176,
      playGlyphPx: 14,
      stripGlyphPx: 15,
    });
  });

  test('big is the word-detail spec, glyphs levelled at 17', () => {
    expect(VIDEO_METRICS.big).toEqual({
      maxWidthPx: 360,
      buttonPx: 44,
      portraitFramePx: 340,
      landscapeFramePx: 202,
      playGlyphPx: 17,
      stripGlyphPx: 17,
    });
  });
});

// The tables alone would not catch a builder that pours the wave height into
// the button's property, so the mapping is pinned as well.
describe('style vars', () => {
  test('audio maps each metric to its own custom property', () => {
    expect(audioStyleVars('inline')).toEqual({
      '--audio-max-w': '340px',
      '--audio-btn': '38px',
      '--audio-wave-h': '24px',
    });
    expect(audioStyleVars('big')).toEqual({
      '--audio-max-w': '360px',
      '--audio-btn': '44px',
      '--audio-wave-h': '30px',
    });
  });

  test('video spells the absent inline cap as `none`', () => {
    expect(videoStyleVars('inline')).toEqual({
      '--video-max-w': 'none',
      '--video-btn': '36px',
      '--video-frame-portrait': '300px',
      '--video-frame-land': '176px',
    });
    expect(videoStyleVars('big')).toEqual({
      '--video-max-w': '360px',
      '--video-btn': '44px',
      '--video-frame-portrait': '340px',
      '--video-frame-land': '202px',
    });
  });
});
