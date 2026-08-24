import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { mintSigninToken } from '~/server/domain/auth';
import { getAppUrl } from '~/server/utils/app-url';
import {
  generateRawToken,
  hashToken,
  normalizeEmail,
} from '~/server/utils/auth';
import { useEmail } from '~/server/utils/email';
import { checkMagicLinkRateLimits } from '~/server/utils/magic-link-ratelimit';
import { resolveRequestLocale } from '~/server/utils/request-locale';
import {
  MAGIC_LINK_TTL_MINUTES,
  MAGIC_LINK_TTL_MS,
  POLL_KEY_PATTERN,
} from '~/shared/magic-link';

const Body = z.object({
  email: z.string().email().max(254),
  // Optional cross-jar poll key (VKB-70): sent only by an installed standalone
  // PWA. Its hash is bound to the pending sign-in so the PWA can claim the
  // session its own jar, since the emailed link opens in a different browser.
  pollKey: z.string().regex(POLL_KEY_PATTERN).optional(),
});

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
  const pollKeyHash = raw.pollKey ? hashToken(raw.pollKey) : null;
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await mintSigninToken({ email, tokenHash, pollKeyHash, expiresAt });

  const link = `${getAppUrl()}/api/auth/callback?token=${token}`;

  // Locale for the email follows ADR-0004 precedence: explicit vocabu-locale
  // cookie, then Accept-Language, then the default. Resolved here because the
  // request event is only in scope at the send site.
  const locale = resolveRequestLocale(event);

  const mailer = useEmail();
  await mailer.sendMagicLink(email, link, {
    locale,
    expiryMinutes: MAGIC_LINK_TTL_MINUTES,
  });

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ok: true };
});
