import { describe, expect, test } from 'bun:test';
import { shouldSkipProcessing } from '../../server/utils/media-process';
import type {
  MediaFailure,
  MediaManifest,
} from '../../server/utils/media-process';

// The idempotency guard (VKB-81): a 'ready' manifest already found in R2
// proves the ffmpeg run and derivative uploads durably happened, so a
// redelivered/retried job can skip straight to returning it instead of
// re-transcoding. force is the deliberate-reprocess opt-out.

const READY: MediaManifest = {
  status: 'ready',
  kind: 'audio',
  durationSec: 12.5,
  width: null,
  height: null,
  peaks: [1, 2, 3],
  sourceBytes: 4096,
  sourceCodecs: ['aac'],
  timings: {
    downloadMs: 10,
    probeMs: 5,
    transcodeMs: 100,
    posterMs: 0,
    peaksMs: 20,
    uploadMs: 30,
    totalMs: 165,
  },
  processedAt: new Date(0).toISOString(),
};

const FAILED: MediaFailure = {
  status: 'failed',
  error: 'audio moment is 400.0s — the limit is 180s',
  processedAt: new Date(0).toISOString(),
};

describe('shouldSkipProcessing', () => {
  test('skips when a ready manifest already exists', () => {
    expect(shouldSkipProcessing(READY, false)).toBe(true);
  });

  test('force overrides an existing ready manifest', () => {
    expect(shouldSkipProcessing(READY, true)).toBe(false);
  });

  test('a failed manifest is not proof of completion — retry must redo the work', () => {
    expect(shouldSkipProcessing(FAILED, false)).toBe(false);
    expect(shouldSkipProcessing(FAILED, true)).toBe(false);
  });

  test('no manifest yet (first run) never skips', () => {
    expect(shouldSkipProcessing(null, false)).toBe(false);
    expect(shouldSkipProcessing(null, true)).toBe(false);
  });
});
