import { sql } from 'drizzle-orm';
import { useDb } from '~/server/utils/db';
import { runCheck } from '~/server/utils/health-check';
import type { CheckResult } from '~/server/utils/health-check';

export const checkDbHealth = (): Promise<CheckResult> =>
  runCheck('db', async () => {
    const db = useDb();
    await db.execute(sql`select 1`);
    return 'ok';
  });
