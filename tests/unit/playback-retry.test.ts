import { describe, expect, test } from 'bun:test';
import { createRefreshAllowance } from '../../utils/playback-retry';

// The bound that stops a permanently unplayable object from looping the feed
// players (VKB-182). e2e/authed/playback-retry.spec.ts pins that a player is
// actually wired to it; this pins the rule itself.
describe('createRefreshAllowance', () => {
  test('an attempt may refresh once', () => {
    const allowance = createRefreshAllowance();
    expect(allowance.spend()).toBe(true);
  });

  test('a second refresh in the same attempt is refused', () => {
    const allowance = createRefreshAllowance();
    allowance.spend();
    expect(allowance.spend()).toBe(false);
  });

  test('every further failure stays refused, so nothing loops', () => {
    const allowance = createRefreshAllowance();
    allowance.spend();
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(allowance.spend()).toBe(false);
    }
  });

  test('restoring opens exactly one more refresh', () => {
    const allowance = createRefreshAllowance();
    allowance.spend();
    allowance.restore();
    expect(allowance.spend()).toBe(true);
    expect(allowance.spend()).toBe(false);
  });

  test('restores do not accumulate into a bank of refreshes', () => {
    const allowance = createRefreshAllowance();
    allowance.restore();
    allowance.restore();
    allowance.restore();
    expect(allowance.spend()).toBe(true);
    expect(allowance.spend()).toBe(false);
  });
});
