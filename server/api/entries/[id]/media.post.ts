import { z } from 'zod';
import { attachEntryMedia } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { toMediaView } from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_ORIGINAL_BYTES,
} from '~/server/utils/media-key';
import { checkMediaUploadRateLimit } from '~/server/utils/ratelimit';

const Params = z.object({ id: z.string().uuid() });

const Body = z.object({
  contentType: z.enum([...ALLOWED_MEDIA_CONTENT_TYPES] as [
    string,
    ...string[],
  ]),
  sizeBytes: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { id } = await getValidatedRouterParams(event, (data) =>
    Params.parse(data),
  );

  // Validated before the limit is spent, as POST /api/entries does: a 400
  // must not charge the cap and answer a later real upload with a 429.
  const body = await readValidatedBody(event, (data) => Body.parse(data));

  const allowed = await checkMediaUploadRateLimit(user.id);
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'too many uploads' });
  }

  let attached;
  try {
    attached = await attachEntryMedia(user, id, body);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseStatus(event, 201);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { media: toMediaView(attached.media), upload: attached.upload };
});
