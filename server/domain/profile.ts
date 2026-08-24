import { eq } from 'drizzle-orm';
import { users } from '~/db/schema/users';
import { useDb } from '~/server/utils/db';

// Projected, not the full row: entitlement columns (plan/grants) stay behind
// their one door (ADR-0012) instead of riding out to transport callers.
const PUBLIC_COLUMNS = {
  email: users.email,
  displayName: users.displayName,
  avatarKey: users.avatarKey,
};

export const updateDisplayName = async (
  userId: string,
  displayName: string,
) => {
  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ displayName })
    .where(eq(users.id, userId))
    .returning(PUBLIC_COLUMNS);
  return updated ?? null;
};

export const confirmAvatarUpload = async (userId: string, key: string) => {
  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ avatarKey: key })
    .where(eq(users.id, userId))
    .returning(PUBLIC_COLUMNS);
  return updated ?? null;
};
