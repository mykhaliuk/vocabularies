import { and, desc, eq, sql } from 'drizzle-orm';
import { entries } from '~/db/schema/entries';
import { speakers, speakerTone } from '~/db/schema/speakers';
import { useDb } from '~/server/utils/db';
import { DOMAIN_ERROR_CODES, DomainError } from './errors';
import type { InferSelectModel } from 'drizzle-orm';

export type SpeakerRow = InferSelectModel<typeof speakers>;

export interface SpeakerInput {
  name: string;
  rel: string | null;
  birthday: string | null;
}

const TONE_CYCLE = speakerTone.enumValues;

// The chip row's order: most recently used first (the newest entry that
// points at the speaker), never-used speakers after that by creation. The
// order settles between sessions — the client fetches once per sheet
// opening, so chips never move under the thumb (speaker-spec §Creation
// flow). A correlated subquery is fine at chip-row cardinality.
export const listSpeakers = async (ownerId: string): Promise<SpeakerRow[]> => {
  const db = useDb();
  return db
    .select()
    .from(speakers)
    .where(eq(speakers.ownerId, ownerId))
    .orderBy(
      sql`(SELECT max(${entries.createdAt}) FROM ${entries} WHERE ${entries.sid} = ${speakers.id}) DESC NULLS LAST`,
      desc(speakers.createdAt),
    );
};

// Name is the only requirement; a speaker with just a name is a complete
// speaker. Tone is assigned at creation, cycling rose → blue → ink by how
// many people the owner already keeps.
export const createSpeaker = async (
  ownerId: string,
  input: SpeakerInput,
): Promise<SpeakerRow> => {
  const db = useDb();
  const [counted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(speakers)
    .where(eq(speakers.ownerId, ownerId));
  const tone = TONE_CYCLE[(counted?.count ?? 0) % TONE_CYCLE.length] ?? 'rose';

  const [row] = await db
    .insert(speakers)
    .values({
      ownerId,
      name: input.name,
      rel: input.rel,
      birthday: input.birthday,
      tone,
    })
    .returning();
  if (!row) throw new Error('[domain.speakers] insert returned no row');
  return row;
};

// Ownership gate for attribution: an entry may only point at the caller's
// own speaker. Not-found and not-yours are the same answer on purpose.
export const getOwnSpeaker = async (
  ownerId: string,
  speakerId: string,
): Promise<SpeakerRow> => {
  const db = useDb();
  const [row] = await db
    .select()
    .from(speakers)
    .where(and(eq(speakers.id, speakerId), eq(speakers.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new DomainError(
      DOMAIN_ERROR_CODES.speakerNotFound,
      'speaker not found',
    );
  }
  return row;
};
