import { Redis } from '@upstash/redis';

const NULL_PONG = 'PONG_NULL';

const nullRedis = {
  isNull: true,
  ping: async () => NULL_PONG,
  get: async () => null,
  set: async () => 'OK',
  incr: async () => 0,
  del: async () => 0,
};

let cached = null;

const wrap = (client) => ({
  isNull: false,
  ping: (...args) => client.ping(...args),
  get: (...args) => client.get(...args),
  set: (...args) => client.set(...args),
  incr: (...args) => client.incr(...args),
  del: (...args) => client.del(...args),
});

const create = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const stage = process.env.APP_ENV ?? 'local';

  if (!url || !token) {
    if (stage !== 'local') {
      throw new Error(
        `[redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required when APP_ENV=${stage}`,
      );
    }
    console.log('[redis] driver=null (local only)');
    return nullRedis;
  }

  const client = new Redis({ url, token });
  console.log('[redis] driver=upstash');
  return wrap(client);
};

export const useRedis = () => {
  if (!cached) cached = create();
  return cached;
};

export const NULL_PONG_VALUE = NULL_PONG;
