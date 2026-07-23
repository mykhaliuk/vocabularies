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
    // Billing-owned (manually until billing exists): free | essentials |
    // premium. Read only inside can() — the one-door rule (VKB-64).
    plan: text('plan').notNull().default('free'),
    // Hand-granted roles (vip, admin), independent of plan. Same one-door
    // rule: no consumer reads this outside entitlements.
    grants: text('grants')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);
