import { randomUUID } from 'node:crypto';
import { lt } from 'drizzle-orm';
import { z } from 'zod';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens';
import { signinClaims } from '~/db/schema/signin-claims';
import { getAppUrl } from '~/server/utils/app-url';
import {
  generateRawToken,
  hashToken,
  normalizeEmail,
} from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
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

  const db = useDb();

  // Lazy cleanup — an admitted crutch, not a design. Postgres has no native
  // row TTL, and every scheduler we could point at it is worse on our infra
  // (Vercel cron needs a secret + endpoint; pg_cron never fires on Neon's
  // scale-to-zero compute). So expired tokens are swept here, at the only
  // moment the table grows. Correctness never depends on this: the callback
  // checks expiresAt itself. When tokens move to a store with real TTL
  // semantics (Redis SET..EX + GETDEL for single-use), this whole sweep goes
  // straight to the bin — see VKB-53 for the trade-off record. Fail-open: this
  // hygiene delete must never abort an otherwise-viable send (same policy as
  // the sweeps in callback.get / poll.post).
  try {
    await db
      .delete(magicLinkTokens)
      .where(lt(magicLinkTokens.expiresAt, new Date()));
  } catch (error) {
    console.error('[magic-link] token sweep failure (failing open)', error);
  }

  await db
    .insert(magicLinkTokens)
    .values({ email, tokenHash, expiresAt, pollKeyHash });

  // Bind the poll key to a pending claim so the callback can arm it later. Only
  // an installed PWA sends one; the desktop/browser path skips this entirely.
  // Upsert (not insert) so resending a link for the same key extends the claim
  // instead of colliding on the unique poll_key_hash. The sweep of expired
  // claims rides here — the only moment the table grows — mirroring the token
  // sweep above (ADR-0002) and the session sweep in callback.get (ADR-0005),
  if (pollKeyHash) {
    try {
      await db
        .delete(signinClaims)
        .where(lt(signinClaims.expiresAt, new Date()));
    } catch (error) {
      console.error('[magic-link] claim sweep failure (failing open)', error);
    }
    await db
      .insert(signinClaims)
      .values({ pollKeyHash, expiresAt })
      .onConflictDoUpdate({
        target: signinClaims.pollKeyHash,
        set: { expiresAt },
      });
  }

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
