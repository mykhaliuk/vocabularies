import { and, eq, gt, isNotNull, isNull, lt } from 'drizzle-orm';
import { z } from 'zod';
import { sessions } from '~/db/schema/sessions';
import { signinClaims } from '~/db/schema/signin-claims';
import { users } from '~/db/schema/users';
import {
  getSessionTtlMs,
  hashToken,
  setSessionCookie,
  signSession,
  toPublicUser,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { useAuthPollRatelimit } from '~/server/utils/ratelimit';
import { POLL_KEY_PATTERN } from '~/shared/magic-link';

// Cross-jar sign-in poll (VKB-70). An installed standalone PWA cannot receive
// the session cookie from the emailed link (it opens in Safari, a separate
// jar), so it polls here with the poll key it bound at send time. When the
// link click has armed the matching claim, this endpoint claims it exactly
// once and issues the session cookie into the PWA's OWN jar — the request
// originates from the PWA, so setSessionCookie lands in the right place.
//
// Anti-enumeration: every non-success outcome (unknown key, not-yet-armed,
// expired, already-claimed) returns the same `{ status: 'pending' }`. The
// response never touches email or user existence, so it leaks nothing about
// who is registered; a stranger probing random keys cannot tell a real
// pending sign-in from noise. POST (not GET) keeps the bearer poll key out of
// URLs, logs, history and the service-worker cache.
const Body = z.object({
  pollKey: z.string().regex(POLL_KEY_PATTERN),
});

const PENDING = { status: 'pending' } as const;

export default defineEventHandler(async (event) => {
  const raw = await readValidatedBody(event, (data) => Body.parse(data));

  // Per-IP rate limit (defense-in-depth against key enumeration / DoS). Poll
  // keys are 256-bit so guessing is infeasible regardless; this caps a client
  // hammering the endpoint. Fail-open on a limiter outage, matching the rest
  // of the auth surface.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null;
  let retryAfterSec = 0;
  if (ip) {
    try {
      const { success, reset } = await useAuthPollRatelimit().limit(ip);
      if (!success) {
        retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      }
    } catch (error) {
      console.error('[auth.poll] ratelimit failure (failing open)', error);
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
  const sessionExpiresAt = new Date(now.getTime() + getSessionTtlMs());
  const userAgent = getRequestHeader(event, 'user-agent') ?? null;

  let issued: { jwt: string; user: typeof users.$inferSelect } | null;
  try {
    // Claim, mint and sign atomically so any failure rolls the claim back and
    // the next poll can retry. The guarded UPDATE ... RETURNING is the
    // single-use gate: only one concurrent poll can flip claimed_at from null,
    // so the session is issued exactly once even under a double-poll race.
    // Signing rides inside the transaction on purpose: a signing failure
    // (misconfigured JWT_SECRET) must abort before commit rather than burn the
    // claim with no cookie issued, which would strand the PWA forever.
    issued = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(signinClaims)
        .set({ claimedAt: now })
        .where(
          and(
            eq(signinClaims.pollKeyHash, pollKeyHash),
            isNotNull(signinClaims.userId),
            isNull(signinClaims.claimedAt),
            gt(signinClaims.expiresAt, now),
          ),
        )
        .returning({ userId: signinClaims.userId });

      if (!claimed?.userId) return null;

      const [session] = await tx
        .insert(sessions)
        .values({
          userId: claimed.userId,
          expiresAt: sessionExpiresAt,
          userAgent,
          ip,
        })
        .returning({ id: sessions.id });
      if (!session) throw new Error('failed to mint session');

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, claimed.userId))
        .limit(1);
      if (!user) throw new Error('claimed user missing');

      const jwt = await signSession(session.id);
      return { jwt, user };
    });
  } catch (error) {
    console.error('[auth.poll] claim/mint failed', error);
    throw createError({ statusCode: 500, statusMessage: 'sign-in failed' });
  }

  if (!issued) return PENDING;

  // Lazy sweep of expired sessions at the only moment the poll grows the table,
  // mirroring the callback sweep (ADR-0005). Fail-open: hygiene must never
  // abort the sign-in it rides on.
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, now));
  } catch (error) {
    console.error('[auth.poll] session sweep failure (failing open)', error);
  }

  setSessionCookie(event, issued.jwt);
  return { status: 'ready' as const, user: toPublicUser(issued.user) };
});
