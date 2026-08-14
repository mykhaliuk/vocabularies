import { describe, expect, test } from 'bun:test';
import { DisplayNameBody } from '../../server/utils/display-name';
import { DISPLAY_NAME_MAX } from '../../shared/display-name';

describe('DisplayNameBody', () => {
  test('trims before checking emptiness', () => {
    expect(() => DisplayNameBody.parse({ displayName: '   ' })).toThrow();
  });

  test('stores the trimmed value, not the padded one', () => {
    const parsed = DisplayNameBody.parse({ displayName: '  Bob  ' });
    expect(parsed.displayName).toBe('Bob');
  });

  test('accepts a name at the shared limit', () => {
    const name = 'a'.repeat(DISPLAY_NAME_MAX);
    expect(DisplayNameBody.parse({ displayName: name }).displayName).toBe(name);
  });

  test('rejects a name past the shared limit', () => {
    const name = 'a'.repeat(DISPLAY_NAME_MAX + 1);
    expect(() => DisplayNameBody.parse({ displayName: name })).toThrow();
  });

  test('rejects an absent displayName', () => {
    expect(() => DisplayNameBody.parse({})).toThrow();
  });
});
