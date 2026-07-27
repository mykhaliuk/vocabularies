// graph-allow-orphan: QStash worker callback; the caller is the queue,
// never the client.
import { Receiver } from '@upstash/qstash';
import { z } from 'zod';
import { processUploadedMedia } from '~/server/domain/media';
import { MediaRejection } from '~/server/utils/media-process';

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
  } else if (process.env.APP_ENV !== 'local') {
    // Deliberately strict: an UNSET APP_ENV must not unlock the worker —
    // defaulting to 'local' here would leave the endpoint unauthenticated
    // on a misconfigured cloud deploy.
    throw createError({ statusCode: 404, statusMessage: 'not found' });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'invalid body' });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'invalid body' });
  }

  const { key, userId } = parsed.data;
  console.log('[media.process] start', { key });
  setResponseHeader(event, 'Cache-Control', 'no-store');

  try {
    const manifest = await processUploadedMedia(key, userId);
    console.log('[media.process] done', { key, timings: manifest.timings });
    return { ok: true, timings: manifest.timings, kind: manifest.kind };
  } catch (error) {
    // A rejection (over-limit, unreadable file) is a PERMANENT outcome:
    // the failure manifest is already written, the job is done. Return
    // 200 so QStash does not retry it — retries of permanent outcomes
    // waste delivery slots and, on a saturated queue, delay every job
    // behind them. Transient errors keep propagating as 500 → QStash
    // retries (desired).
    if (error instanceof MediaRejection) {
      console.warn('[media.process] rejected', { key, error: error.message });
      return { ok: false, status: 'failed', error: error.message };
    }
    throw error;
  }
});
