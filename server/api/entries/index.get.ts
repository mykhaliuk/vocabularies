import { z } from 'zod';
import { getFeedPage } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { toEntryView, toMediaView } from '~/server/utils/entry-view';

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Keyset cursor: pass the previous page's nextBefore to continue.
  before: z.coerce.date().optional(),
});

export default defineEventHandler(async (event) => {
  const { user } = await requireUser(event);
  const { limit, before } = await getValidatedQuery(event, (data) =>
    Query.parse(data),
  );

  const page = await getFeedPage(user.id, { limit, before: before ?? null });

  setResponseHeader(event, 'Cache-Control', 'no-store');
  const last = page[page.length - 1];
  return {
    entries: page.map(({ entry, media }) => ({
      ...toEntryView(entry),
      media: media ? toMediaView(media) : null,
    })),
    nextBefore:
      page.length === limit && last ? last.entry.createdAt.toISOString() : null,
  };
});
