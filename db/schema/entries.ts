import { sql } from 'drizzle-orm';
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { speakers, speakerTone } from './speakers';
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
    // Who said it (VKB-97). `sid` points at the speaker; `speaker`/`tone`
    // are a denormalised copy taken at creation so a removed speaker still
    // renders as a name (with no relation or age). The speaker record wins
    // whenever `sid` still resolves. Both NULL → the word is the user's own
    // ("You" is rendered client-side, never stored — it is locale copy).
    sid: uuid('sid').references(() => speakers.id, { onDelete: 'set null' }),
    speaker: text('speaker'),
    tone: speakerTone('tone'),
    // The day the words were said — the anchor the frozen age is measured
    // against. Required and initialised to the insert date (UTC); the user
    // corrects it later on the word screen. created_at stays an audit field
    // about the row, not about the memory.
    saidAt: date('said_at')
      .default(sql`CURRENT_DATE`)
      .notNull(),
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
