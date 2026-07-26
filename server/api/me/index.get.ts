import { requireUser, toPublicUser } from '~/server/utils/auth';
import type { MeResponse } from '~/server/utils/auth';

// requireUser already resolved the caller's rights from the row it loaded, so
// the projection is a field read — no extra query, and no tier to strip.
export default defineEventHandler(async (event): Promise<MeResponse> => {
  const { user } = await requireUser(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ...toPublicUser(user), entitlements: user.entitlements };
});
