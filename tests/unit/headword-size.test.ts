import { describe, expect, test } from 'bun:test';
import { headwordSizePx } from '../../utils/headword-size';

// The ladder is shared by the feed card and the word detail screen, so its
// steps are pinned here rather than re-read off either screen.
describe('headwordSizePx', () => {
  test('walks the spec ladder, scaled for Caveat', () => {
    // 40 / 33 / 27 / 22 / 19 pre-scale, x1.39, rounded.
    expect(headwordSizePx('a'.repeat(1))).toBe(56);
    expect(headwordSizePx('a'.repeat(13))).toBe(56);
    expect(headwordSizePx('a'.repeat(14))).toBe(46);
    expect(headwordSizePx('a'.repeat(20))).toBe(46);
    expect(headwordSizePx('a'.repeat(21))).toBe(38);
    expect(headwordSizePx('a'.repeat(30))).toBe(38);
    expect(headwordSizePx('a'.repeat(31))).toBe(31);
    expect(headwordSizePx('a'.repeat(44))).toBe(31);
    expect(headwordSizePx('a'.repeat(45))).toBe(26);
    expect(headwordSizePx('a'.repeat(400))).toBe(26);
  });

  test('an empty word still gets the largest step', () => {
    expect(headwordSizePx('')).toBe(56);
  });
});
