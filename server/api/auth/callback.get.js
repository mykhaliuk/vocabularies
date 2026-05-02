import { eq, sql } from 'drizzle-orm';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens.js';
import { sessions } from '~/db/schema/sessions.js';
import { users } from '~/db/schema/users.js';
import {
  getSessionTtlMs,
  hashToken,
  setSessionCookie,
  signSession,
} from '~/server/utils/auth.js';
import { useDb } from '~/server/utils/db.js';

const redirect = async (event, location) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return sendRedirect(event, location, 302);
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = typeof query.token === 'string' ? query.token : '';
  if (!token) return redirect(event, '/login?error=token-invalid');

  const tokenHash = hashToken(token);
  const db = useDb();

  const [consumed] = await db
    .delete(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .returning({
      email: magicLinkTokens.email,
      expiresAt: magicLinkTokens.expiresAt,
    });

  if (!consumed) return redirect(event, '/login?error=token-invalid');
  if (consumed.expiresAt.getTime() < Date.now()) {
    return redirect(event, '/login?error=token-expired');
  }

  const userAgent = getRequestHeader(event, 'user-agent') ?? null;
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null;
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

      const [createdSession] = await tx
        .insert(sessions)
        .values({
          userId: user.id,
          expiresAt: sessionExpiresAt,
          userAgent,
          ip,
        })
        .returning();

      return createdSession;
    });

    const jwt = await signSession(session.id);
    setSessionCookie(event, jwt);
  } catch (error) {
    console.error('[auth.callback] sign-in failed', {
      email: consumed.email,
      error,
    });
    return redirect(event, '/login?error=signin-failed');
  }

  return redirect(event, '/me');
});
