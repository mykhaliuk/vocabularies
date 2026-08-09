import { and, eq, gt, isNotNull, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { signinClaims } from '~/db/schema/signin-claims';
import { hashToken } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { useAuthPollRatelimit } from '~/server/utils/ratelimit';
import { reportRatelimitFailOpen } from '~/server/utils/ratelimit-alert';
import { CONFIRM_MAX_ATTEMPTS, POLL_KEY_PATTERN } from '~/shared/magic-link';

// Cross-jar sign-in poll (VKB-70). An installed standalone PWA cannot receive
// the session cookie from the emailed link (it opens in Safari, a separate
// jar), so it polls here with the poll key it bound at send time. This endpoint
// only REPORTS state — it never mints a session (that moved to
// /api/auth/confirm behind the confirmation code, which closes the
// session-fixation hole; ADR-0008):
//   - `confirm`  the link was clicked and the claim is armed, awaiting the code
//   - `pending`  everything else (no claim, not clicked yet, expired, locked)
// The code is NEVER included here. The response is keyed only on the poll key,
// never on email/user existence, so it leaks nothing about who is registered;
// a stranger probing random keys cannot tell a real pending sign-in from noise.
// POST (not GET) keeps the bearer poll key out of URLs, logs, history and the
// service-worker cache.
const Body = z.object({
  pollKey: z.string().regex(POLL_KEY_PATTERN),
});

const PENDING = { status: 'pending' } as const;
const CONFIRM = { status: 'confirm' } as const;

export default defineEventHandler(async (event) => {
  const raw = await readValidatedBody(event, (data) => Body.parse(data));

  // Per-IP rate limit (defense-in-depth against key enumeration / DoS). Poll
  // keys are 256-bit so guessing is infeasible regardless; this caps a client
  // hammering the endpoint. Fail-open on a limiter outage, matching the rest
  // of the auth surface.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null;
  if (!ip) {
    console.warn('[auth.poll] could not resolve client IP — skipping limit');
  }
  let retryAfterSec = 0;
  if (ip) {
    try {
      const { success, reset } = await useAuthPollRatelimit().limit(ip);
      if (!success) {
        retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      }
    } catch (error) {
      console.error('[auth.poll] ratelimit failure (failing open)', error);
      reportRatelimitFailOpen('auth-poll', error);
    }
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');

  if (retryAfterSec > 0) {
    setResponseHeader(event, 'Retry-After', retryAfterSec);
    throw createError({
      statusCode: 429,
      statusMessage: 'too many requests',
    });
  }

  const pollKeyHash = hashToken(raw.pollKey);
  const db = useDb();
  const now = new Date();

  // Armed-and-confirmable = clicked (user_id + code set), unclaimed, within the
  // confirm window, and not locked by the attempt cap. Anything else is pending.
  const [armed] = await db
    .select({ id: signinClaims.id })
    .from(signinClaims)
    .where(
      and(
        eq(signinClaims.pollKeyHash, pollKeyHash),
        isNotNull(signinClaims.userId),
        isNotNull(signinClaims.confirmCodeHash),
        isNull(signinClaims.claimedAt),
        gt(signinClaims.confirmExpiresAt, now),
        lt(signinClaims.confirmAttempts, CONFIRM_MAX_ATTEMPTS),
      ),
    )
    .limit(1);

  return armed ? CONFIRM : PENDING;
});
