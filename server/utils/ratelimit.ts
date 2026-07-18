import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW = '5 m';
const MAX = 5;

export interface RatelimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export interface RatelimitLike {
  limit: (key: string) => Promise<RatelimitResult>;
}

const nullLimiter: RatelimitLike = {
  limit: async () => ({ success: true, remaining: MAX, reset: 0 }),
};

let cachedRedis: Redis | null | undefined;
let cachedEmail: RatelimitLike | undefined;
let cachedIp: RatelimitLike | undefined;
let cachedCallbackIp: RatelimitLike | undefined;
let cachedMediaUpload: RatelimitLike | undefined;

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

interface LimiterOptions {
  max?: number;
  window?: Parameters<typeof Ratelimit.slidingWindow>[1];
}

const createLimiter = (
  bucket: string,
  suffix: string,
  options: LimiterOptions = {},
): RatelimitLike => {
  const { max = MAX, window = WINDOW } = options;
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
    limiter: Ratelimit.slidingWindow(max, window),
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

// Per-user cap on presigned upload slots: generous enough for a burst of
// captured moments, tight enough that a stuck client cannot mint thousands
// of pending originals.
export const useMediaUploadRatelimit = () => {
  if (!cachedMediaUpload) {
    cachedMediaUpload = createLimiter('media-upload', 'user', {
      max: 20,
      window: '10 m',
    });
  }
  return cachedMediaUpload;
};

// Fail-open wrapper matching the magic-link limiter policy: an Upstash
// outage must not turn every upload into a 500 — abuse control is not
// worth an availability hole.
export const checkMediaUploadRateLimit = async (userId: string) => {
  try {
    const verdict = await useMediaUploadRatelimit().limit(userId);
    return verdict.success;
  } catch (error) {
    console.error('[ratelimit] media-upload check failed — failing open', {
      error,
    });
    return true;
  }
};
