import { z } from 'zod';
import { getOwnEntry } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import {
  toEntryView,
  toMediaPlaybackUrls,
  toMediaView,
} from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';

const Params = z.object({ id: z.string().uuid() });

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { id } = await getValidatedRouterParams(event, (data) =>
    Params.parse(data),
  );

  let found;
  try {
    found = await getOwnEntry(user.id, id);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  const mediaView = found.media ? toMediaView(found.media) : null;
  const playback =
    found.media && found.media.status === 'ready'
      ? await toMediaPlaybackUrls(found.media)
      : null;
  return {
    entry: toEntryView(found.entry, found.speaker),
    media: mediaView,
    playback,
  };
});
