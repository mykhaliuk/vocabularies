import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// Speakers are first-class people (VKB-97, speaker-spec.html): owned by one
// user, private, never published. An entry points at a speaker by id and
// keeps a denormalised name/tone copy; the speaker record wins when present.
//
// Tone is a Postgres enum for the same reason plan_tier is (VKB-91): an
// invalid value must be a database error, and it surfaces in TypeScript as a
// literal union via enumValues — never a TS enum.
export const speakerTone = pgEnum('speaker_tone', ['rose', 'blue', 'ink']);

export type SpeakerTone = (typeof speakerTone.enumValues)[number];

export const speakers = pgTable(
  'speakers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // As they're actually called — "Dad", "Nonna", "Mira". Not a legal name.
    // Duplicates are allowed on purpose: two Grandmas is a real situation.
    name: text('name').notNull(),
    rel: text('rel'),
    // Never displayed as a date — only as an age derived against an entry's
    // said_at (frozen) or against today (people screen). Optional forever.
    birthday: date('birthday'),
    // Assigned at creation, cycling rose → blue → ink; drives the avatar.
    tone: speakerTone('tone').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The chip row lists one owner's speakers; nothing queries across owners.
    index('speakers_owner_idx').on(table.ownerId),
  ],
);
