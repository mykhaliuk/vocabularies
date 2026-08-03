import { describe, expect, test } from 'bun:test';
import { avatarInitial, avatarToneVars } from '../../utils/avatar';

describe('avatarInitial', () => {
  test('takes the first letter, upper-cased', () => {
    expect(avatarInitial('Mira')).toBe('M');
    expect(avatarInitial('mira')).toBe('M');
  });

  test('ignores surrounding whitespace', () => {
    expect(avatarInitial('  Mira ')).toBe('M');
  });

  test('keeps an astral character whole', () => {
    // A surrogate pair: charAt/[0] would return half of it and the disc
    // would render a replacement box.
    expect(avatarInitial('😀 mama')).toBe('😀');
    expect(avatarInitial('𝒜nne')).toBe('𝒜');
  });

  test('an empty or blank name prints nothing', () => {
    expect(avatarInitial('')).toBe('');
    expect(avatarInitial('   ')).toBe('');
  });
});

// Every pair is re-themed for dark — that is the whole reason these are the
// soft tokens and not the --rose-200 / --blue-200 the spec mock draws.
describe('avatarToneVars', () => {
  test('each tone wears its own pair', () => {
    expect(avatarToneVars('rose')).toEqual({
      '--v-avatar-bg': 'var(--primary-soft)',
      '--v-avatar-fg': 'var(--on-primary-soft)',
    });
    expect(avatarToneVars('blue')).toEqual({
      '--v-avatar-bg': 'var(--secondary-soft)',
      '--v-avatar-fg': 'var(--on-secondary-soft)',
    });
    expect(avatarToneVars('ink')).toEqual({
      '--v-avatar-bg': 'var(--surface-sunk)',
      '--v-avatar-fg': 'var(--ink-2)',
    });
  });

  test('no tone falls back to ink, never to a colour', () => {
    expect(avatarToneVars(null)).toEqual(avatarToneVars('ink'));
  });
});
