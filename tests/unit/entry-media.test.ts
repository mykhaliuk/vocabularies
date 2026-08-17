import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// The swap itself (claimPendingEntry) has no automated coverage — see
// ADR-0009 and VKB-143. These pin the rest: that nothing is retired early.

type Row = Record<string, unknown>;

interface DbCall {
  op: 'select' | 'insert' | 'update' | 'delete';
  values: Row | null;
  targets: string[];
}

// Column objects point back at their table, so the walk needs `seen` —
// otherwise the first `eq()` recurses forever.
const idsIn = (condition: unknown): string[] => {
  const found: string[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      found.push(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    for (const value of Object.values(node)) walk(value);
  };
  walk(condition);
  return found;
};

// A drizzle statement is a promise carrying the builder methods, so the stub
// is one too: every chain method hands back the same promise.
interface Statement extends Promise<Row[]> {
  from: () => Statement;
  leftJoin: () => Statement;
  where: (condition: unknown) => Statement;
  limit: () => Statement;
  returning: () => Statement;
  set: (values: Row) => Statement;
  values: (values: Row) => Statement;
}

// One scripted result per statement, in start order; an Error rejects.
const createFakeDb = (script: (Row[] | Error)[]) => {
  const calls: DbCall[] = [];
  const queue = script.slice();

  const start = (op: DbCall['op']) => {
    const call: DbCall = { op, values: null, targets: [] };
    calls.push(call);
    const next = queue.shift() ?? [];
    const statement = (
      next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
    ) as Statement;
    const self = () => statement;
    statement.from = self;
    statement.leftJoin = self;
    statement.limit = self;
    statement.returning = self;
    statement.where = (condition: unknown) => {
      call.targets = idsIn(condition);
      return statement;
    };
    statement.set = (values: Row) => {
      call.values = values;
      return statement;
    };
    statement.values = (values: Row) => {
      call.values = values;
      return statement;
    };
    return statement;
  };

  const db = {
    select: () => start('select'),
    insert: () => start('insert'),
    update: () => start('update'),
    delete: () => start('delete'),
  };

  return { db, calls };
};

let fake = createFakeDb([]);

// Presigning is a local HMAC: it signs against the endpoint, never dials it,
// so a slot needs no reachable bucket (playwright.authed.config.ts does this
// too). Keeping storage.ts real avoids stubbing a module media-process needs.
process.env.S3_ENDPOINT ??= 'http://s3.invalid';
process.env.S3_MEDIA_ACCESS_KEY_ID ??= 'unit-test-placeholder-media-key';
process.env.S3_MEDIA_SECRET_ACCESS_KEY ??= 'unit-test-placeholder-media-secret';
process.env.S3_ORIGINALS_ACCESS_KEY_ID ??=
  'unit-test-placeholder-originals-key';
process.env.S3_ORIGINALS_SECRET_ACCESS_KEY ??=
  'unit-test-placeholder-originals-secret';
process.env.S3_BUCKET_MEDIA ??= 'unit-test-placeholder-media';
process.env.S3_BUCKET_ORIGINALS ??= 'unit-test-placeholder-originals';
process.env.S3_FORCE_PATH_STYLE ??= 'true';

mock.module('../../server/utils/db', () => ({ useDb: () => fake.db }));
// The queue would otherwise fall back to running the job inline, i.e. ffmpeg.
mock.module('../../server/utils/media-queue', () => ({
  enqueueMediaProcessing: async () => 'inline',
}));

const { attachEntryMedia, removeEntryMedia } =
  await import('../../server/domain/entries');
const { confirmMediaUpload } = await import('../../server/domain/media');

// mock.module is process-global, so undo it before the next file loads.
afterAll(() => {
  mock.restore();
});

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const ENTRY_ID = '22222222-2222-4222-8222-222222222222';
const OLD_MEDIA_ID = 'oldmedia01';
const NEW_MEDIA_ID = 'newmedia01';
const ORIGINAL_KEY = `${OWNER_ID}/${NEW_MEDIA_ID}/original.m4a`;

const user = {
  id: OWNER_ID,
  entitlements: { videoUpload: false, maxUploadBytes: 250_000_000 },
} as never;
const input = { contentType: 'audio/mp4', sizeBytes: 1024 };

const entryRow = (media: Row | null) => [
  { entry: { id: ENTRY_ID, ownerId: OWNER_ID }, speaker: null, media },
];

const oldMedia = { id: OLD_MEDIA_ID, entryId: ENTRY_ID, ownerId: OWNER_ID };

const mediaRow = (overrides: Row = {}) => ({
  id: NEW_MEDIA_ID,
  entryId: null,
  pendingEntryId: null,
  ownerId: OWNER_ID,
  status: 'processing',
  originalKey: ORIGINAL_KEY,
  ...overrides,
});

const ops = () => fake.calls.map((call) => call.op);

beforeEach(() => {
  fake = createFakeDb([]);
});

describe('attachEntryMedia', () => {
  test('records the destination and retires the aims it supersedes', async () => {
    fake = createFakeDb([
      entryRow(oldMedia),
      [mediaRow({ pendingEntryId: ENTRY_ID })],
      [],
    ]);

    const attached = await attachEntryMedia(user, ENTRY_ID, input);

    expect(ops()).toEqual(['select', 'insert', 'update']);
    expect(fake.calls[1]?.values).toMatchObject({
      entryId: null,
      pendingEntryId: ENTRY_ID,
      ownerId: OWNER_ID,
    });
    expect(fake.calls[1]?.values?.id).toBe(attached.upload.mediaId);
  });

  // The incumbent is untouched — retirement still happens at `ready`. Only
  // other PENDING aims are cleared, which is what stops two of them racing
  // (VKB-159).
  test('the detach clears pending aims without touching the bound row', async () => {
    fake = createFakeDb([
      entryRow(oldMedia),
      [mediaRow({ pendingEntryId: ENTRY_ID })],
      [],
    ]);

    await attachEntryMedia(user, ENTRY_ID, input);
    const detach = fake.calls[2];

    expect(detach?.values).toMatchObject({ pendingEntryId: null });
    expect(detach?.targets).toContain(ENTRY_ID);
    expect(detach?.targets).toContain(OWNER_ID);
    // Bounded by the minted row, not by "everything except it": two concurrent
    // attaches that each cleared the others would clear each other and leave
    // the entry with no aim at all.
    expect(detach?.targets).toContain(NEW_MEDIA_ID);
  });

  test('an entry with no moment takes the same statements', async () => {
    fake = createFakeDb([
      entryRow(null),
      [mediaRow({ pendingEntryId: ENTRY_ID })],
      [],
    ]);

    await attachEntryMedia(user, ENTRY_ID, input);

    expect(ops()).toEqual(['select', 'insert', 'update']);
  });

  test('an unknown or unowned entry never mints a slot', async () => {
    fake = createFakeDb([[]]);

    await expect(attachEntryMedia(user, ENTRY_ID, input)).rejects.toMatchObject(
      { code: 'ENTRY_NOT_FOUND' },
    );
    expect(ops()).toEqual(['select']);
  });
});

describe('confirmMediaUpload', () => {
  test('dispatches without touching the entry', async () => {
    fake = createFakeDb([[mediaRow({ pendingEntryId: ENTRY_ID })]]);

    const confirmed = await confirmMediaUpload(
      OWNER_ID,
      NEW_MEDIA_ID,
      ORIGINAL_KEY,
    );

    expect(ops()).toEqual(['select']);
    expect(confirmed.status).toBe('processing');
  });

  test('an already-ready row is a no-op', async () => {
    fake = createFakeDb([[mediaRow({ status: 'ready' })]]);

    const confirmed = await confirmMediaUpload(
      OWNER_ID,
      NEW_MEDIA_ID,
      ORIGINAL_KEY,
    );

    expect(ops()).toEqual(['select']);
    expect(confirmed.status).toBe('ready');
    expect(confirmed.transport).toBeNull();
  });
});

describe('removeEntryMedia', () => {
  test('cancels pending uploads, then deletes the row the entry carries', async () => {
    fake = createFakeDb([entryRow(oldMedia), [], []]);

    await removeEntryMedia(OWNER_ID, ENTRY_ID);

    expect(ops()).toEqual(['select', 'update', 'delete']);
    expect(fake.calls[1]?.values).toMatchObject({ pendingEntryId: null });
    expect(fake.calls[1]?.targets).toContain(ENTRY_ID);
    expect(fake.calls[2]?.targets).toContain(OLD_MEDIA_ID);
  });

  test('cancels pending uploads even with no moment to delete', async () => {
    fake = createFakeDb([entryRow(null), []]);

    await removeEntryMedia(OWNER_ID, ENTRY_ID);

    expect(ops()).toEqual(['select', 'update']);
    expect(fake.calls[1]?.values).toMatchObject({ pendingEntryId: null });
  });

  test('refuses an unknown or unowned entry', async () => {
    fake = createFakeDb([[]]);

    await expect(removeEntryMedia(OWNER_ID, ENTRY_ID)).rejects.toMatchObject({
      code: 'ENTRY_NOT_FOUND',
    });
  });
});
