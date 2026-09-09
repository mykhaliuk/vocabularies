import { z } from 'zod';
import { getFeedPage } from '~/server/domain/entries';
import { requireUser } from '~/server/utils/auth';
import { toEntryView, toMediaView } from '~/server/utils/entry-view';
import type { FeedCursor } from '~/server/domain/entries';
import type { FeedResponse } from '~/server/utils/entry-view';

// Opaque keyset cursor: "<createdAt ISO>_<entry uuid>". ISO timestamps and
// uuids never contain an underscore, so the split is unambiguous.
const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)_([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/;

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Pass the previous page's nextCursor to continue.
  cursor: z.string().regex(CURSOR_PATTERN).optional(),
});

const parseCursor = (raw: string): FeedCursor => {
  const match = raw.match(CURSOR_PATTERN) as RegExpMatchArray;
  return { at: new Date(match[1] as string), id: match[2] as string };
};

const formatCursor = (at: Date, id: string) => `${at.toISOString()}_${id}`;

export default defineEventHandler(async (event): Promise<FeedResponse> => {
  const { user } = await requireUser(event);
  const { limit, cursor } = await getValidatedQuery(event, (data) =>
    Query.parse(data),
  );

  const before = cursor ? parseCursor(cursor) : null;
  // The regex checks shape, not calendar validity — a hand-tampered cursor
  // like 2026-13-45T… must be a 400, not a serialization 500.
  if (before && Number.isNaN(before.at.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'invalid cursor' });
  }

  const page = await getFeedPage(user.id, { limit, before });

  setResponseHeader(event, 'Cache-Control', 'no-store');
  const last = page[page.length - 1];
  return {
    entries: page.map(({ entry, speaker, media }) => ({
      ...toEntryView(entry, speaker),
      media: media ? toMediaView(media) : null,
    })),
    nextCursor:
      page.length === limit && last
        ? formatCursor(last.entry.createdAt, last.entry.id)
        : null,
  };
});
