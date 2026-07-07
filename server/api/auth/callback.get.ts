import { eq, sql } from 'drizzle-orm';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens';
import { sessions } from '~/db/schema/sessions';
import { users } from '~/db/schema/users';
import {
  getSessionTtlMs,
  hashToken,
  setSessionCookie,
  signSession,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { useCallbackIpRatelimit } from '~/server/utils/ratelimit';
import { noStoreRedirect } from '~/server/utils/redirect';

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
    });

  if (!consumed) return noStoreRedirect(event, '/login?error=token-invalid');
  if (consumed.expiresAt.getTime() < Date.now()) {
    return noStoreRedirect(event, '/login?error=token-expired');
  }

  const userAgent = getRequestHeader(event, 'user-agent') ?? null;
  const sessionExpiresAt = new Date(Date.now() + getSessionTtlMs());

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
  } catch (error) {
    console.error('[auth.callback] sign-in failed', {
      email: consumed.email,
      error,
    });
    return noStoreRedirect(event, '/login?error=signin-failed');
  }

  return noStoreRedirect(event, '/me');
});
