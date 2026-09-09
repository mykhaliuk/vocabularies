import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { entries } from './entries';
import { users } from './users';

// Compile-time only: the columns below stay `text`, so an unknown value is a
// type error but never a database error.
export const MEDIA_KINDS = ['audio', 'video'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_STATUSES = ['processing', 'ready', 'failed'] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

// One row per uploaded moment, keyed by the minted media id that also names
// the R2 object layout (<userId>/<mediaId>/original.<ext>). Status mirrors
// the processing manifest (ADR-0009): the manifest in R2 stays the worker's
// idempotency record, this row is what product queries read.
export const media = pgTable(
  'media',
  {
    // nanoid minted at slot creation (MEDIA_ID_PATTERN), not a uuid — it is
    // shared with object keys and client polling URLs.
    id: text('id').primaryKey(),
    // Nullable: the dev spike page (/dev/media-spike) mints entry-less
    // slots through POST /api/media/upload; product media always carries
    // an entry.
    entryId: uuid('entry_id').references(() => entries.id, {
      onDelete: 'cascade',
    }),
    // Claimed at the ready transition — ADR-0009, "Replacing an entry's
    // moment". `set null` because a deleted entry moots the swap; the media
    // row is not the entry's to take with it.
    pendingEntryId: uuid('pending_entry_id').references(() => entries.id, {
      onDelete: 'set null',
    }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<MediaKind>().notNull(),
    status: text('status').$type<MediaStatus>().notNull().default('processing'),
    originalKey: text('original_key').notNull(),
    derivativeKey: text('derivative_key'),
    posterKey: text('poster_key'),
    durationSec: real('duration_sec'),
    width: integer('width'),
    height: integer('height'),
    peaks: jsonb('peaks').$type<number[]>(),
    error: text('error'),
    // Set when POST /api/media/confirm accepts the upload. Only a confirmed
    // pending row is a truthful "processing" to surface on its entry — an
    // abandoned, never-confirmed slot must stay invisible.
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('media_entry_id_idx').on(table.entryId),
    index('media_owner_id_idx').on(table.ownerId),
    // One moment per entry: getFeedPage left-joins media and caps the JOINED
    // rows, so a second row would list the entry twice and skew the cursor.
    uniqueIndex('media_entry_id_unique')
      .on(table.entryId)
      .where(sql`${table.entryId} is not null`),
  ],
);
