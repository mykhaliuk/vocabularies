import { z } from 'zod';
import { findArmedClaim } from '~/server/domain/auth';
import { hashToken } from '~/server/utils/auth';
import { useAuthPollRatelimit } from '~/server/utils/ratelimit';
import { reportRatelimitFailure } from '~/server/utils/ratelimit-alert';
import { POLL_KEY_PATTERN } from '~/shared/magic-link';

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
      reportRatelimitFailure('auth-poll', error);
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

  const armed = await findArmedClaim(hashToken(raw.pollKey), new Date());
  return armed ? CONFIRM : PENDING;
});
