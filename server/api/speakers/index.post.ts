import { z } from 'zod';
import { createSpeaker } from '~/server/domain/speakers';
import { requireUser } from '~/server/utils/auth';
import { toHttpError } from '~/server/utils/http-errors';
import { toSpeakerView } from '~/server/utils/speaker-view';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  rel: z.string().trim().max(200).optional(),
  birthday: z
    .string()
    .regex(DATE_ONLY)
    .refine((value) => !Number.isNaN(new Date(value + 'T00:00:00Z').getTime()))
    .optional(),
});

// Inline creation from the compose sheet ("＋ someone new") — and later the
// people screen's "Add someone", which uses the identical form (VKB-98).
export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const body = await readValidatedBody(event, (data) => Body.parse(data));

  let speaker;
  try {
    speaker = await createSpeaker(user.id, {
      name: body.name,
      rel: body.rel || null,
      birthday: body.birthday || null,
    });
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseStatus(event, 201);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { speaker: toSpeakerView(speaker) };
});
