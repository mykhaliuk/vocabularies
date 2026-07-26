// graph-pending: VKB-67 — the compose sheet creates entries through this.
import { z } from 'zod';
import { createEntry } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { toEntryView, toMediaView } from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_ORIGINAL_BYTES,
} from '~/server/utils/media-key';
import { checkMediaUploadRateLimit } from '~/server/utils/ratelimit';

const MediaDecl = z.object({
  contentType: z.enum([...ALLOWED_MEDIA_CONTENT_TYPES] as [
    string,
    ...string[],
  ]),
  sizeBytes: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

const Body = z.object({
  word: z.string().trim().min(1).max(200),
  gloss: z.string().trim().max(500).optional(),
  speaker: z.string().trim().max(200).optional(),
  story: z.string().trim().max(5000).optional(),
  collection: z.string().trim().max(200).optional(),
  media: MediaDecl.optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const body = await readValidatedBody(event, (data) => Body.parse(data));

  if (body.media) {
    const allowed = await checkMediaUploadRateLimit(user.id);
    if (!allowed) {
      throw createError({ statusCode: 429, statusMessage: 'too many uploads' });
    }
  }

  const input = {
    word: body.word,
    gloss: body.gloss || null,
    speaker: body.speaker || null,
    story: body.story || null,
    collection: body.collection || null,
  };

  let created;
  try {
    created = await createEntry(user, input, body.media ?? null);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseStatus(event, 201);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return {
    entry: toEntryView(created.entry),
    media: created.media ? toMediaView(created.media) : null,
    upload: created.upload,
  };
});
