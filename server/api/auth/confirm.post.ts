import { z } from 'zod';
import {
  claimAndMintSession,
  consumeConfirmAttempt,
} from '~/server/domain/auth';
import {
  getSessionTtlMs,
  hashToken,
  safeEqualHashes,
  setSessionCookie,
  toPublicUser,
} from '~/server/utils/auth';
import { useAuthConfirmRatelimit } from '~/server/utils/ratelimit';
import { reportRatelimitFailure } from '~/server/utils/ratelimit-alert';
import {
  CONFIRM_CODE_PATTERN,
  CONFIRM_MAX_ATTEMPTS,
  POLL_KEY_PATTERN,
} from '~/shared/magic-link';

// Device-flow confirmation (VKB-70). This is the mint step that used to live in
// poll.post — moved behind the confirmation code to close a session-fixation
// hole: an attacker who chose the poll key and had it armed by an unrelated
// victim's click could otherwise collect the victim's session. Now the session
// is issued ONLY when the code shown on the click page (the victim's Safari) is
// entered on the initiating device. The attacker never sees that page, so
// cannot confirm; the 4-digit code + 3-attempt cap + 5-min window bound brute
// force to at most 3/10000 within the window.
//
// Responses: `ready` (+ session cookie), `invalid` (live claim, wrong code,
// attempts remain — retry), `expired` (no live claim / window closed / locked /
// claimed / lost the claim-once race — request a new link). None reads
// email/user existence, so nothing about who is registered leaks; a random-key
// prober only ever gets `expired`, and `invalid` is reachable only by the
// holder of a genuinely-armed claim.
const Body = z.object({
  pollKey: z.string().regex(POLL_KEY_PATTERN),
  code: z.string().regex(CONFIRM_CODE_PATTERN),
});

const EXPIRED = { status: 'expired' } as const;
const INVALID = { status: 'invalid' } as const;

export default defineEventHandler(async (event) => {
  const raw = await readValidatedBody(event, (data) => Body.parse(data));

  // Per-IP rate limit (DoS defense; the per-claim attempt cap is the real
  // brute-force gate). Fail-open on a limiter outage, like the rest of auth.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null;
  if (!ip) {
    console.warn('[auth.confirm] could not resolve client IP — skipping limit');
  }
  let retryAfterSec = 0;
  if (ip) {
    try {
      const { success, reset } = await useAuthConfirmRatelimit().limit(ip);
      if (!success) {
        retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      }
    } catch (error) {
      console.error('[auth.confirm] ratelimit failure (failing open)', error);
      reportRatelimitFailure('auth-confirm', error);
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
  const codeHash = hashToken(raw.code);
  const now = new Date();

  const attempt = await consumeConfirmAttempt(pollKeyHash, now);

  // No row: unknown key / over cap / expired / already claimed — uniform, no
  // leak (a random-key prober only ever reaches here).
  if (!attempt?.confirmCodeHash) return EXPIRED;

  // Constant-time compare of the returned hash. The attempt is already spent
  // above, so a wrong guess counts toward the cap; when it was the LAST allowed
  // one (post-increment == cap) the claim is now locked → tell the user to
  // request a new link, else let them retry.
  if (!safeEqualHashes(codeHash, attempt.confirmCodeHash)) {
    return attempt.attempts >= CONFIRM_MAX_ATTEMPTS ? EXPIRED : INVALID;
  }

  const sessionExpiresAt = new Date(now.getTime() + getSessionTtlMs());
  const userAgent = getRequestHeader(event, 'user-agent') ?? null;

  let issued: Awaited<ReturnType<typeof claimAndMintSession>>;
  try {
    issued = await claimAndMintSession({
      pollKeyHash,
      codeHash,
      now,
      sessionExpiresAt,
      userAgent,
      ip,
    });
  } catch (error) {
    console.error('[auth.confirm] claim/mint failed', error);
    throw createError({ statusCode: 500, statusMessage: 'sign-in failed' });
  }

  if (!issued) return EXPIRED;

  setSessionCookie(event, issued.jwt);
  return { status: 'ready' as const, user: toPublicUser(issued.user) };
});
