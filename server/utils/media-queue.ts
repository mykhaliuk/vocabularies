import { Client } from '@upstash/qstash';
import { getAppUrl } from './app-url';
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

// QStash mode requires the WHOLE triplet: the publish token AND both
// worker signing keys. Enqueue and worker live in the same deployment, so
// a token without signing keys would publish jobs the worker rejects
// (404) — every upload would die silently. Half-configured → treat as
// unconfigured, loudly.
const getClient = () => {
  if (cachedClient !== undefined) return cachedClient;
  const token = process.env.QSTASH_TOKEN;
  const hasSigningKeys =
    !!process.env.QSTASH_CURRENT_SIGNING_KEY &&
    !!process.env.QSTASH_NEXT_SIGNING_KEY;
  if (token && !hasSigningKeys) {
    console.error(
      '[media-queue] QSTASH_TOKEN set but signing keys missing — QStash disabled, falling back to inline processing',
    );
  }
  cachedClient = token && hasSigningKeys ? new Client({ token }) : null;
  return cachedClient;
};

export const enqueueMediaProcessing = async (key: string, userId: string) => {
  const client = getClient();
  const stage = process.env.APP_ENV ?? 'local';

  if (client) {
    const baseUrl = getAppUrl().replace(/\/+$/, '');
    await client.publishJSON({
      url: `${baseUrl}/api/media/process`,
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

  // The catch exists only to keep the detached promise from becoming an
  // unhandled rejection — processMedia already logged the error and
  // persisted the failure manifest; a second log here would duplicate it.
  processMedia(key, userId).catch(() => {});
  return 'inline';
};
