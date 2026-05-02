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

const createLimiter = (suffix) => {
  const stage = process.env.APP_ENV ?? 'local';
  const redis = getRedis();

  if (!redis) {
    if (stage !== 'local') {
      throw new Error(
        `[ratelimit] UPSTASH_REDIS_REST_URL/_TOKEN required when APP_ENV=${stage}`,
      );
    }
    console.log(`[ratelimit] driver=null suffix=${suffix} (local only)`);
    return nullLimiter;
  }

  console.log(`[ratelimit] driver=upstash suffix=${suffix}`);
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX, WINDOW),
    prefix: `vocabu:${stage}:rl:magic-link:${suffix}`,
  });
};

export const useEmailRatelimit = () => {
  if (!cachedEmail) cachedEmail = createLimiter('email');
  return cachedEmail;
};

export const useIpRatelimit = () => {
  if (!cachedIp) cachedIp = createLimiter('ip');
  return cachedIp;
};
