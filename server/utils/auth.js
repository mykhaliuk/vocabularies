import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { sessions } from '~/db/schema/sessions.js';
import { users } from '~/db/schema/users.js';
import { useDb } from './db.js';

const COOKIE_NAME = 'vocabu_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const JWT_ALG = 'HS256';

let cachedSecret = null;

const getSecret = () => {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[auth] JWT_SECRET must be set and at least 32 chars');
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
};

const isSecure = () => (process.env.APP_ENV ?? 'local') !== 'local';

export const normalizeEmail = (raw) =>
  String(raw ?? '')
    .trim()
    .toLowerCase();

export const generateRawToken = () => randomBytes(32).toString('base64url');

export const hashToken = (raw) => createHash('sha256').update(raw).digest();

// Constant-time hash equality for callers that fetch a candidate hash and need
// to compare it against an expected one in memory. The current callback flow
// looks up by hash via a DB unique index (`magic_link_tokens_token_hash_unique`)
// — the lookup IS the comparison, so this helper is unused there. Kept for
// future paths (e.g. token rotation, password-reset) where in-process compare
// is the right shape.
export const safeEqualHashes = (a, b) => {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== 32 || b.length !== 32) return false;
  return timingSafeEqual(a, b);
};

export const toPublicUser = (user) => ({
  email: user.email,
  displayName: user.displayName,
  avatarKey: user.avatarKey,
});

export const signSession = async (sessionId) => {
  const expSec = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(getSecret());
};

export const verifySession = async (jwt) => {
  const { payload } = await jwtVerify(jwt, getSecret(), {
    algorithms: [JWT_ALG],
  });
  if (typeof payload.sid !== 'string') throw new Error('[auth] missing sid');
  return payload.sid;
};

export const setSessionCookie = (event, jwt) => {
  setCookie(event, COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(),
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
};

export const clearSessionCookie = (event) => {
  setCookie(event, COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(),
    path: '/',
    maxAge: 0,
  });
};

export const requireUser = async (event) => {
  const jwt = getCookie(event, COOKIE_NAME);
  if (!jwt)
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' });

  let sessionId;
  try {
    sessionId = await verifySession(jwt);
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'invalid session token',
    });
  }

  const db = useDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'session not found' });
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'session expired' });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'user not found' });
  }

  return { user, session };
};

export const getSessionTtlMs = () => SESSION_TTL_MS;
export const getSessionCookieName = () => COOKIE_NAME;
