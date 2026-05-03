import { sql } from 'drizzle-orm';
import { useDb } from '~/server/utils/db.js';
import { runCheck, sanitize } from '~/server/utils/health-check.js';
import { NULL_PONG_VALUE, useRedis } from '~/server/utils/redis.js';
import { headBucket } from '~/server/utils/storage.js';

export default defineEventHandler(async (event) => {
  const env = process.env.APP_ENV ?? 'local';
  const includeMessage = env === 'local';

  const [db, storage, redis] = await Promise.all([
    runCheck('db', async () => {
      const conn = useDb();
      await conn.execute(sql`select 1`);
      return 'ok';
    }),
    runCheck('storage', async () => {
      await headBucket();
      return 'ok';
    }),
    runCheck('redis', async () => {
      const client = useRedis();
      const result = await client.ping();
      return result === NULL_PONG_VALUE ? 'skipped' : 'ok';
    }),
  ]);

  const redisOk =
    redis.status === 'ok' || (env === 'local' && redis.status === 'skipped');
  const healthy = db.status === 'ok' && storage.status === 'ok' && redisOk;

  setResponseStatus(event, healthy ? 200 : 503);
  setResponseHeader(event, 'Cache-Control', 'no-store');

  return {
    db: sanitize(db, includeMessage),
    storage: sanitize(storage, includeMessage),
    redis: sanitize(redis, includeMessage),
    env,
  };
});
