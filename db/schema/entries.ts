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
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The feed reads WHERE owner_id = ? ORDER BY created_at DESC; a
    // composite index serves both the filter and the sort.
    index('entries_owner_created_idx').on(table.ownerId, table.createdAt),
  ],
);
