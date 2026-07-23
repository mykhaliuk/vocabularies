import { and, desc, eq, sql } from 'drizzle-orm';
import { entries } from '~/db/schema/entries';
import { media } from '~/db/schema/media';
import { useDb } from '~/server/utils/db';
import { DOMAIN_ERROR_CODES, DomainError } from './errors';
import { mintUploadSlot } from './media';
import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '~/db/schema/users';
import type { MediaRow, UploadSlot, UploadSlotInput } from './media';

type User = InferSelectModel<typeof users>;
export type EntryRow = InferSelectModel<typeof entries>;

export interface EntryInput {
  word: string;
  gloss: string | null;
  speaker: string | null;
  story: string | null;
  collection: string | null;
}

export interface EntryWithMedia {
  entry: EntryRow;
  media: MediaRow | null;
}

export interface CreatedEntry extends EntryWithMedia {
  upload: UploadSlot | null;
}

export const createEntry = async (
  user: User,
  input: EntryInput,
  mediaInput: UploadSlotInput | null,
): Promise<CreatedEntry> => {
  const db = useDb();
  const [entry] = await db
    .insert(entries)
    .values({ ownerId: user.id, ...input })
    .returning();
  if (!entry) throw new Error('[domain.entries] insert returned no row');

  if (!mediaInput) return { entry, media: null, upload: null };

  let minted;
  try {
    minted = await mintUploadSlot(user, mediaInput, entry.id);
  } catch (error) {
    // No half-created moments: an entry whose upload slot failed to mint
    // (entitlement or storage) must not linger in the feed.
    await db.delete(entries).where(eq(entries.id, entry.id));
    throw error;
  }

  return { entry, media: minted.row, upload: minted.slot };
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
// One media row per entry in v1; the left join keeps text-only entries in
// the page.
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
    .select({ entry: entries, media })
    .from(entries)
    .leftJoin(media, eq(media.entryId, entries.id))
    .where(and(...conditions))
    .orderBy(desc(entries.createdAt), desc(entries.id))
    .limit(options.limit);

  return rows.map(({ entry, media: mediaRow }) => ({
    entry,
    media: mediaRow,
  }));
};

export const getOwnEntry = async (
  ownerId: string,
  entryId: string,
): Promise<EntryWithMedia> => {
  const db = useDb();
  const [row] = await db
    .select({ entry: entries, media })
    .from(entries)
    .leftJoin(media, eq(media.entryId, entries.id))
    .where(and(eq(entries.id, entryId), eq(entries.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new DomainError(DOMAIN_ERROR_CODES.entryNotFound, 'entry not found');
  }
  return { entry: row.entry, media: row.media };
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
