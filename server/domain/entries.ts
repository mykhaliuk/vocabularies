import { and, desc, eq, sql } from 'drizzle-orm';
import { entries } from '~/db/schema/entries';
import { media } from '~/db/schema/media';
import { speakers } from '~/db/schema/speakers';
import { useDb } from '~/server/utils/db';
import { DOMAIN_ERROR_CODES, DomainError } from './errors';
import { mintUploadSlot } from './media';
import { getOwnSpeaker } from './speakers';
import type { InferSelectModel } from 'drizzle-orm';
import type { AuthUser } from '~/server/utils/auth';
import type { MediaRow, UploadSlot, UploadSlotInput } from './media';
import type { SpeakerRow } from './speakers';

export type EntryRow = InferSelectModel<typeof entries>;

export interface EntryInput {
  word: string;
  gloss: string | null;
  // Attribution is by speaker id (VKB-97); free text is gone. Null means
  // the word is the user's own — rendered as "You", never stored.
  sid: string | null;
  story: string | null;
  collection: string | null;
}

export interface EntryWithMedia {
  entry: EntryRow;
  // The live speaker row when sid still resolves; the view falls back to
  // the entry's denormalised name/tone when it does not.
  speaker: SpeakerRow | null;
  media: MediaRow | null;
}

export interface CreatedEntry extends EntryWithMedia {
  upload: UploadSlot | null;
}

export const createEntry = async (
  user: AuthUser,
  input: EntryInput,
  mediaInput: UploadSlotInput | null,
): Promise<CreatedEntry> => {
  const db = useDb();
  // Ownership gate + denormalised snapshot in one read: the entry keeps the
  // speaker's name/tone so a later removal still renders a name.
  const speaker = input.sid ? await getOwnSpeaker(user.id, input.sid) : null;
  const [entry] = await db
    .insert(entries)
    .values({
      ownerId: user.id,
      word: input.word,
      gloss: input.gloss,
      sid: speaker ? speaker.id : null,
      speaker: speaker ? speaker.name : null,
      tone: speaker ? speaker.tone : null,
      story: input.story,
      collection: input.collection,
    })
    .returning();
  if (!entry) throw new Error('[domain.entries] insert returned no row');

  if (!mediaInput) return { entry, speaker, media: null, upload: null };

  let minted;
  try {
    minted = await mintUploadSlot(user, mediaInput, { entryId: entry.id });
  } catch (error) {
    // No half-created moments: an entry whose upload slot failed to mint
    // (entitlement or storage) must not linger in the feed.
    await db.delete(entries).where(eq(entries.id, entry.id));
    throw error;
  }

  return { entry, speaker, media: minted.row, upload: minted.slot };
};

export interface FeedCursor {
  at: Date;
  id: string;
}

export interface FeedPageOptions {
  limit: number;
  before: FeedCursor | null;
}

// Own feed, newest first, keyset-paginated by (createdAt, id) — the id
// tiebreak keeps pages stable when rows share a timestamp (now() is a
// transaction timestamp). The row comparison matches the DESC sort order.
// One media row per entry in v1; the left joins keep text-only and
// speaker-less entries in the page. The speakers join is live on purpose:
// relation and birthday resolve from the record ("fix it once and every
// word updates"), only name/tone fall back to the denormalised copy.
export const getFeedPage = async (
  ownerId: string,
  options: FeedPageOptions,
): Promise<EntryWithMedia[]> => {
  const db = useDb();
  const conditions = [eq(entries.ownerId, ownerId)];
  if (options.before) {
    conditions.push(
      sql`(${entries.createdAt}, ${entries.id}) < (${options.before.at}::timestamptz, ${options.before.id}::uuid)`,
    );
  }

  const rows = await db
    .select({ entry: entries, speaker: speakers, media })
    .from(entries)
    .leftJoin(
      speakers,
      and(
        eq(speakers.id, entries.sid),
        // Belt and braces: sid is only ever written through getOwnSpeaker,
        // but a private person's rel/birthday must not leak even if a row
        // goes bad — the join refuses a cross-owner speaker outright.
        eq(speakers.ownerId, entries.ownerId),
      ),
    )
    .leftJoin(media, eq(media.entryId, entries.id))
    .where(and(...conditions))
    .orderBy(desc(entries.createdAt), desc(entries.id))
    .limit(options.limit);

  return rows.map(({ entry, speaker, media: mediaRow }) => ({
    entry,
    speaker,
    media: mediaRow,
  }));
};

export const getOwnEntry = async (
  ownerId: string,
  entryId: string,
): Promise<EntryWithMedia> => {
  const db = useDb();
  const [row] = await db
    .select({ entry: entries, speaker: speakers, media })
    .from(entries)
    .leftJoin(
      speakers,
      and(eq(speakers.id, entries.sid), eq(speakers.ownerId, entries.ownerId)),
    )
    .leftJoin(media, eq(media.entryId, entries.id))
    .where(and(eq(entries.id, entryId), eq(entries.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new DomainError(DOMAIN_ERROR_CODES.entryNotFound, 'entry not found');
  }
  return { entry: row.entry, speaker: row.speaker, media: row.media };
};

export interface AttachedMedia {
  media: MediaRow;
  upload: UploadSlot;
}

export const attachEntryMedia = async (
  user: AuthUser,
  entryId: string,
  mediaInput: UploadSlotInput,
): Promise<AttachedMedia> => {
  await getOwnEntry(user.id, entryId);
  const minted = await mintUploadSlot(user, mediaInput, {
    pendingEntryId: entryId,
  });
  return { media: minted.row, upload: minted.slot };
};

const cancelUploadsAimedAt = (ownerId: string, entryId: string) =>
  useDb()
    .update(media)
    .set({ pendingEntryId: null, updatedAt: new Date() })
    .where(and(eq(media.pendingEntryId, entryId), eq(media.ownerId, ownerId)));

export const removeEntryMedia = async (
  ownerId: string,
  entryId: string,
): Promise<void> => {
  const current = await getOwnEntry(ownerId, entryId);
  await cancelUploadsAimedAt(ownerId, entryId);
  if (!current.media) return;
  await useDb()
    .delete(media)
    .where(and(eq(media.id, current.media.id), eq(media.ownerId, ownerId)));
};

// The domain's own shape for a partial update — deliberately NOT derived
// from the transport zod schema (server/utils/entry-patch.ts), the same way
// EntryInput above is a plain interface rather than z.infer<typeof Body>: a
// field added to the HTTP contract must not silently widen what this
// function accepts. The route maps its validated body onto this shape
// explicitly. Every field absent means "leave untouched"; `sid: null` is the
// one field where an explicit null is itself a real value (see
// updateOwnEntry below).
export interface EntryPatch {
  word?: string;
  gloss?: string | null;
  story?: string | null;
  saidAt?: string;
  sid?: string | null;
}

// Partial update (VKB-100, entry-actions-spec §"Edit: what moves, what
// holds"): absent keys stay untouched. Re-pointing `sid` re-snapshots the
// denormalised speaker/tone columns the same way createEntry does at
// insert — `sid: null` detaches the speaker (falls back to "You"), which is
// a real instruction distinct from `sid` being absent (leave the current
// speaker alone). `id`, `createdAt` and media are never touched here; the
// final read reuses getOwnEntry so the returned view matches GET exactly —
// same live speaker join, same media join.
export const updateOwnEntry = async (
  ownerId: string,
  entryId: string,
  patch: EntryPatch,
): Promise<EntryWithMedia> => {
  const db = useDb();
  const values: Partial<typeof entries.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.word !== undefined) values.word = patch.word;
  if (patch.gloss !== undefined) values.gloss = patch.gloss;
  if (patch.story !== undefined) values.story = patch.story;
  if (patch.saidAt !== undefined) values.saidAt = patch.saidAt;

  if ('sid' in patch) {
    const speaker = patch.sid ? await getOwnSpeaker(ownerId, patch.sid) : null;
    values.sid = speaker ? speaker.id : null;
    values.speaker = speaker ? speaker.name : null;
    values.tone = speaker ? speaker.tone : null;
  }

  const updated = await db
    .update(entries)
    .set(values)
    .where(and(eq(entries.id, entryId), eq(entries.ownerId, ownerId)))
    .returning({ id: entries.id });
  if (updated.length === 0) {
    throw new DomainError(DOMAIN_ERROR_CODES.entryNotFound, 'entry not found');
  }

  return getOwnEntry(ownerId, entryId);
};

// Deletes the row (media cascades). R2 objects stay: originals are the
// source of truth (ADR-0009); orphan derivatives are a lifecycle concern,
// not a request-path one.
export const deleteOwnEntry = async (ownerId: string, entryId: string) => {
  const db = useDb();
  const deleted = await db
    .delete(entries)
    .where(and(eq(entries.id, entryId), eq(entries.ownerId, ownerId)))
    .returning({ id: entries.id });
  if (deleted.length === 0) {
    throw new DomainError(DOMAIN_ERROR_CODES.entryNotFound, 'entry not found');
  }
};
