import { z } from 'zod';
import { getOwnMedia } from '~/server/domain/media';
import { requireUser } from '~/server/utils/auth';
import { toMediaPlaybackUrls, toMediaView } from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';
import { MEDIA_ID_PATTERN, derivedKeys } from '~/server/utils/media-key';
import { getObject, isNotFoundError } from '~/server/utils/storage';
import type { MediaManifest } from '~/server/utils/media-process';

const Query = z.object({
  mediaId: z.string().regex(MEDIA_ID_PATTERN),
});

// Diagnostics for the dev spike page (timings, source codecs). Absence is
// tolerated — the db row is the product contract, the manifest is extra.
const readManifest = async (key: string): Promise<MediaManifest | null> => {
  try {
    const response = await getObject(key, 'media');
    const raw = await response.Body?.transformToString();
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.warn('[media.status] manifest read failed', { key, error });
    }
    return null;
  }
};

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { mediaId } = await getValidatedQuery(event, (data) =>
    Query.parse(data),
  );

  setResponseHeader(event, 'Cache-Control', 'no-store');

  let row;
  try {
    row = await getOwnMedia(user.id, mediaId);
  } catch (error) {
    throw toHttpError(error);
  }

  if (row.status === 'failed') {
    return { status: 'failed', error: row.error };
  }
  if (row.status !== 'ready') {
    return { status: 'processing' };
  }

  const keys = derivedKeys(user.id, mediaId);
  const [playback, manifest] = await Promise.all([
    toMediaPlaybackUrls(row),
    readManifest(keys.manifest),
  ]);
  return {
    status: 'ready',
    media: toMediaView(row),
    manifest,
    videoUrl: playback.videoUrl,
    posterUrl: playback.posterUrl,
    audioUrl: playback.audioUrl,
  };
});
