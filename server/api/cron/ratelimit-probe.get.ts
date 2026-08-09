import * as Sentry from '@sentry/nuxt';
import { reportRatelimitFailOpen } from '~/server/utils/ratelimit-alert';
import { useRedis } from '~/server/utils/redis';

// graph-allow-orphan: invoked by Vercel Cron (vercel.json), never by a client

// Liveness probe for the rate-limiter Redis (VKB-78). Runs a real data op —
// an archived Upstash instance may still resolve DNS yet reject commands, so
// a connect/ping proves nothing. Also doubles as a keep-alive write. Failure
// reports to Sentry (same alert tag as the fail-open paths) and returns 503
// so the Vercel Cron invocation is marked failed too.
export default defineEventHandler(async (event) => {
  const stage = process.env.APP_ENV ?? 'local';

  // Outside local, a missing secret is a misconfiguration (fail closed)
  // rather than an open endpoint.
  const secret = process.env.CRON_SECRET;
  if (!secret && stage !== 'local') {
    throw createError({
      statusCode: 500,
      statusMessage: 'cron secret not configured',
    });
  }
  if (secret) {
    const auth = getHeader(event, 'authorization');
    if (auth !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401 });
    }
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');

  const key = `vocabu:${stage}:probe:ratelimit`;
  // Not a bare number: the Upstash client JSON-parses responses, so a
  // numeric string would come back as a number and fail the comparison.
  const value = `probe-${Date.now()}`;
  try {
    // useRedis() throws on missing UPSTASH env — that failure must land in
    // the same alert as a dead instance, so it stays inside the try.
    const redis = useRedis();
    if (redis.isNull) return { probe: 'skipped', env: stage };

    await redis.set(key, value);
    const roundtrip = await redis.get(key);
    await redis.del(key);
    if (roundtrip !== value) {
      throw new Error(
        `[ratelimit-probe] roundtrip mismatch: wrote ${value}, read ${String(roundtrip)}`,
      );
    }
  } catch (error) {
    console.error('[ratelimit-probe] redis data op failed', { error });
    reportRatelimitFailOpen('probe', error);
    // The serverless instance may freeze right after the response; a daily
    // probe can afford to wait for the event to actually leave the process.
    await Sentry.flush(2000).catch(() => false);
    setResponseStatus(event, 503);
    return { probe: 'error', env: stage };
  }

  return { probe: 'ok', env: stage };
});
