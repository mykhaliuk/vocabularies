import { derivedKeys } from './media-key';
import { presignGet } from './storage';
import type { InferSelectModel } from 'drizzle-orm';
import type { entries } from '~/db/schema/entries';
import type { media } from '~/db/schema/media';

type EntryRow = InferSelectModel<typeof entries>;
type MediaRow = InferSelectModel<typeof media>;

// Plain projection functions — the exposed API shapes (serialization, not a
// DTO layer; see feedback_no_dto_in_js.md).

const VIEW_TTL_SEC = 3600;

export interface EntryView {
  id: string;
  word: string;
  gloss: string | null;
  speaker: string | null;
  story: string | null;
  collection: string | null;
  createdAt: string;
}

export interface MediaView {
  mediaId: string;
  kind: string;
  status: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  error: string | null;
}

export interface MediaPlaybackUrls {
  videoUrl: string | null;
  posterUrl: string | null;
  audioUrl: string | null;
}

export const toEntryView = (entry: EntryRow): EntryView => ({
  id: entry.id,
  word: entry.word,
  gloss: entry.gloss,
  speaker: entry.speaker,
  story: entry.story,
  collection: entry.collection,
  createdAt: entry.createdAt.toISOString(),
});

export const toMediaView = (row: MediaRow): MediaView => ({
  mediaId: row.id,
  kind: row.kind,
  status: row.status,
  durationSec: row.durationSec,
  width: row.width,
  height: row.height,
  peaks: row.peaks,
  error: row.error,
});

// Short-lived presigned GET urls for a ready media row. Callers only invoke
// this for status === 'ready'.
export const toMediaPlaybackUrls = async (
  row: MediaRow,
): Promise<MediaPlaybackUrls> => {
  const keys = derivedKeys(row.ownerId, row.id);
  if (row.kind === 'video') {
    const [videoUrl, posterUrl] = await Promise.all([
      presignGet(keys.video, VIEW_TTL_SEC),
      presignGet(keys.poster, VIEW_TTL_SEC),
    ]);
    return { videoUrl, posterUrl, audioUrl: null };
  }
  const audioUrl = await presignGet(keys.audio, VIEW_TTL_SEC);
  return { videoUrl: null, posterUrl: null, audioUrl };
};
