import { eq } from 'drizzle-orm';
import { users } from '~/db/schema/users';
import { requireUser, toPublicUser } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { DisplayNameBody } from '~/server/utils/display-name';

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const patch = await readValidatedBody(event, (data) =>
    DisplayNameBody.parse(data),
  );

  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ displayName: patch.displayName })
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
