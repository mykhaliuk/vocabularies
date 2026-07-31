// graph-pending: VKB-110 — compose edit mode is the first caller
import { z } from 'zod';
import { updateOwnEntry } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { EntryPatchBody } from '~/server/utils/entry-patch';
import {
  toEntryView,
  toMediaPlaybackUrls,
  toMediaView,
} from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';
import type { EntryPatch } from '~/server/domain/entries';

const Params = z.object({ id: z.string().uuid() });

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { id } = await getValidatedRouterParams(event, (data) =>
    Params.parse(data),
  );
  const body = await readValidatedBody(event, (data) =>
    EntryPatchBody.parse(data),
  );

  // Mapped onto the domain's own EntryPatch shape explicitly (not passed
  // through as the zod-inferred type) so a field added to the HTTP contract
  // cannot silently widen what the domain accepts — same reason
  // POST /api/entries maps its body onto EntryInput instead of forwarding it
  // raw. An empty string and an explicit null both mean "clear the field".
  const patch: EntryPatch = {};
  if (body.word !== undefined) patch.word = body.word;
  if (body.gloss !== undefined) patch.gloss = body.gloss || null;
  if (body.story !== undefined) patch.story = body.story || null;
  if (body.saidAt !== undefined) patch.saidAt = body.saidAt;
  if ('sid' in body) patch.sid = body.sid ?? null;

  let updated;
  try {
    updated = await updateOwnEntry(user.id, id, patch);
  } catch (error) {
    throw toHttpError(error);
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');
  const mediaView = updated.media ? toMediaView(updated.media) : null;
  const playback =
    updated.media && updated.media.status === 'ready'
      ? await toMediaPlaybackUrls(updated.media)
      : null;
  return {
    entry: toEntryView(updated.entry, updated.speaker),
    media: mediaView,
    playback,
  };
});
