// graph-pending: VKB-94 — /me reads displayName but offers no way to
// edit it.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '~/db/schema/users';
import { requireUser, toPublicUser } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';

const Body = z.object({
  displayName: z.string().min(1).max(64).optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const patch = await readValidatedBody(event, (data) => Body.parse(data));

  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ displayName: patch.displayName ?? user.displayName })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'failed to update user',
    });
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return toPublicUser(updated);
});
