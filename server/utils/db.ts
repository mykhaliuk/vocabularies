import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { Pool as NeonPool } from '@neondatabase/serverless';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

export type Db = NodePgDatabase | NeonDatabase;

let cached: Db | null = null;

const create = (): Db => {
  const driver = process.env.DB_DRIVER ?? 'pg';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('[db] DATABASE_URL is required');

  if (driver === 'neon') {
    const pool = new NeonPool({ connectionString: url });
    pool.on('error', (error) => {
      console.error('[db] neon pool idle-client error:', error);
    });
    console.log('[db] driver=neon');
    return drizzleNeon({ client: pool });
  }

  if (driver !== 'pg') {
    throw new Error(`[db] unknown DB_DRIVER: ${driver} (expected pg|neon)`);
  }

  const pool = new pg.Pool({ connectionString: url });
  pool.on('error', (error) => {
    console.error('[db] pg pool idle-client error:', error);
  });
  console.log('[db] driver=pg');
  return drizzlePg({ client: pool });
};

export const useDb = () => {
  if (!cached) cached = create();
  return cached;
};
