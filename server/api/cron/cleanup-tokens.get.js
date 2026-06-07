import { lt } from 'drizzle-orm';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens.js';
import { useDb } from '~/server/utils/db.js';

// Daily Vercel Cron (see vercel.json) — delete magic-link tokens past their
// expiry so the table does not accumulate dead rows. Vercel authenticates cron
// invocations with `Authorization: Bearer ${CRON_SECRET}`; reject anything else
// so the endpoint is not publicly triggerable. Outside local, a missing secret
// is a misconfiguration (fail closed) rather than an open endpoint.
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET;
  const stage = process.env.APP_ENV ?? 'local';

  if (secret) {
    const auth = getRequestHeader(event, 'authorization');
    if (auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'unauthorized' });
    }
  } else if (stage !== 'local') {
    throw createError({
      statusCode: 500,
      statusMessage: 'CRON_SECRET not configured',
    });
  }

  const db = useDb();
  const deleted = await db
    .delete(magicLinkTokens)
    .where(lt(magicLinkTokens.expiresAt, new Date()))
    .returning({ id: magicLinkTokens.id });

  console.log(`[cron.cleanup-tokens] removed ${deleted.length} expired tokens`);
  return { ok: true, removed: deleted.length };
});
