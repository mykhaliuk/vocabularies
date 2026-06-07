import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW = '5 m';
const MAX = 5;

const nullLimiter = {
  limit: async () => ({ success: true, remaining: MAX, reset: 0 }),
};

let cachedRedis;
let cachedEmail;
let cachedIp;
let cachedCallbackIp;

const getRedis = () => {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
};

const createLimiter = (bucket, suffix) => {
  const stage = process.env.APP_ENV ?? 'local';
  const redis = getRedis();

  if (!redis) {
    if (stage !== 'local') {
      throw new Error(
        `[ratelimit] UPSTASH_REDIS_REST_URL/_TOKEN required when APP_ENV=${stage}`,
      );
    }
    console.log(`[ratelimit] driver=null bucket=${bucket}:${suffix} (local)`);
    return nullLimiter;
  }

  console.log(`[ratelimit] driver=upstash bucket=${bucket}:${suffix}`);
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX, WINDOW),
    prefix: `vocabu:${stage}:rl:${bucket}:${suffix}`,
  });
};

export const useEmailRatelimit = () => {
  if (!cachedEmail) cachedEmail = createLimiter('magic-link', 'email');
  return cachedEmail;
};

export const useIpRatelimit = () => {
  if (!cachedIp) cachedIp = createLimiter('magic-link', 'ip');
  return cachedIp;
};

// Separate bucket from magic-link sends: hammering the callback (token
// enumeration / DoS) must not consume a user's link-send allowance, and
// vice versa.
export const useCallbackIpRatelimit = () => {
  if (!cachedCallbackIp) cachedCallbackIp = createLimiter('callback', 'ip');
  return cachedCallbackIp;
};
