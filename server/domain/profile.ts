import { eq } from 'drizzle-orm';
import { users } from '~/db/schema/users';
import { useDb } from '~/server/utils/db';

export const updateDisplayName = async (
  userId: string,
  displayName: string,
) => {
  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ displayName })
    .where(eq(users.id, userId))
    .returning();
  return updated ?? null;
};

export const confirmAvatarUpload = async (userId: string, key: string) => {
  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ avatarKey: key })
    .where(eq(users.id, userId))
    .returning();
  return updated ?? null;
};
