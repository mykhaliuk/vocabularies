// graph-allow-orphan: reached by browser navigation from the emailed
// magic link, never by a client fetch.
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens';
import { sessions } from '~/db/schema/sessions';
import { signinClaims } from '~/db/schema/signin-claims';
import { users } from '~/db/schema/users';
import {
  generateConfirmCode,
  getSessionTtlMs,
  hashToken,
  setSessionCookie,
  signSession,
} from '~/server/utils/auth';
import { renderConfirmPage } from '~/server/utils/confirm-page';
import { useDb } from '~/server/utils/db';
import { useCallbackIpRatelimit } from '~/server/utils/ratelimit';
import { noStoreRedirect } from '~/server/utils/redirect';
import { resolveRequestLocale } from '~/server/utils/request-locale';
import { CONFIRM_TTL_MINUTES, CONFIRM_TTL_MS } from '~/shared/magic-link';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = typeof query.token === 'string' ? query.token : '';
  if (!token) return noStoreRedirect(event, '/login?error=token-invalid');

  // Per-IP rate limit (defense-in-depth against token enumeration / DoS),
  // applied before any DB work. Fail-open on a limiter outage — a Redis hiccup
  // must not lock everyone out of sign-in. Unresolved ip → can't bucket, skip.
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null;
  if (ip) {
    try {
      const { success, reset } = await useCallbackIpRatelimit().limit(ip);
      if (!success) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((reset - Date.now()) / 1000),
        );
        setResponseHeader(event, 'Retry-After', retryAfterSec);
        return noStoreRedirect(event, '/login?error=too-many');
      }
    } catch (error) {
      console.error('[auth.callback] ratelimit failure (failing open)', error);
    }
  }

  const tokenHash = hashToken(token);
  const db = useDb();

  const [consumed] = await db
    .delete(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .returning({
      email: magicLinkTokens.email,
      expiresAt: magicLinkTokens.expiresAt,
      pollKeyHash: magicLinkTokens.pollKeyHash,
    });

  if (!consumed) return noStoreRedirect(event, '/login?error=token-invalid');
  if (consumed.expiresAt.getTime() < Date.now()) {
    return noStoreRedirect(event, '/login?error=token-expired');
  }

  const userAgent = getRequestHeader(event, 'user-agent') ?? null;
  const sessionExpiresAt = new Date(Date.now() + getSessionTtlMs());

  // Lazy sweep of expired sessions at the only moment the table grows,
  // mirroring the token sweep in magic-link.post. Expired rows are inert
  // (requireUser rejects them) but carry ip/user_agent — see ADR-0005.
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  } catch (error) {
    console.error(
      '[auth.callback] session sweep failure (failing open)',
      error,
    );
  }

  let clickerUserId: string | undefined;
  try {
    const session = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${consumed.email}`)
        .limit(1);

      let user = existing;
      if (!user) {
        const [created] = await tx
          .insert(users)
          .values({ email: consumed.email })
          .returning();
        user = created;
      }
      if (!user) throw new Error('failed to upsert user');

      const [createdSession] = await tx
        .insert(sessions)
        .values({
          userId: user.id,
          expiresAt: sessionExpiresAt,
          userAgent,
          ip,
        })
        .returning();

      if (!createdSession) throw new Error('failed to create session');
      return createdSession;
    });

    const jwt = await signSession(session.id);
    setSessionCookie(event, jwt);
    clickerUserId = session.userId;
  } catch (error) {
    console.error('[auth.callback] sign-in failed', {
      email: consumed.email,
      error,
    });
    return noStoreRedirect(event, '/login?error=signin-failed');
  }

  // Cross-jar poll/claim (VKB-70): the clicker is now signed into THIS browser,
  // but an installed PWA that started the sign-in lives in a separate jar. Arm
  // the claim with a fresh confirmation code and reveal it on this page — the
  // PWA cannot receive the session until that code is entered on it. This is
  // what closes the session-fixation hole (ADR-0008): an attacker who holds the
  // poll key never sees this page, so cannot confirm. Re-arm (overwrite) on
  // WHERE claimed_at IS NULL so clicking the latest of several resent links
  // shows a fresh, usable code. Fail-open: the browser sign-in already
  // succeeded, so on any failure fall through to /me — never block it.
  let armedCode: string | undefined;
  if (consumed.pollKeyHash && clickerUserId) {
    // Only the DB arm is fail-open (a failure here must not block the Safari
    // sign-in). Rendering the page is pure and lives OUTSIDE this try, so a
    // render fault can never be mislabeled as an arm failure or silently drop a
    // successfully-armed claim (which would strand the PWA on a codeless code
    // input).
    try {
      const code = generateConfirmCode();
      const confirmExpiresAt = new Date(Date.now() + CONFIRM_TTL_MS);
      const [armed] = await db
        .update(signinClaims)
        .set({
          userId: clickerUserId,
          confirmCodeHash: hashToken(code),
          confirmExpiresAt,
          confirmAttempts: 0,
          // A late click can push confirm_expires_at (click + 5 min) past the
          // outer expires_at (send + 15 min). Extend the outer bound so the
          // GLOBAL claim sweep in magic-link.post (delete WHERE expires_at <
          // now, not scoped to one key) can never delete a claim while its
          // confirm window is still open. greatest() never shortens it.
          expiresAt: sql`greatest(${signinClaims.expiresAt}, ${confirmExpiresAt.toISOString()}::timestamptz)`,
        })
        .where(
          and(
            eq(signinClaims.pollKeyHash, consumed.pollKeyHash),
            isNull(signinClaims.claimedAt),
          ),
        )
        .returning({ id: signinClaims.id });
      if (armed) armedCode = code;
    } catch (error) {
      console.error(
        '[auth.callback] confirm-code arm failed (falling back to /me)',
        error,
      );
    }
  }

  if (armedCode) {
    setResponseHeader(event, 'Cache-Control', 'no-store');
    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');
    return renderConfirmPage({
      locale: resolveRequestLocale(event),
      code: armedCode,
      expiryMinutes: CONFIRM_TTL_MINUTES,
    });
  }

  return noStoreRedirect(event, '/feed');
});
