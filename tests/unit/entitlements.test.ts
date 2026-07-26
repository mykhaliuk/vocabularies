import { describe, expect, test } from 'bun:test';
import { GRANT_RANK, entitlementsOf } from '../../server/utils/entitlements';
import {
  MAX_AUDIO_DURATION_SEC,
  MAX_ORIGINAL_BYTES,
  MAX_VIDEO_DURATION_SEC,
} from '../../server/utils/media-key';
import type { GrantRole, PlanTier } from '../../db/schema/users';

const ALL_TIERS: readonly PlanTier[] = ['free', 'essentials', 'premium'];

const roles = (plan: PlanTier, grants: GrantRole[]) => ({ plan, grants });

describe('entitlementsOf', () => {
  test('a plan states its own contents', () => {
    expect(entitlementsOf(roles('free', []))).toEqual({
      videoUpload: false,
      maxVideoDurationSec: MAX_VIDEO_DURATION_SEC,
      maxAudioDurationSec: MAX_AUDIO_DURATION_SEC,
      maxUploadBytes: MAX_ORIGINAL_BYTES,
    });
    expect(entitlementsOf(roles('essentials', [])).videoUpload).toBe(false);
    expect(entitlementsOf(roles('premium', [])).videoUpload).toBe(true);
  });

  test('a grant overrides the plan', () => {
    expect(entitlementsOf(roles('free', ['vip'])).videoUpload).toBe(true);
    expect(entitlementsOf(roles('free', ['admin'])).videoUpload).toBe(true);
  });

  // The grants column is a Postgres array whose order reflects how values were
  // written, so merging in column order would let two users holding the same
  // grants end up with different entitlements.
  test('the result does not depend on the order of the grants column', () => {
    expect(entitlementsOf(roles('free', ['vip', 'admin']))).toEqual(
      entitlementsOf(roles('free', ['admin', 'vip'])),
    );
  });

  // The Record above enforces that every role HAS a rank, not that the ranks
  // DIFFER, and sort is stable — so a shared rank silently restores the column
  // dependence the previous test forbids, while that test keeps passing for as
  // long as the two grants happen to agree on every field. This is the only
  // guard on the property.
  test('grant ranks are distinct', () => {
    const ranks = Object.values(GRANT_RANK);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  // Pins the direction declaratively. Behaviour cannot express it today: vip
  // and admin agree wherever both set a field, so no merge order is observable.
  test('admin outranks vip', () => {
    expect(GRANT_RANK.admin).toBeGreaterThan(GRANT_RANK.vip);
  });

  // Availability is the boolean; a null limit would be a second encoding of
  // the same fact and the two would drift.
  test('every limit is a number on every tier', () => {
    for (const plan of ALL_TIERS) {
      const entitlements = entitlementsOf(roles(plan, []));
      expect(typeof entitlements.maxVideoDurationSec).toBe('number');
      expect(typeof entitlements.maxAudioDurationSec).toBe('number');
      expect(typeof entitlements.maxUploadBytes).toBe('number');
    }
  });

  // Only reachable through an out-of-band ALTER TYPE on the enum. Spreading a
  // missing plan row would produce a half object whose undefined limits reach
  // the client, which is worse than a 500.
  test('an unknown plan fails loudly instead of yielding a half object', () => {
    expect(() => entitlementsOf(roles('gold' as PlanTier, []))).toThrow(
      /no plan entitlements/,
    );
  });

  // The mirror case fails closed, so it is dropped rather than thrown on.
  test('an unrecognized grant is dropped, not partially applied', () => {
    expect(entitlementsOf(roles('free', ['founder' as GrantRole]))).toEqual(
      entitlementsOf(roles('free', [])),
    );
  });

  test('the returned object is not shared with the plan table', () => {
    const first = entitlementsOf(roles('free', []));
    first.videoUpload = true;
    expect(entitlementsOf(roles('free', [])).videoUpload).toBe(false);
  });

  // The projection is what reaches the client, so a tier or grant name
  // appearing here would be the leak the one-door rule existed to prevent.
  test('exposes no plan or grant value', () => {
    const entitlements = entitlementsOf(roles('premium', ['vip']));
    expect(Object.keys(entitlements)).not.toContain('plan');
    expect(Object.keys(entitlements)).not.toContain('grants');
    expect(JSON.stringify(entitlements)).not.toContain('premium');
  });
});
