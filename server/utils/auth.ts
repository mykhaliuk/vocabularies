import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { resolveSession } from '~/server/domain/auth';
import { DOMAIN_ERROR_CODES, DomainError } from '~/server/domain/errors';
import { SESSION_TTL_MS, verifySession } from './session-jwt';
import type { H3Event } from 'h3';
import type { Entitlements } from './entitlements';

// The authenticated caller as the rest of the server sees them: identity plus
// already-resolved rights. The `users` row is consumed inside resolveSession
// and never handed out, so no consumer can read a raw tier — the invariant
// lives in this type instead of in a convention (ADR-0012).
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarKey: string | null;
  entitlements: Entitlements;
}

export interface PublicUser {
  email: string;
  displayName: string | null;
  hasAvatar: boolean;
}

// GET /api/me is the one endpoint that also carries the caller's rights
// (VKB-91) — the compose picker branches on them. Sign-in and avatar confirm
// keep returning the plain profile: they have no use for entitlements, and the
// client refetches /api/me anyway.
export interface MeResponse extends PublicUser {
  entitlements: Entitlements;
}

const COOKIE_NAME = 'vocabu_session';

const isSecure = () => (process.env.APP_ENV ?? 'local') !== 'local';

export const normalizeEmail = (raw: string) =>
  String(raw ?? '')
    .trim()
    .toLowerCase();

export const generateRawToken = () => randomBytes(32).toString('base64url');

// Device-flow confirmation code (VKB-70): a uniformly random 4-digit code,
// zero-padded. randomInt is rejection-sampled and unbiased over [0, 10000).
export const generateConfirmCode = () =>
  String(randomInt(0, 10000)).padStart(4, '0');

export const hashToken = (raw: string) =>
  createHash('sha256').update(raw).digest();

// Constant-time hash equality for callers that fetch a candidate hash and need
// to compare it against an expected one in memory. The magic-link callback
// looks up by hash via a DB unique index (the lookup IS the comparison), so it
// does not need this — but the confirmation-code flow does (VKB-70):
// `confirm.post` reads the stored code hash, then compares the submitted code's
// hash here without timing leaks.
export const safeEqualHashes = (a: Buffer, b: Buffer) => {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
  if (a.length !== 32 || b.length !== 32) return false;
  return timingSafeEqual(a, b);
};

export const toPublicUser = (
  user: Pick<AuthUser, 'email' | 'displayName' | 'avatarKey'>,
): PublicUser => ({
  email: user.email,
  displayName: user.displayName,
  hasAvatar: Boolean(user.avatarKey),
});

export const setSessionCookie = (event: H3Event, jwt: string) => {
  setCookie(event, COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(),
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
};

export const clearSessionCookie = (event: H3Event) => {
  setCookie(event, COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure(),
    path: '/',
    maxAge: 0,
  });
};

const SESSION_401_MESSAGES: Record<string, string> = {
  [DOMAIN_ERROR_CODES.sessionNotFound]: 'session not found',
  [DOMAIN_ERROR_CODES.sessionExpired]: 'session expired',
  [DOMAIN_ERROR_CODES.userNotFound]: 'user not found',
};

// Transport-facing guard: cookie → JWT verify → domain resolution → 401
// mapping. No db access here (ADR-0010).
export const requireUser = async (event: H3Event) => {
  const jwt = getCookie(event, COOKIE_NAME);
  if (!jwt)
    throw createError({ statusCode: 401, statusMessage: 'unauthenticated' });

  let sessionId: string;
  try {
    sessionId = await verifySession(jwt);
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'invalid session token',
    });
  }

  try {
    return await resolveSession(sessionId);
  } catch (error) {
    if (error instanceof DomainError) {
      const statusMessage = SESSION_401_MESSAGES[error.code];
      if (statusMessage) throw createError({ statusCode: 401, statusMessage });
    }
    throw error;
  }
};

export const getSessionTtlMs = () => SESSION_TTL_MS;
export const getSessionCookieName = () => COOKIE_NAME;
