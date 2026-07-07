import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens';
import { getAppUrl } from '~/server/utils/app-url';
import {
  generateRawToken,
  hashToken,
  normalizeEmail,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { useEmail } from '~/server/utils/email';
import { checkMagicLinkRateLimits } from '~/server/utils/magic-link-ratelimit';

const Body = z.object({
  email: z.string().email().max(254),
});

const TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes

export default defineEventHandler(async (event) => {
  // Body parsing runs before rate limit checks: malformed requests do not
  // consume rate-limit tokens.
  const raw = await readValidatedBody(event, (data) => Body.parse(data));
  const email = normalizeEmail(raw.email);

  const resolvedIp = getRequestIP(event, { xForwardedFor: true });
  if (!resolvedIp) {
    console.warn(
      '[magic-link] could not resolve client IP — bucketing per-request',
      { headers: getRequestHeaders(event) },
    );
  }
  const ip = resolvedIp ?? `unresolved:${randomUUID()}`;

  const { allowed, reset } = await checkMagicLinkRateLimits(email, ip);
  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    setResponseHeader(event, 'Retry-After', retryAfterSec);
    setResponseHeader(event, 'Cache-Control', 'no-store');
    throw createError({
      statusCode: 429,
      statusMessage: 'too many requests',
    });
  }

  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const db = useDb();
  await db.insert(magicLinkTokens).values({ email, tokenHash, expiresAt });

  const link = `${getAppUrl()}/api/auth/callback?token=${token}`;

  const mailer = useEmail();
  await mailer.sendMagicLink(email, link);

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ok: true };
});
