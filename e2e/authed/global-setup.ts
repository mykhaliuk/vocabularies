import pg from 'pg';

// Schema gate for the authed suite (VKB-101). Migrations are applied outside
// Playwright (`bun run db:migrate` locally, a drizzle-kit step in CI), and a
// database that is merely EMPTY fails in the least useful way possible: the
// server boots fine (the pool is lazy), then every spec dies on an opaque
// 500 from the first query. So assert the tables the harness itself depends on
// before a single test runs, and name the fix in the message.
const REQUIRED_TABLES = ['users', 'sessions', 'magic_link_tokens', 'entries'];

export default async () => {
  const connectionString = process.env.DATABASE_URL;
  // pg waits forever by default, and there is no globalTimeout to catch it: a
  // paused Docker or a filtered port would hang the suite instead of failing.
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      '[authed] cannot reach Postgres at DATABASE_URL — start it with ' +
        `\`bun run infra:up\`. Cause: ${(error as Error).message}`,
    );
  }

  try {
    const { rows } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])`,
      [REQUIRED_TABLES],
    );
    const present = new Set(rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((name) => !present.has(name));
    if (missing.length > 0) {
      throw new Error(
        `[authed] database is missing ${missing.join(', ')} — migrations did ` +
          'not run. Apply them with `bun run db:migrate` (CI runs drizzle-kit ' +
          'migrate as its own step).',
      );
    }
  } finally {
    await client.end();
  }
};
