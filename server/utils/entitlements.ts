import {
  MAX_AUDIO_DURATION_SEC,
  MAX_ORIGINAL_BYTES,
  MAX_VIDEO_DURATION_SEC,
} from './media-key';
import type { InferSelectModel } from 'drizzle-orm';
import type { GrantRole, PlanTier, users } from '~/db/schema/users';

// What a plan includes, stated as data (VKB-91 / ADR-0012). The direction
// matters: a table keyed by tier answers "what does premium include" from one
// place — the question the compose picker, a future pricing screen, and every
// limit tweak actually ask. The earlier capability→roles map answered only the
// inverse ("who has X") and could not produce a plan's contents at all.
//
// Booleans are features, numbers are limits. `videoUpload` is the ONLY per-plan
// fact today; the three numbers are pipeline caps that apply to everyone and
// are republished here so the client reads them from one authoritative place.
// They are deliberately not nullable: availability is carried by the boolean,
// so a null would be a second encoding of the same fact. A cap is meaningless
// while its feature is off — consumers branch on the boolean first.
export interface Entitlements {
  videoUpload: boolean;
  maxVideoDurationSec: number;
  maxAudioDurationSec: number;
  maxUploadBytes: number;
}

const PIPELINE_CAPS = {
  maxVideoDurationSec: MAX_VIDEO_DURATION_SEC,
  maxAudioDurationSec: MAX_AUDIO_DURATION_SEC,
  maxUploadBytes: MAX_ORIGINAL_BYTES,
};

// Record over a FULL Entitlements: adding a tier or a field is a compile error
// here until it is answered for every tier. The type checker replaces review.
const PLANS: Record<PlanTier, Entitlements> = {
  free: { videoUpload: false, ...PIPELINE_CAPS },
  essentials: { videoUpload: false, ...PIPELINE_CAPS },
  premium: { videoUpload: true, ...PIPELINE_CAPS },
};

// Typed as the full shape rather than Partial, on purpose: a new entitlement
// field becomes a compile error right here, so an admin's rights cannot drift
// in EITHER direction without someone deciding. A superuser bypass only
// guaranteed admin never loses a right — it made silently GAINING one (say a
// future deleteAnyAccount) unavoidable.
const ADMIN_ENTITLEMENTS: Entitlements = {
  videoUpload: true,
  ...PIPELINE_CAPS,
};

// Grants override the plan, applied in ascending rank. Rank is declared here
// rather than read from the `grants` column: that column is a Postgres array
// whose order reflects how values were written, so merging in column order
// would let two users holding the same grants resolve differently. An override
// may raise or lower a value; both are visible in this table.
//
// Record over GrantRole rather than an ordered array, for the same reason the
// tables above are Records: an array would let a newly added grant role be
// omitted, and the merge would then drop that grant SILENTLY — a user holding
// it would behave exactly like a user without it. As a Record it is a compile
// error until ranked.
const GRANT_RANK: Record<GrantRole, number> = { vip: 1, admin: 2 };

const GRANTS: Record<GrantRole, Partial<Entitlements>> = {
  vip: { videoUpload: true },
  admin: ADMIN_ENTITLEMENTS,
};

type UserRoles = Pick<InferSelectModel<typeof users>, 'plan' | 'grants'>;

export const entitlementsOf = (user: UserRoles): Entitlements => {
  const plan = PLANS[user.plan];
  // A tier with no row here can only come from an out-of-band ALTER TYPE.
  // Spreading undefined would yield a half object whose maxUploadBytes reaches
  // the client as undefined — neither loud nor safe — so fail loudly instead,
  // the same stance the migration takes on an out-of-range value.
  if (!plan) {
    throw new Error(`[entitlements] no plan entitlements for '${user.plan}'`);
  }
  // An unrecognized grant is dropped rather than thrown on: dropping it adds
  // no rights, so it fails closed.
  const ranked = user.grants
    .filter((role) => role in GRANT_RANK)
    .sort((left, right) => GRANT_RANK[left] - GRANT_RANK[right]);
  return ranked.reduce(
    (entitlements, role) => ({ ...entitlements, ...GRANTS[role] }),
    { ...plan },
  );
};
