import { describe, expect, test } from 'bun:test';
import { DOMAIN_ERROR_CODES, DomainError } from '../../server/domain/errors';
import { toHttpError } from '../../server/utils/http-errors';
import { isEntryMomentConflict } from '../../server/utils/pg-errors';

// Shape of a node-postgres error for the partial unique index added in
// migration 0007. Built here rather than mocked loosely, because the two
// fields below are the whole contract — matching on the message instead
// would break the day Postgres rewords it, and break silently.
const pgConflict = (overrides: Record<string, unknown> = {}) =>
  Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint: 'media_entry_id_unique',
    ...overrides,
  });

describe('isEntryMomentConflict', () => {
  test('recognises the one-moment-per-entry violation', () => {
    expect(isEntryMomentConflict(pgConflict())).toBe(true);
  });

  test('a different unique index is not this conflict', () => {
    expect(
      isEntryMomentConflict(pgConflict({ constraint: 'users_email_unique' })),
    ).toBe(false);
  });

  test('a different Postgres error on the same index is not this conflict', () => {
    expect(isEntryMomentConflict(pgConflict({ code: '23503' }))).toBe(false);
  });

  test('the message alone proves nothing', () => {
    const worded = new Error(
      'duplicate key value violates unique constraint "media_entry_id_unique"',
    );
    expect(isEntryMomentConflict(worded)).toBe(false);
  });

  test('non-errors are not conflicts', () => {
    expect(isEntryMomentConflict(null)).toBe(false);
    expect(isEntryMomentConflict({ code: '23505' })).toBe(false);
  });
});

// `createError` is a Nitro auto-import; outside the server runtime it has to
// be supplied. Kept to the shape the mapping actually reads back.
(globalThis as { createError?: unknown }).createError = (input: unknown) =>
  Object.assign(new Error('http'), input);

describe('transport mapping', () => {
  test('the conflict becomes a 409 carrying its code', () => {
    const mapped = toHttpError(
      new DomainError(DOMAIN_ERROR_CODES.entryMomentConflict, 'already taken'),
    ) as { statusCode: number; data: { code: string } };

    expect(mapped.statusCode).toBe(409);
    expect(mapped.data.code).toBe(DOMAIN_ERROR_CODES.entryMomentConflict);
  });

  // Only a DomainError is translated. A driver error passes through
  // untouched, so Nitro turns it into a 500 with nothing leaked — the
  // constraint name is ours to know, not the client's.
  test('a raw Postgres error is NOT mapped', () => {
    const raw = pgConflict();
    expect(toHttpError(raw)).toBe(raw);
  });
});
