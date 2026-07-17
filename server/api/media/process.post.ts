import { Receiver } from '@upstash/qstash';
import { z } from 'zod';
import { processMedia } from '~/server/utils/media-process';

const Body = z.object({
  key: z.string(),
  userId: z.string().uuid(),
});

// QStash worker endpoint. Callers are machines, not users:
// - with QStash signing keys configured, the request must carry a valid
//   `upstash-signature` (body-bound, replay-safe);
// - without them, only APP_ENV=local may call it (dev loopback).
let cachedReceiver: Receiver | null | undefined;

const getReceiver = () => {
  if (cachedReceiver !== undefined) return cachedReceiver;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  cachedReceiver =
    currentSigningKey && nextSigningKey
      ? new Receiver({ currentSigningKey, nextSigningKey })
      : null;
  return cachedReceiver;
};

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event)) ?? '';
  const receiver = getReceiver();

  if (receiver) {
    const signature = getHeader(event, 'upstash-signature');
    if (!signature) {
      throw createError({
        statusCode: 401,
        statusMessage: 'missing signature',
      });
    }
    const valid = await receiver
      .verify({ signature, body: rawBody })
      .catch(() => false);
    if (!valid) {
      throw createError({ statusCode: 401, statusMessage: 'bad signature' });
    }
  } else if ((process.env.APP_ENV ?? 'local') !== 'local') {
    throw createError({ statusCode: 404, statusMessage: 'not found' });
  }

  const parsed = Body.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'invalid body' });
  }

  const { key, userId } = parsed.data;
  console.log('[media.process] start', { key });
  const manifest = await processMedia(key, userId);
  console.log('[media.process] done', { key, timings: manifest.timings });

  setResponseHeader(event, 'Cache-Control', 'no-store');
  return { ok: true, timings: manifest.timings, kind: manifest.kind };
});
