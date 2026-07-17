import { Client } from '@upstash/qstash';
import { processMedia } from './media-process';

// Async trigger for media processing (VKB-63 spike; final choice pending
// the QStash discussion with the owner).
//
// - QStash configured → publish an HTTP job that calls /api/media/process
//   with retries + DLQ; the serverless request that confirmed the upload
//   returns immediately.
// - Local (no QStash) → run in-process, fire-and-forget. Fine for dev; on
//   Vercel a detached promise dies when the function returns, so non-local
//   stages without QStash log a loud warning instead of pretending.

let cachedClient: Client | null | undefined;

const getClient = () => {
  if (cachedClient !== undefined) return cachedClient;
  const token = process.env.QSTASH_TOKEN;
  cachedClient = token ? new Client({ token }) : null;
  return cachedClient;
};

export const enqueueMediaProcessing = async (key: string, userId: string) => {
  const client = getClient();
  const stage = process.env.APP_ENV ?? 'local';

  if (client) {
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error('[media-queue] APP_URL is required');
    await client.publishJSON({
      url: `${appUrl}/api/media/process`,
      body: { key, userId },
      retries: 3,
    });
    return 'qstash';
  }

  if (stage !== 'local') {
    console.warn(
      '[media-queue] QSTASH_TOKEN unset on non-local stage — processing inline; the request will block until done',
    );
    // Blocking beats silently losing the job on a frozen lambda.
    await processMedia(key, userId);
    return 'inline-blocking';
  }

  processMedia(key, userId).catch((error) => {
    console.error('[media-queue] local processing failed', { key, error });
  });
  return 'inline';
};
