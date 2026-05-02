import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens.js';
import {
  generateRawToken,
  hashToken,
  normalizeEmail,
} from '~/server/utils/auth.js';
import { useDb } from '~/server/utils/db.js';
import { useEmail } from '~/server/utils/email.js';
import { useEmailRatelimit, useIpRatelimit } from '~/server/utils/ratelimit.js';

const Body = z.object({
  email: z.string().email().max(254),
});

const TOKEN_TTL_MS = 1000 * 60 * 15; // 15 minutes

const getAppUrl = () => {
  const url = process.env.APP_URL;
  const stage = process.env.APP_ENV ?? 'local';
  if (!url) {
    if (stage !== 'local') {
      throw new Error(`[magic-link] APP_URL is required when APP_ENV=${stage}`);
    }
    return 'http://localhost:3000';
  }
  return url;
};

// Run the two limiter checks in parallel via allSettled so a transient Upstash
// outage on one bucket does not mask the other's verdict, and we know which
// failed when logging. Policy: fail-open on Upstash errors — rate limit is a
// defense, blocking all logins on a Redis hiccup is a worse outcome than
// briefly allowing unmetered traffic. Sentry will surface the error.
const checkRateLimits = async (email, ip) => {
  const results = await Promise.allSettled([
    useEmailRatelimit().limit(email),
    useIpRatelimit().limit(ip),
  ]);

  const [emailSettled, ipSettled] = results;

  if (emailSettled.status === 'rejected' || ipSettled.status === 'rejected') {
    console.error('[magic-link] ratelimit upstream failure (failing open)', {
      emailError:
        emailSettled.status === 'rejected' ? emailSettled.reason : null,
      ipError: ipSettled.status === 'rejected' ? ipSettled.reason : null,
    });
    return { allowed: true, reset: 0 };
  }

  const allowed = emailSettled.value.success && ipSettled.value.success;
  const reset = Math.max(emailSettled.value.reset, ipSettled.value.reset);
  return { allowed, reset };
};

export default defineEventHandler(async (event) => {
  // Body parsing runs before rate limit checks: malformed requests do not
  // consume rate-limit tokens.
  const raw = await readValidatedBody(event, (data) => Body.parse(data));
  const email = normalizeEmail(raw.email);

  const resolvedIp = getRequestIP(event, { xForwardedFor: true });
  if (!resolvedIp) {
    console.warn(
      '[magic-link] could not resolve client IP — bucketing per-request',
      {
        headers: getRequestHeaders(event),
      },
    );
  }
  // Per-request UUID when IP unresolved so unidentified clients don't share a
  // single bucket (which would be both unfair and a bypass vector).
  const ip = resolvedIp ?? `unresolved:${randomUUID()}`;

  const { allowed, reset } = await checkRateLimits(email, ip);
  if (!allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    setResponseHeader(event, 'Retry-After', String(retryAfterSec));
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
