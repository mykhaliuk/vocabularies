import { describe, expect, test } from 'bun:test';
import {
  EntryPatchBody,
  notInFuture,
  toEntryPatch,
} from '../../server/utils/entry-patch';

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

// notInFuture takes an injectable reference date so these tests can pin the
// one-day slack and the `<=` boundary against a fixed instant, instead of
// recomputing "tomorrow" with the implementation's own formula — that would
// only prove the two agree, and could never fail whatever it computed.
//
// What these tests do NOT catch: a regression to local-time math
// (setDate/getDate in place of setUTCDate/getUTCDate). "Add one day holding
// local wall-clock time fixed" and "add one day holding UTC time fixed"
// resolve to the same instant unless a DST transition falls inside that
// 24-hour window — true here, on any runner, since the reference date above
// is nowhere near one. Catching that class would need `process.env.TZ`
// manipulation around a DST edge, which is deliberately not worth the
// fragility.
describe('notInFuture', () => {
  const REFERENCE_NOW = new Date('2026-07-31T23:00:00Z');

  test('accepts UTC tomorrow (a caller east of UTC sees this as today)', () => {
    expect(notInFuture('2026-08-01', REFERENCE_NOW)).toBe(true);
  });

  test('accepts UTC today itself', () => {
    expect(notInFuture('2026-07-31', REFERENCE_NOW)).toBe(true);
  });

  test('rejects the day after UTC tomorrow', () => {
    expect(notInFuture('2026-08-02', REFERENCE_NOW)).toBe(false);
  });
});

// The body → domain EntryPatch mapping (VKB-100 review): this is where the
// absent-vs-null contract actually lives, and it was previously untested —
// every EntryPatchBody test above exercises only the zod schema, none of
// them would catch a regression in this mapping (e.g. `if (body.sid)` in
// place of `if ('sid' in body)`, which silently stops clearing the speaker).
describe('toEntryPatch', () => {
  test('sid absent from the body stays absent from the patch', () => {
    const patch = toEntryPatch({ word: 'bapple' });
    expect('sid' in patch).toBe(false);
  });

  test('sid: null becomes an explicit null — detach the speaker', () => {
    expect(toEntryPatch({ sid: null })).toEqual({ sid: null });
  });

  test('gloss: "" clears to null', () => {
    expect(toEntryPatch({ gloss: '' })).toEqual({ gloss: null });
  });

  test('gloss: null clears to null', () => {
    expect(toEntryPatch({ gloss: null })).toEqual({ gloss: null });
  });
});
