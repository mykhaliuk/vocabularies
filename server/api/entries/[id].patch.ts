import { z } from 'zod';
import { updateOwnEntry } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { EntryPatchBody, toEntryPatch } from '~/server/utils/entry-patch';
import {
  toEntryView,
  toMediaPlaybackUrls,
  toMediaView,
} from '~/server/utils/entry-view';
import { toHttpError } from '~/server/utils/http-errors';
import type { EntryDetailResponse } from '~/server/utils/entry-view';

const Params = z.object({ id: z.string().uuid() });

export default defineEventHandler(
  async (event): Promise<EntryDetailResponse> => {
    const { user } = await requireUser(event);
    const { id } = await getValidatedRouterParams(event, (data) =>
      Params.parse(data),
    );
    const body = await readValidatedBody(event, (data) =>
      EntryPatchBody.parse(data),
    );

    // toEntryPatch maps the validated body onto the domain's own EntryPatch
    // shape explicitly (not passed through as the zod-inferred type) so a
    // field added to the HTTP contract cannot silently widen what the domain
    // accepts — same reason POST /api/entries maps its body onto EntryInput
    // instead of forwarding it raw. Its absent-vs-null handling is pinned by
    // tests/unit/entry-patch.test.ts.
    const patch = toEntryPatch(body);

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
  },
);
