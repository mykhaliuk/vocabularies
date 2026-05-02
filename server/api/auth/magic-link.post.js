import { z } from 'zod';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens.js';
import {
  generateRawToken,
  hashToken,
  normalizeEmail,
} from '~/server/utils/auth.js';
import { useDb } from '~/server/utils/db.js';
import { useEmail } from '~/server/utils/email.js';

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

export default defineEventHandler(async (event) => {
  const raw = await readValidatedBody(event, (data) => Body.parse(data));
  const email = normalizeEmail(raw.email);

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
