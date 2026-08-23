import { updateDisplayName } from '~/server/domain/profile';
import { requireUser, toPublicUser } from '~/server/utils/auth';
import { DisplayNameBody } from '~/server/utils/display-name';

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const patch = await readValidatedBody(event, (data) =>
    DisplayNameBody.parse(data),
  );

  const updated = await updateDisplayName(user.id, patch.displayName);

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'failed to update user',
    });
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return toPublicUser(updated);
});
