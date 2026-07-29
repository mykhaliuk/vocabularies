import type { SpeakerRow } from '~/server/domain/speakers';
import type { SpeakerTone } from '~/db/schema/speakers';

// Plain projection — the exposed speaker shape (serialization, not a DTO
// layer). Timestamps stay internal; the client has no use for them.
export interface SpeakerView {
  id: string;
  name: string;
  rel: string | null;
  birthday: string | null;
  tone: SpeakerTone;
}

export const toSpeakerView = (row: SpeakerRow): SpeakerView => ({
  id: row.id,
  name: row.name,
  rel: row.rel,
  birthday: row.birthday,
  tone: row.tone,
});
