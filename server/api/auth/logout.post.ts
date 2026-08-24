import { endSession } from '~/server/domain/auth';
import {
  clearSessionCookie,
  getSessionCookieName,
  verifySession,
} from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const jwt = getCookie(event, getSessionCookieName());

  if (jwt) {
    try {
      const sessionId = await verifySession(jwt);
      await endSession(sessionId);
    } catch {
      // invalid/expired JWT — nothing to delete
    }
  }

  clearSessionCookie(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ok: true };
});
