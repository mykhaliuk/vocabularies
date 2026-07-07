import { Redis } from '@upstash/redis';

const NULL_PONG = 'PONG_NULL';

// The contract every consumer codes against — both the real Upstash client
// wrapper and the local null driver satisfy it.
export interface RedisLike {
  isNull: boolean;
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
}

const nullRedis: RedisLike = {
  isNull: true,
  ping: async () => NULL_PONG,
  get: async () => null,
  set: async () => 'OK',
  incr: async () => 0,
  del: async () => 0,
};

let cached: RedisLike | null = null;

const wrap = (client: Redis): RedisLike => ({
  isNull: false,
  ping: () => client.ping(),
  get: (key) => client.get<string>(key),
  set: (key, value) => client.set(key, value),
  incr: (key) => client.incr(key),
  del: (key) => client.del(key),
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
