import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { isNotFoundError as realIsNotFoundError } from '../../server/utils/storage';
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
// `getObjectImpl`/`callLog` instead of re-mocking the module. isNotFoundError
// is NOT faked — the real classifier (captured above, before the mock
// replaces the module) is re-exported as-is, so the fixtures below must be
// shaped like genuine AWS SDK errors for it to classify correctly; this
// exercises the classifier, not just the branch wiring around it. ---

interface RecordedCall {
  key: string;
  kind: string;
}

const callLog: RecordedCall[] = [];
let getObjectImpl: (key: string, kind: string) => unknown = () => {
  throw new Error('getObjectImpl not configured for this test');
};

// Real R2/S3 shape for a missing key: NoSuchKey with a 404 in $metadata —
// NOT `name: 'NotFound'`, which would trivially satisfy a naive fake
// classifier without exercising the $metadata.httpStatusCode branch the
// real isNotFoundError actually relies on for this case.
const notFoundError = () => {
  const error = new Error('The specified key does not exist.');
  error.name = 'NoSuchKey';
  Object.assign(error, { $metadata: { httpStatusCode: 404 } });
  return error;
};

const transientError = () => {
  const error = new Error('We encountered an internal error.');
  error.name = 'InternalError';
  Object.assign(error, { $metadata: { httpStatusCode: 500 } });
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
  isNotFoundError: realIsNotFoundError,
  putFile: async () => {},
  putObject: async () => {},
}));

const { processMedia, isReadyManifest, tagProcessResult } =
  await import('../../server/utils/media-process');

const USER_ID = 'user-vkb81';
const RAW_KEY = `${USER_ID}/aaaaaaaaaa/original.m4a`;
const PIPELINE_ENTERED = 'PIPELINE_ENTERED_PROBE';

beforeEach(() => {
  callLog.length = 0;
});

// The storage mock above is process-global (bun's mock.module is not
// scoped to this file), so it is undone once this file's tests are done —
// leaving it in place would silently mock storage.ts for whatever test
// file bun schedules next in the same run.
afterAll(() => {
  mock.restore();
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

describe('tagProcessResult', () => {
  // processMedia's own real-run return statement is out of reach without
  // stubbing the whole ffmpeg pipeline (disproportionate for pinning down
  // one literal) — every processMedia test below ends in a thrown
  // PIPELINE_ENTERED sentinel, so it never observes a real run's `return
  // tagProcessResult(manifest, false)`. This is the cheap seam instead:
  // both of processMedia's return sites route through this one function,
  // so a `skipped` typo at either call site has nowhere to hide from it.
  test('tags a real run as not skipped', () => {
    expect(tagProcessResult(READY, false)).toEqual({
      ...READY,
      skipped: false,
    });
  });

  test('tags a guard short-circuit as skipped', () => {
    expect(tagProcessResult(READY, true)).toEqual({
      ...READY,
      skipped: true,
    });
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
      if (kind === 'media') throw transientError();
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
