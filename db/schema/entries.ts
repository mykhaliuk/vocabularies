import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const entries = pgTable(
  'entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    gloss: text('gloss'),
    speaker: text('speaker'),
    story: text('story'),
    // Free-text placeholder until collections become an entity (VKB-64:
    // "nullable for now").
    collection: text('collection'),
    // Millisecond precision on purpose: created_at round-trips through a
    // JS Date inside the feed keyset cursor, and Date carries only
    // milliseconds — microsecond remainders in the db would make cursor
    // comparisons silently skip rows. Never UPDATE this column with a
    // sub-millisecond value.
    createdAt: timestamp('created_at', { withTimezone: true })
      .default(sql`date_trunc('milliseconds', now())`)
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The feed reads WHERE owner_id = ? ORDER BY created_at DESC, id DESC
    // with a (created_at, id) row-comparison keyset cursor; the composite
    // index covers the filter, the sort, and the cursor tiebreak.
    index('entries_owner_created_idx').on(
      table.ownerId,
      table.createdAt,
      table.id,
    ),
  ],
);
