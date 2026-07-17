import { z } from 'zod';
import { requireUser } from '~/server/utils/auth';
import { derivedKeys } from '~/server/utils/media-key';
import { getObject, isNotFoundError, presignGet } from '~/server/utils/storage';
import type { MediaManifest } from '~/server/utils/media-process';

const Query = z.object({
  mediaId: z.string().regex(/^[A-Za-z0-9_-]{10,32}$/),
});

const VIEW_TTL_SEC = 3600;

const readManifest = async (key: string): Promise<MediaManifest | null> => {
  try {
    const response = await getObject(key, 'media');
    const raw = await response.Body?.transformToString();
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { mediaId } = await getValidatedQuery(event, (data) =>
    Query.parse(data),
  );

  const keys = derivedKeys(user.id, mediaId);
  setResponseHeader(event, 'Cache-Control', 'no-store');

  const manifest = await readManifest(keys.manifest);
  if (!manifest) return { status: 'processing' };

  if (manifest.kind === 'video') {
    const [videoUrl, posterUrl] = await Promise.all([
      presignGet(keys.video, VIEW_TTL_SEC),
      presignGet(keys.poster, VIEW_TTL_SEC),
    ]);
    return { status: 'ready', manifest, videoUrl, posterUrl };
  }

  const audioUrl = await presignGet(keys.audio, VIEW_TTL_SEC);
  return { status: 'ready', manifest, audioUrl };
});
