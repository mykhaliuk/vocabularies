import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from './bytea';

export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: bytea('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('magic_link_tokens_token_hash_unique').on(table.tokenHash),
    index('magic_link_tokens_email_idx').on(table.email),
    // The lazy sweep (ADR-0002) deletes WHERE expires_at < now() on every
    // link request; without this index that is a full-table scan.
    index('magic_link_tokens_expires_at_idx').on(table.expiresAt),
  ],
);
