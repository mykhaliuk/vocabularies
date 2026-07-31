import { describe, expect, test } from 'bun:test';
import { EntryPatchBody } from '../../server/utils/entry-patch';

// PATCH /api/entries/:id body (VKB-100, entry-actions-spec §"Edit: what
// moves, what holds"). Every case here is the zod boundary only — the
// domain operation (server/domain/entries.ts) needs a live db and is
// exercised by hand per the PR, not here.

const VALID_UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const PAST_DATE = '2020-01-01';
const FAR_FUTURE_DATE = '2099-12-31';

describe('EntryPatchBody', () => {
  test('accepts a single-field patch, leaving the rest absent', () => {
    const parsed = EntryPatchBody.parse({ word: 'bapple' });
    expect(parsed).toEqual({ word: 'bapple' });
  });

  test('accepts every field together', () => {
    const parsed = EntryPatchBody.parse({
      word: 'bapple',
      gloss: 'apple',
      story: 'said at breakfast',
      saidAt: PAST_DATE,
      sid: VALID_UUID,
    });
    expect(parsed).toEqual({
      word: 'bapple',
      gloss: 'apple',
      story: 'said at breakfast',
      saidAt: PAST_DATE,
      sid: VALID_UUID,
    });
  });

  // sid alone accepts an explicit null: detach the speaker and fall back to
  // "You" — a real instruction, distinct from sid being absent altogether.
  test('accepts an explicit null sid', () => {
    const parsed = EntryPatchBody.parse({ sid: null });
    expect(parsed).toEqual({ sid: null });
  });

  // gloss/story also accept an explicit null as a clear, same as an empty
  // string — the route folds both to the same value before calling the
  // domain, but the zod boundary must not reject either spelling.
  test('accepts an explicit null gloss and story', () => {
    expect(EntryPatchBody.parse({ gloss: null })).toEqual({ gloss: null });
    expect(EntryPatchBody.parse({ story: null })).toEqual({ story: null });
  });

  test('rejects an empty patch', () => {
    expect(() => EntryPatchBody.parse({})).toThrow();
  });

  test('rejects an unknown key', () => {
    expect(() => EntryPatchBody.parse({ collection: 'nursery' })).toThrow();
    expect(() => EntryPatchBody.parse({ id: VALID_UUID })).toThrow();
    expect(() => EntryPatchBody.parse({ media: {} })).toThrow();
  });

  test('rejects a cleared word', () => {
    expect(() => EntryPatchBody.parse({ word: '' })).toThrow();
    expect(() => EntryPatchBody.parse({ word: '   ' })).toThrow();
  });

  test('rejects a malformed sid', () => {
    expect(() => EntryPatchBody.parse({ sid: 'not-a-uuid' })).toThrow();
  });

  test('accepts a past saidAt', () => {
    const parsed = EntryPatchBody.parse({ saidAt: PAST_DATE });
    expect(parsed.saidAt).toBe(PAST_DATE);
  });

  test('rejects a future saidAt', () => {
    expect(() => EntryPatchBody.parse({ saidAt: FAR_FUTURE_DATE })).toThrow();
  });

  // A plain calendar date carries no timezone, and a caller east of UTC (up
  // to UTC+14) can have a local "today" that already reads as tomorrow in
  // UTC — one day of slack keeps that caller's own today from a false 400.
  test('accepts tomorrow (UTC) as one day of timezone slack', () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const saidAt = tomorrow.toISOString().slice(0, 10);
    expect(EntryPatchBody.parse({ saidAt }).saidAt).toBe(saidAt);
  });

  test('rejects the day after tomorrow (UTC)', () => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 2);
    const saidAt = dayAfterTomorrow.toISOString().slice(0, 10);
    expect(() => EntryPatchBody.parse({ saidAt })).toThrow();
  });

  test('rejects a bad date shape', () => {
    expect(() => EntryPatchBody.parse({ saidAt: '2026/07/31' })).toThrow();
    expect(() => EntryPatchBody.parse({ saidAt: '20260731' })).toThrow();
    expect(() => EntryPatchBody.parse({ saidAt: 'not-a-date' })).toThrow();
  });

  // V8 normalises a day overflow instead of rejecting it ('2026-02-30' parses
  // as March 2nd) — the round-trip check in isValidIsoDate must catch it, the
  // same reason the speaker birthday field already refuses it.
  test('rejects a day overflow that round-trips to a different date', () => {
    expect(() => EntryPatchBody.parse({ saidAt: '2026-02-30' })).toThrow();
  });
});
