import { checkDbHealth } from '~/server/domain/health';
import { runCheck, sanitize } from '~/server/utils/health-check';
import { NULL_PONG_VALUE, useRedis } from '~/server/utils/redis';
import { hasOriginalsBucket, headBucket } from '~/server/utils/storage';

export default defineEventHandler(async (event) => {
  const env = process.env.APP_ENV ?? 'local';
  const includeMessage = env === 'local';

  const [db, storage, redis] = await Promise.all([
    checkDbHealth(),
    runCheck('storage', async () => {
      await headBucket('media');
      if (hasOriginalsBucket()) {
        await headBucket('originals');
        return 'ok';
      }
      // Missing originals must be VISIBLE: media upload/confirm will 500
      // on this stage until S3_BUCKET_ORIGINALS is set. Reported as
      // degraded (not error) so pre-media envs keep passing health while
      // the gap still shows up in the payload.
      return env === 'local' ? 'ok' : 'degraded: originals bucket unset';
    }),
    runCheck('redis', async () => {
      const client = useRedis();
      const result = await client.ping();
      return result === NULL_PONG_VALUE ? 'skipped' : 'ok';
    }),
  ]);

  const redisOk =
    redis.status === 'ok' || (env === 'local' && redis.status === 'skipped');
  // Degraded storage (originals bucket not yet configured) is visible in
  // the payload but does not fail health — pre-media envs stay green.
  const storageOk =
    storage.status === 'ok' || storage.status.startsWith('degraded');
  const healthy = db.status === 'ok' && storageOk && redisOk;

  setResponseStatus(event, healthy ? 200 : 503);
  setResponseHeader(event, 'Cache-Control', 'no-store');

  return {
    db: sanitize(db, includeMessage),
    storage: sanitize(storage, includeMessage),
    redis: sanitize(redis, includeMessage),
    env,
  };
});
