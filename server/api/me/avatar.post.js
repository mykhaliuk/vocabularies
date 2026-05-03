import { z } from 'zod';
import {
  ALLOWED_CONTENT_TYPES,
  mintAvatarKey,
} from '~/server/utils/avatar-key.js';
import { requireUser } from '~/server/utils/auth.js';
import { presignPut } from '~/server/utils/storage.js';

const Body = z.object({
  contentType: z.enum([...ALLOWED_CONTENT_TYPES]),
});

const UPLOAD_TTL_SEC = 300;

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { contentType } = await readValidatedBody(event, (data) =>
    Body.parse(data),
  );
  const key = mintAvatarKey(user.id, contentType);
  const uploadUrl = await presignPut(key, contentType, UPLOAD_TTL_SEC);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { uploadUrl, key };
});
