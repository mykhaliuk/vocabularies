import { derivedKeys } from './media-key';
import { presignGet } from './storage';
import type { InferSelectModel } from 'drizzle-orm';
import type { entries } from '~/db/schema/entries';
import type { MediaKind, MediaStatus, media } from '~/db/schema/media';
import type { speakers, SpeakerTone } from '~/db/schema/speakers';

type EntryRow = InferSelectModel<typeof entries>;
type MediaRow = InferSelectModel<typeof media>;
type SpeakerRow = InferSelectModel<typeof speakers>;

// Re-exported so client code never has to import `~/db/schema/*` for a type:
// that module pulls drizzle in, and only the `type` keyword keeps it out of
// the browser bundle. Nothing in CI checks that keyword.
export type { MediaKind, MediaStatus };

// Plain projection functions — the exposed API shapes (serialization, not a
// DTO layer; see feedback_no_dto_in_js.md).

const VIEW_TTL_SEC = 3600;

// Who said it, as the feed renders it. Built from the live speaker row when
// the entry's sid still resolves — relation and birthday come only from
// there ("fix it once and every word updates") — and from the entry's
// denormalised name/tone when it does not (removed speaker, legacy import).
// Null means the word is the user's own; the client renders "You".
export interface EntrySpeakerView {
  name: string;
  tone: SpeakerTone | null;
  rel: string | null;
  birthday: string | null;
}

export interface EntryView {
  id: string;
  word: string;
  gloss: string | null;
  speaker: EntrySpeakerView | null;
  // The raw pointer behind `speaker` (VKB-100) — the edit sheet's speaker
  // chip row needs the id to prefill the current selection; the denormalised
  // name/tone above is display-only and cannot drive a chip selection.
  sid: string | null;
  // The day the words were said — the frozen-age anchor (YYYY-MM-DD).
  saidAt: string;
  story: string | null;
  collection: string | null;
  createdAt: string;
}

export interface MediaView {
  mediaId: string;
  kind: MediaKind;
  status: MediaStatus;
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

// The wire shapes, published so the client consumes the same declaration the
// handlers are checked against. The feed flattens media onto each entry while
// the detail screen nests it beside one — the two are not interchangeable.
export interface FeedEntryView extends EntryView {
  media: MediaView | null;
}

export interface FeedResponse {
  entries: FeedEntryView[];
  nextCursor: string | null;
}

export interface EntryDetailResponse {
  entry: EntryView;
  media: MediaView | null;
  playback: MediaPlaybackUrls | null;
}

const toSpeakerOnEntry = (
  entry: EntryRow,
  speaker: SpeakerRow | null,
): EntrySpeakerView | null => {
  if (speaker) {
    return {
      name: speaker.name,
      tone: speaker.tone,
      rel: speaker.rel,
      birthday: speaker.birthday,
    };
  }
  if (entry.speaker) {
    return { name: entry.speaker, tone: entry.tone, rel: null, birthday: null };
  }
  return null;
};

export const toEntryView = (
  entry: EntryRow,
  speaker: SpeakerRow | null,
): EntryView => ({
  id: entry.id,
  word: entry.word,
  gloss: entry.gloss,
  speaker: toSpeakerOnEntry(entry, speaker),
  sid: entry.sid,
  saidAt: entry.saidAt,
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
