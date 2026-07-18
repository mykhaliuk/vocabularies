import { z } from 'zod';
import { requireUser } from '~/server/utils/auth';
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_ORIGINAL_BYTES,
  mintMediaId,
  mintOriginalKey,
} from '~/server/utils/media-key';
import { checkMediaUploadRateLimit } from '~/server/utils/ratelimit';
import { presignPut } from '~/server/utils/storage';

const Body = z.object({
  contentType: z.enum([...ALLOWED_MEDIA_CONTENT_TYPES] as [
    string,
    ...string[],
  ]),
  sizeBytes: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

const UPLOAD_TTL_SEC = 600;

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);

  const allowed = await checkMediaUploadRateLimit(user.id);
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'too many uploads' });
  }

  const { contentType, sizeBytes } = await readValidatedBody(event, (data) =>
    Body.parse(data),
  );

  const mediaId = mintMediaId();
  const key = mintOriginalKey(user.id, mediaId, contentType);
  // Content-Length is part of the signature: the client can upload exactly
  // the size it declared, nothing bigger.
  let uploadUrl;
  try {
    uploadUrl = await presignPut(key, contentType, {
      kind: 'originals',
      ttlSec: UPLOAD_TTL_SEC,
      contentLength: sizeBytes,
    });
  } catch (error) {
    // Missing originals bucket / bad creds is an availability problem,
    // not a client error — surface it as 503 like media/confirm does.
    console.error('[media.upload] presign failed', { key, error });
    throw createError({
      statusCode: 503,
      statusMessage: 'storage unavailable',
    });
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { mediaId, key, uploadUrl, maxBytes: MAX_ORIGINAL_BYTES };
});
