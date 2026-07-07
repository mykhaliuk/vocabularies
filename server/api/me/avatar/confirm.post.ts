import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '~/db/schema/users';
import { requireUser, toPublicUser } from '~/server/utils/auth';
import { contentTypeFromKey, parseAvatarKey } from '~/server/utils/avatar-key';
import { useDb } from '~/server/utils/db';
import { headObject, isNotFoundError } from '~/server/utils/storage';

const Body = z.object({
  key: z.string(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const body = await readValidatedBody(event, (data) => Body.parse(data));

  let key;
  try {
    key = parseAvatarKey(body.key, user.id);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid avatar key' });
  }

  let head;
  try {
    head = await headObject(key);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'avatar object not found',
      });
    }
    console.error('[me.avatar.confirm] HeadObject failed', { key, error });
    throw createError({
      statusCode: 503,
      statusMessage: 'storage unavailable',
    });
  }

  const expectedContentType = contentTypeFromKey(key);
  if (head.ContentType !== expectedContentType) {
    console.error('[me.avatar.confirm] content-type mismatch', {
      key,
      expected: expectedContentType,
      got: head.ContentType,
    });
    throw createError({
      statusCode: 400,
      statusMessage: 'content type mismatch',
    });
  }

  const db = useDb();
  const [updated] = await db
    .update(users)
    .set({ avatarKey: key })
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
