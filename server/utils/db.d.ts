import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';

export type Db = NodePgDatabase | NeonDatabase;

export declare const useDb: () => Db;
