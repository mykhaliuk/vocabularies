import {
  index,
  integer,
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
// high-entropy poll key, binds its hash here, and polls. The link click ARMS
// the claim: it sets user_id AND a short confirmation code (hashed, with its
// own 5-min window and a 3-attempt cap), revealing the code only on the click
// page. The PWA polls until armed, then the initiating device enters the code;
// /api/auth/confirm verifies it and claims the row exactly once to mint the
// PWA's own session. The code closes a session-fixation hole: an attacker who
// holds the poll key but never saw the victim's click page cannot confirm
// (ADR-0008). Only SHA-256 hashes of the poll key and the code are stored —
// both are bearer secrets.
export const signinClaims = pgTable(
  'signin_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollKeyHash: bytea('poll_key_hash').notNull(),
    // Armed by the auth callback after a successful click; null = pending.
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    // Confirmation code (hashed) revealed on the click page; verified by
    // /api/auth/confirm. confirm_expires_at is a SHORT window (5 min) separate
    // from expires_at, and confirm_attempts caps brute force.
    confirmCodeHash: bytea('confirm_code_hash'),
    confirmAttempts: integer('confirm_attempts').notNull().default(0),
    confirmExpiresAt: timestamp('confirm_expires_at', { withTimezone: true }),
    // Set atomically by the winning confirm; single-use guard against
    // double-issue.
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
