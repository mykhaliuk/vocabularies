import { requireUser } from '~/server/utils/auth.js';
import { parseAvatarKey } from '~/server/utils/avatar-key.js';
import { presignGet } from '~/server/utils/storage.js';

const VIEW_TTL_SEC = 3600;

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  if (!user.avatarKey) {
    throw createError({ statusCode: 404, statusMessage: 'no avatar' });
  }

  // Defense-in-depth: even though confirm.post is the only write site, re-validate
  // the stored key matches this user's prefix before signing a GET URL.
  try {
    parseAvatarKey(user.avatarKey, user.id);
  } catch (error) {
    console.error('[me.avatar-url] stored avatarKey failed validation', {
      userId: user.id,
      error,
    });
    throw createError({
      statusCode: 500,
      statusMessage: 'invalid stored avatar key',
    });
  }

  const url = await presignGet(user.avatarKey, VIEW_TTL_SEC);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { url };
});
