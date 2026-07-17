import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    // The lazy sweep (ADR-0005) deletes WHERE expires_at < now() on every
    // sign-in; without this index that is a full-table scan.
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);
