import { describe, expect, test } from 'bun:test';
import {
  downsamplePeaks,
  normalizePeaks,
  WAVE_BAR_COUNT,
  waveformBars,
} from '../../utils/waveform';

const STORED_PEAK_COUNT = 96;

const quietClipWithSpikeAt = (index: number, quiet = 10, loud = 90) =>
  Array.from({ length: STORED_PEAK_COUNT }, (_, i) =>
    i === index ? loud : quiet,
  );

describe('downsamplePeaks', () => {
  test('keeps the loudest peak of each group', () => {
    expect(downsamplePeaks([1, 5, 3, 2, 9, 4], 3)).toEqual([5, 3, 9]);
  });

  test('a spike late in the clip survives in the bar for its time', () => {
    const bars = downsamplePeaks(quietClipWithSpikeAt(77), WAVE_BAR_COUNT);
    expect(bars).toHaveLength(WAVE_BAR_COUNT);
    expect(bars.indexOf(90)).toBe(38);
  });

  test('uneven groups still cover every peak exactly once', () => {
    const peaks = Array.from({ length: 10 }, (_, i) => i + 1);
    const bars = downsamplePeaks(peaks, 4);
    expect(bars).toEqual([2, 5, 7, 10]);
  });

  test('fewer peaks than bars are returned unchanged', () => {
    expect(downsamplePeaks([3, 1, 4], WAVE_BAR_COUNT)).toEqual([3, 1, 4]);
  });
});

describe('normalizePeaks', () => {
  test('the loudest moment renders at full height', () => {
    const bars = normalizePeaks([10, 40, 80, 20]);
    expect(Math.max(...bars)).toBe(1);
  });

  test('one transient does not flatten the rest of the clip', () => {
    const speech = Array.from({ length: WAVE_BAR_COUNT }, (_, i): number =>
      i % 2 === 0 ? 30 : 15,
    );
    speech[20] = 100;
    const bars = normalizePeaks(speech);
    expect(bars[20]).toBe(1);
    expect(bars[0]).toBeCloseTo(0.6);
    expect(bars[1]).toBeCloseTo(0.3);
  });

  test('a short loud event stands out of an even recording', () => {
    const even = Array.from({ length: WAVE_BAR_COUNT }, (): number => 30);
    even[40] = 90;
    const bars = normalizePeaks(even);
    expect(bars[40]).toBe(1);
    expect(bars[0]).toBeCloseTo(0.67, 2);
  });

  test('speech with no outlier fills the height', () => {
    const speech = Array.from(
      { length: WAVE_BAR_COUNT },
      (_, i): number => 20 + (i % 5) * 10,
    );
    const bars = normalizePeaks(speech);
    expect(bars.filter((bar) => bar === 1).length).toBeGreaterThan(1);
  });

  test('silence stays flat', () => {
    expect(normalizePeaks([0, 0, 0])).toEqual([0, 0, 0]);
  });

  test('an empty clip has no bars', () => {
    expect(normalizePeaks([])).toEqual([]);
  });
});

describe('waveformBars', () => {
  test('stored peaks become the fixed bar count, spike at full height', () => {
    const bars = waveformBars(quietClipWithSpikeAt(77));
    expect(bars).toHaveLength(WAVE_BAR_COUNT);
    expect(bars[38]).toBe(1);
    expect(bars[0]).toBeLessThan(1);
  });
});
