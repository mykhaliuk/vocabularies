import { listSpeakers } from '~/server/domain/speakers';
import { requireUser } from '~/server/utils/auth';
import { toSpeakerView } from '~/server/utils/speaker-view';

// The compose chip row: the caller's people, most recently used first.
export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const rows = await listSpeakers(user.id);
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { speakers: rows.map(toSpeakerView) };
});
