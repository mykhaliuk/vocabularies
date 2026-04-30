import type { Redis } from '@upstash/redis';

export interface RedisLike {
  isNull?: boolean;
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string>;
  incr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
}

export declare const useRedis: () => RedisLike | Redis;
export declare const NULL_PONG_VALUE: string;
