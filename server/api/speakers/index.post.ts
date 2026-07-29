import { z } from 'zod';
import { isValidIsoDate } from '~/shared/speaker-age';
import { createSpeaker } from '~/server/domain/speakers';
import { requireUser } from '~/server/utils/auth';
import { toHttpError } from '~/server/utils/http-errors';
import { toSpeakerView } from '~/server/utils/speaker-view';

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  rel: z.string().trim().max(200).optional(),
  // Round-trip validation: V8 normalises a day overflow ('2026-02-30' parses
  // as March 2nd), and Postgres would then 500 on the literal — refuse it as
  // the 400 it really is.
  birthday: z.string().refine(isValidIsoDate).optional(),
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
