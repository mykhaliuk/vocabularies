import { and, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { sessions } from '~/db/schema/sessions';
import { signinClaims } from '~/db/schema/signin-claims';
import { users } from '~/db/schema/users';
import {
  getSessionTtlMs,
  hashToken,
  safeEqualHashes,
  setSessionCookie,
  signSession,
  toPublicUser,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { useAuthConfirmRatelimit } from '~/server/utils/ratelimit';
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
  const db = useDb();
  const now = new Date();

  // The armed, unclaimed, unexpired, unlocked claim for this key — or nothing.
  const [claim] = await db
    .select({ confirmCodeHash: signinClaims.confirmCodeHash })
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

  if (!claim?.confirmCodeHash) return EXPIRED;

  // Constant-time compare. On mismatch, atomically burn one attempt; once the
  // cap is reached the claim stops matching everywhere and the user must
  // request a new link.
  if (!safeEqualHashes(codeHash, claim.confirmCodeHash)) {
    const [bumped] = await db
      .update(signinClaims)
      .set({ confirmAttempts: sql`${signinClaims.confirmAttempts} + 1` })
      .where(
        and(
          eq(signinClaims.pollKeyHash, pollKeyHash),
          isNull(signinClaims.claimedAt),
        ),
      )
      .returning({ attempts: signinClaims.confirmAttempts });
    const attempts = bumped?.attempts ?? CONFIRM_MAX_ATTEMPTS;
    return attempts >= CONFIRM_MAX_ATTEMPTS ? EXPIRED : INVALID;
  }

  // Correct code: claim exactly once + mint the session, atomically, signing
  // inside the transaction so a signing failure rolls the claim back (mirrors
  // the old poll mint). The guarded UPDATE re-checks the code hash so a
  // concurrent re-arm (another link click mid-confirm) cannot let a stale code
  // through, and re-checks claimed_at so the session issues exactly once.
  const sessionExpiresAt = new Date(now.getTime() + getSessionTtlMs());
  const userAgent = getRequestHeader(event, 'user-agent') ?? null;

  let issued: { jwt: string; user: typeof users.$inferSelect } | null;
  try {
    issued = await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(signinClaims)
        .set({ claimedAt: now })
        .where(
          and(
            eq(signinClaims.pollKeyHash, pollKeyHash),
            eq(signinClaims.confirmCodeHash, codeHash),
            isNull(signinClaims.claimedAt),
            isNotNull(signinClaims.userId),
            gt(signinClaims.confirmExpiresAt, now),
            lt(signinClaims.confirmAttempts, CONFIRM_MAX_ATTEMPTS),
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
    console.error('[auth.confirm] claim/mint failed', error);
    throw createError({ statusCode: 500, statusMessage: 'sign-in failed' });
  }

  if (!issued) return EXPIRED;

  // Lazy sweep of expired sessions at the moment the table grows (ADR-0005).
  // Fail-open: hygiene must never abort the sign-in it rides on.
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, now));
  } catch (error) {
    console.error('[auth.confirm] session sweep failure (failing open)', error);
  }

  setSessionCookie(event, issued.jwt);
  return { status: 'ready' as const, user: toPublicUser(issued.user) };
});
