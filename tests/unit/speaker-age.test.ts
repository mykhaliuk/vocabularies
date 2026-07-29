import { describe, expect, test } from 'bun:test';
import { isValidIsoDate, speakerAgeAt } from '../../shared/speaker-age';

// The age rule (VKB-97, speaker-spec.html §The age rule): measure the
// birthday against saidAt, never against today. The worked example is the
// spec's own — Mira, born 14 Sep 2024.

describe('speakerAgeAt', () => {
  test('no birthday derives nothing', () => {
    expect(speakerAgeAt(null, '2026-07-20')).toBeNull();
  });

  test('under one month reads newborn', () => {
    expect(speakerAgeAt('2024-09-14', '2024-09-14')).toEqual({
      kind: 'newborn',
    });
    expect(speakerAgeAt('2024-09-14', '2024-10-13')).toEqual({
      kind: 'newborn',
    });
  });

  test('whole months, rounded down, from 1 to 23', () => {
    expect(speakerAgeAt('2024-09-14', '2024-10-14')).toEqual({
      kind: 'months',
      n: 1,
    });
    // The spec's worked rows: 12 mo, 19 mo, 22 mo.
    expect(speakerAgeAt('2024-09-14', '2025-09-20')).toEqual({
      kind: 'months',
      n: 12,
    });
    expect(speakerAgeAt('2024-09-14', '2026-05-10')).toEqual({
      kind: 'months',
      n: 19,
    });
    expect(speakerAgeAt('2024-09-14', '2026-07-20')).toEqual({
      kind: 'months',
      n: 22,
    });
    // The eve of the second birthday is still months, not years.
    expect(speakerAgeAt('2024-09-14', '2026-09-13')).toEqual({
      kind: 'months',
      n: 23,
    });
  });

  test('24 months and over reads whole years, rounded down', () => {
    expect(speakerAgeAt('2024-09-14', '2026-09-14')).toEqual({
      kind: 'years',
      n: 2,
    });
    // The spec's 2031 row: Mira reads 6 y.
    expect(speakerAgeAt('2024-09-14', '2031-07-27')).toEqual({
      kind: 'years',
      n: 6,
    });
    // Adults are opt-in and render plainly.
    expect(speakerAgeAt('1985-03-02', '2026-07-27')).toEqual({
      kind: 'years',
      n: 41,
    });
  });

  test('a birthday after saidAt derives nothing, silently', () => {
    expect(speakerAgeAt('2026-08-01', '2026-07-20')).toBeNull();
  });

  test('garbage dates derive nothing rather than NaN copy', () => {
    expect(speakerAgeAt('not-a-date', '2026-07-20')).toBeNull();
    expect(speakerAgeAt('2024-09-14', 'not-a-date')).toBeNull();
  });

  // V8 normalises an ISO day overflow instead of rejecting it — a birthday
  // of Feb 30th must derive nothing, not the age of March 2nd.
  test('normalised-but-impossible calendar days derive nothing', () => {
    expect(speakerAgeAt('2026-02-30', '2026-07-20')).toBeNull();
    expect(speakerAgeAt('2024-09-14', '2026-02-30')).toBeNull();
  });
});

describe('isValidIsoDate', () => {
  test('accepts a real day, rejects overflow and shape violations', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-2-8')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
  });
});
