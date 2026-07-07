import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('[drizzle] DATABASE_URL_UNPOOLED is required');

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
