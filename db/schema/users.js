import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    avatarKey: text('avatar_key'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);
