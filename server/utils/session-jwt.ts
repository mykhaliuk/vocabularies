import { jwtVerify, SignJWT } from 'jose';

// Session JWT signing/verification, split from utils/auth so the domain can
// sign inside a transaction without a runtime cycle: utils/auth imports the
// domain (requireUser → resolveSession) while the domain imports this leaf.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const JWT_ALG = 'HS256';

let cachedSecret: Uint8Array | null = null;

const getSecret = () => {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('[auth] JWT_SECRET must be set and at least 32 chars');
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
};

export const signSession = async (sessionId: string) => {
  const expSec = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(getSecret());
};

export const verifySession = async (jwt: string) => {
  const { payload } = await jwtVerify(jwt, getSecret(), {
    algorithms: [JWT_ALG],
  });
  if (typeof payload.sid !== 'string') throw new Error('[auth] missing sid');
  return payload.sid;
};
