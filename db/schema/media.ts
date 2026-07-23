import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { entries } from './entries';
import { users } from './users';

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
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // audio | video
    status: text('status').notNull().default('processing'), // processing | ready | failed
    originalKey: text('original_key').notNull(),
    derivativeKey: text('derivative_key'),
    posterKey: text('poster_key'),
    durationSec: real('duration_sec'),
    width: integer('width'),
    height: integer('height'),
    peaks: jsonb('peaks').$type<number[]>(),
    error: text('error'),
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
  ],
);
