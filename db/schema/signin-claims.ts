import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea } from './bytea';
import { users } from './users';

// Cross-jar sign-in handoff (VKB-70). An installed standalone PWA has its own
// cookie/storage jar isolated from Safari, so the magic link — which opens in
// Safari — sets the session cookie in the wrong jar. The PWA instead mints a
// high-entropy poll key, binds its hash here, and polls: the link click arms
// the claim (sets user_id), and the PWA's poll claims it exactly once to mint
// its OWN session. Only the SHA-256 hash of the poll key is stored, mirroring
// how magic_link_tokens stores the token hash — the raw key is a bearer secret
// that lives only in the PWA's storage.
export const signinClaims = pgTable(
  'signin_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollKeyHash: bytea('poll_key_hash').notNull(),
    // Armed by the auth callback after a successful sign-in; null = pending.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Set atomically by the winning poll; single-use guard against double-issue.
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('signin_claims_poll_key_hash_unique').on(table.pollKeyHash),
    // The lazy sweep (mirroring ADR-0002/0005) deletes WHERE expires_at < now()
    // when a claim is created; without this index that is a full-table scan.
    index('signin_claims_expires_at_idx').on(table.expiresAt),
  ],
);
