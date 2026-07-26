import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Tier and grant values are Postgres enums, not free text: an invalid value
// must be a database error rather than a silent "no access" (VKB-91). They
// surface in TypeScript as unions of string literals through `enumValues` —
// never a TS enum (see .claude/rules/feedback_no_ts_enums.md).
export const planTier = pgEnum('plan_tier', ['free', 'essentials', 'premium']);
export const grantRole = pgEnum('grant_role', ['vip', 'admin']);

export type PlanTier = (typeof planTier.enumValues)[number];
export type GrantRole = (typeof grantRole.enumValues)[number];

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    avatarKey: text('avatar_key'),
    // Billing-owned (manually until billing exists). Read only inside the
    // entitlements module — the one-door rule (VKB-64).
    plan: planTier('plan').notNull().default('free'),
    // Hand-granted roles, independent of plan. Same one-door rule: no
    // consumer reads this outside entitlements.
    grants: grantRole('grants')
      .array()
      .notNull()
      .default(sql`'{}'::grant_role[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
  ],
);
