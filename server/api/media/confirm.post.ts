import { z } from 'zod';
import { requireUser } from '~/server/utils/auth';
import {
  MAX_ORIGINAL_BYTES,
  contentTypeFromOriginalKey,
  parseOriginalKey,
} from '~/server/utils/media-key';
import { enqueueMediaProcessing } from '~/server/utils/media-queue';
import { headObject, isNotFoundError } from '~/server/utils/storage';

const Body = z.object({
  key: z.string(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const body = await readValidatedBody(event, (data) => Body.parse(data));

  let parsed;
  try {
    parsed = parseOriginalKey(body.key, user.id);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid media key' });
  }

  let head;
  try {
    head = await headObject(parsed.key, 'originals');
  } catch (error) {
    if (isNotFoundError(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'original not found',
      });
    }
    console.error('[media.confirm] HeadObject failed', {
      key: parsed.key,
      error,
    });
    throw createError({
      statusCode: 503,
      statusMessage: 'storage unavailable',
    });
  }

  // The presigned signature already pins Content-Type and Content-Length;
  // re-checking here guards against presign-flow drift, not the client.
  const expectedContentType = contentTypeFromOriginalKey(parsed.key);
  if (head.ContentType !== expectedContentType) {
    throw createError({
      statusCode: 400,
      statusMessage: 'content type mismatch',
    });
  }
  const sizeBytes = Number(head.ContentLength ?? 0);
  if (sizeBytes === 0 || sizeBytes > MAX_ORIGINAL_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'size out of range' });
  }

  const transport = await enqueueMediaProcessing(parsed.key, user.id);

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { mediaId: parsed.mediaId, status: 'processing', transport };
});
