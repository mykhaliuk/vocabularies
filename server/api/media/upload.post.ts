import { z } from 'zod';
import { mintUploadSlot } from '~/server/domain/media';
import { requireUser } from '~/server/utils/auth';
import { toHttpError } from '~/server/utils/http-errors';
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_ORIGINAL_BYTES,
} from '~/server/utils/media-key';
import { checkMediaUploadRateLimit } from '~/server/utils/ratelimit';

const Body = z.object({
  contentType: z.enum([...ALLOWED_MEDIA_CONTENT_TYPES] as [
    string,
    ...string[],
  ]),
  sizeBytes: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

// Standalone (entry-less) upload slot — the dev spike page uses this;
// product uploads go through POST /api/entries. Video is a gated
// capability: non-entitled users get 403 + VIDEO_UPLOAD_FORBIDDEN from the
// domain (the single enforcement point), the pipeline itself stays
// role-agnostic.
export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);

  const allowed = await checkMediaUploadRateLimit(user.id);
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'too many uploads' });
  }

  const body = await readValidatedBody(event, (data) => Body.parse(data));

  let minted;
  try {
    minted = await mintUploadSlot(user, body, null);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return minted.slot;
});
