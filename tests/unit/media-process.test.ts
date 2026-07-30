import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type {
  MediaFailure,
  MediaManifest,
} from '../../server/utils/media-process';

// The idempotency guard (VKB-81): a 'ready' manifest already found in R2
// proves the ffmpeg run and derivative uploads durably happened, so a
// redelivered/retried job can skip straight to returning it instead of
// re-transcoding. force is the deliberate-reprocess opt-out, applied at
// the processMedia call site rather than folded into the pure predicate —
// a force=true result must never claim "this IS a ready manifest" to the
// type system (see isReadyManifest's own comment in media-process.ts).

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

// --- storage mock, installed before media-process.ts (and therefore
// storage.ts) is ever imported by this process, so media-process.ts binds
// to the mock rather than the real R2 client. Each test reconfigures
// `getObjectImpl`/`callLog` instead of re-mocking the module. ---

interface RecordedCall {
  key: string;
  kind: string;
}

const callLog: RecordedCall[] = [];
let getObjectImpl: (key: string, kind: string) => unknown = () => {
  throw new Error('getObjectImpl not configured for this test');
};

const notFoundError = () => {
  const error = new Error('not found');
  error.name = 'NotFound';
  return error;
};

const bodyWith = (raw: string) => ({
  Body: { transformToString: async () => raw },
});

mock.module('../../server/utils/storage', () => ({
  getObject: async (key: string, kind: string) => {
    callLog.push({ key, kind });
    return getObjectImpl(key, kind);
  },
  isNotFoundError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    (error as Error).name === 'NotFound',
  putFile: async () => {},
  putObject: async () => {},
}));

const { processMedia, isReadyManifest } =
  await import('../../server/utils/media-process');

const USER_ID = 'user-vkb81';
const RAW_KEY = `${USER_ID}/aaaaaaaaaa/original.m4a`;
const PIPELINE_ENTERED = 'PIPELINE_ENTERED_PROBE';

beforeEach(() => {
  callLog.length = 0;
});

describe('isReadyManifest', () => {
  test('a ready manifest with a valid kind and duration is ready', () => {
    expect(isReadyManifest(READY)).toBe(true);
  });

  test('a failed manifest is not ready — a retry must redo the work', () => {
    expect(isReadyManifest(FAILED)).toBe(false);
  });

  test('no manifest yet (first run) is not ready', () => {
    expect(isReadyManifest(null)).toBe(false);
  });

  test('a ready status with a non-numeric duration is not trusted', () => {
    expect(
      isReadyManifest({ ...READY, durationSec: '12.5' as unknown as number }),
    ).toBe(false);
  });

  test('a ready status with an unrecognized kind is not trusted', () => {
    expect(
      isReadyManifest({ ...READY, kind: 'image' as unknown as 'audio' }),
    ).toBe(false);
  });
});

describe('processMedia ready-manifest guard', () => {
  test('no manifest yet (NotFound) proceeds to the pipeline', async () => {
    getObjectImpl = (_key, kind) => {
      if (kind === 'media') throw notFoundError();
      throw new Error(PIPELINE_ENTERED);
    };
    await expect(processMedia(RAW_KEY, USER_ID)).rejects.toThrow(
      PIPELINE_ENTERED,
    );
    expect(callLog.some((call) => call.kind === 'originals')).toBe(true);
  });

  test('a transient manifest-read error proceeds to the pipeline', async () => {
    getObjectImpl = (_key, kind) => {
      if (kind === 'media') {
        const error = new Error('internal error');
        error.name = 'InternalError';
        throw error;
      }
      throw new Error(PIPELINE_ENTERED);
    };
    await expect(processMedia(RAW_KEY, USER_ID)).rejects.toThrow(
      PIPELINE_ENTERED,
    );
    expect(callLog.some((call) => call.kind === 'originals')).toBe(true);
  });

  test('a malformed manifest body proceeds to the pipeline', async () => {
    getObjectImpl = (_key, kind) => {
      if (kind === 'media') return bodyWith('{not json');
      throw new Error(PIPELINE_ENTERED);
    };
    await expect(processMedia(RAW_KEY, USER_ID)).rejects.toThrow(
      PIPELINE_ENTERED,
    );
    expect(callLog.some((call) => call.kind === 'originals')).toBe(true);
  });

  test('a ready manifest returns early, skipping the pipeline', async () => {
    getObjectImpl = (_key, kind) => {
      if (kind === 'media') return bodyWith(JSON.stringify(READY));
      throw new Error(PIPELINE_ENTERED);
    };
    const result = await processMedia(RAW_KEY, USER_ID);
    expect(result).toEqual({ ...READY, skipped: true });
    expect(callLog.some((call) => call.kind === 'originals')).toBe(false);
  });

  test('force bypasses a ready manifest and re-enters pipeline', async () => {
    getObjectImpl = (_key, kind) => {
      if (kind === 'media') return bodyWith(JSON.stringify(READY));
      throw new Error(PIPELINE_ENTERED);
    };
    await expect(
      processMedia(RAW_KEY, USER_ID, { force: true }),
    ).rejects.toThrow(PIPELINE_ENTERED);
    // force skips the manifest read entirely, so the very first storage
    // call is the pipeline's download — not a check of what force ignores.
    expect(callLog[0]?.kind).toBe('originals');
  });
});
