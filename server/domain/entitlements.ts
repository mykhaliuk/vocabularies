import { eq } from 'drizzle-orm';
import { users } from '~/db/schema/users';
import { useDb } from '~/server/utils/db';
import { entitlementsOf } from '~/server/utils/entitlements';
import type { Entitlements } from '~/server/utils/entitlements';

// The one place that names plan and grants (ADR-0012). Everywhere else holds
// an already-resolved Entitlements object, so there is no raw tier to read by
// accident — the rule is carried by the shape rather than by a convention
// someone has to remember.
//
// requireUser covers every request-bound caller. This exists for the one that
// has no request: the detached media worker, which knows only media.ownerId.
// It resolves at processing time, so a plan that lapsed between the upload and
// the ffmpeg probe changes the outcome — and that outcome stands.
//
// A user that no longer exists gets the free-tier entitlements: the worker's
// post-probe check runs on at-least-once redelivery, and failing closed is the
// right answer for an owner who is gone.
export const loadEntitlements = async (
  userId: string,
): Promise<Entitlements> => {
  const db = useDb();
  const [roles] = await db
    .select({ plan: users.plan, grants: users.grants })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return entitlementsOf(roles ?? { plan: 'free', grants: [] });
};
