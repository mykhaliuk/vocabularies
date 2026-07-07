import { eq } from 'drizzle-orm';
import { sessions } from '~/db/schema/sessions';
import {
  clearSessionCookie,
  getSessionCookieName,
  verifySession,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  const jwt = getCookie(event, getSessionCookieName());

  if (jwt) {
    try {
      const sessionId = await verifySession(jwt);
      const db = useDb();
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    } catch {
      // invalid/expired JWT — nothing to delete
    }
  }

  clearSessionCookie(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ok: true };
});
