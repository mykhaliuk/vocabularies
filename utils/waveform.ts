export const WAVE_BAR_COUNT = 48;

const REFERENCE_PERCENTILE = 0.95;
const REFERENCE_FLOOR_OF_LOUDEST = 0.5;

export const downsamplePeaks = (
  peaks: readonly number[],
  count: number,
): number[] => {
  if (peaks.length <= count) return [...peaks];
  const bars: number[] = [];
  for (let bar = 0; bar < count; bar++) {
    const start = Math.floor((bar * peaks.length) / count);
    const end = Math.floor(((bar + 1) * peaks.length) / count);
    let loudest = 0;
    for (let index = start; index < end; index++) {
      const peak = peaks[index] as number;
      if (peak > loudest) loudest = peak;
    }
    bars.push(loudest);
  }
  return bars;
};

const percentile = (values: readonly number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  const position = fraction * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] as number;
  const high = sorted[upper] as number;
  return low + (high - low) * (position - lower);
};

export const normalizePeaks = (peaks: readonly number[]): number[] => {
  if (peaks.length === 0) return [];
  const reference = Math.max(
    percentile(peaks, REFERENCE_PERCENTILE),
    Math.max(...peaks) * REFERENCE_FLOOR_OF_LOUDEST,
  );
  if (reference <= 0) return peaks.map(() => 0);
  return peaks.map((peak) => Math.min(1, Math.max(0, peak / reference)));
};

export const waveformBars = (
  peaks: readonly number[],
  count = WAVE_BAR_COUNT,
): number[] => normalizePeaks(downsamplePeaks(peaks, count));
