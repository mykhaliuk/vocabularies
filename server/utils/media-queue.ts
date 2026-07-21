import { Client } from '@upstash/qstash';
import { getAppUrl } from './app-url';
import { processMedia } from './media-process';

// Async trigger for media processing (ADR-0009; VKB-80).
//
// - QStash configured → enqueue an HTTP job on a per-stage named queue
//   (QSTASH_QUEUE_NAME: `vocabu-stage` for dev/preprod, `vocabu` for prod)
//   that calls /api/media/process with retries + DLQ; the serverless
//   request that confirmed the upload returns immediately. Tokens and
//   signing keys are account-level in QStash, so the named queue is what
//   keeps stage and prod backlogs isolated.
// - Local (no QStash) → run in-process, fire-and-forget. Fine for dev; on
//   Vercel a detached promise dies when the function returns, so non-local
//   stages without QStash log a loud warning instead of pretending.

let cachedClient: Client | null | undefined;

// QStash mode requires the WHOLE quad: the publish token, both worker
// signing keys, AND the stage queue name. Enqueue and worker live in the
// same deployment, so a token without signing keys would publish jobs the
// worker rejects (404) — every upload would die silently; a missing queue
// name would silently mix stage and prod backlogs. Half-configured →
// treat as unconfigured, loudly.
const getClient = () => {
  if (cachedClient !== undefined) return cachedClient;
  const token = process.env.QSTASH_TOKEN;
  const hasSigningKeys =
    !!process.env.QSTASH_CURRENT_SIGNING_KEY &&
    !!process.env.QSTASH_NEXT_SIGNING_KEY;
  const queueName = process.env.QSTASH_QUEUE_NAME;
  if (token && (!hasSigningKeys || !queueName)) {
    console.error(
      '[media-queue] QSTASH_TOKEN set but signing keys or QSTASH_QUEUE_NAME missing — QStash disabled, falling back to inline processing',
    );
  }
  const isConfigured = !!token && hasSigningKeys && !!queueName;
  cachedClient = isConfigured ? new Client({ token }) : null;
  return cachedClient;
};

// Queue existence is not guaranteed by enqueue alone, so the queue is
// upserted once per warm process. Upsert is create-or-update, which also
// pins the queue config in code, not in creation defaults or dashboard
// tuning.
//
// Parallelism 5: uploads from different users must not wait for each
// other (each delivery runs in its own function instance), while staying
// under the plan cap of 10. NOT 1 — serial FIFO turns any slow or
// retrying head message into head-of-line blocking for every upload
// behind it (observed live during VKB-80/84 QA).
const QUEUE_PARALLELISM = 5;

let queueReady: Promise<void> | null = null;

const ensureQueue = (client: Client, queueName: string) => {
  if (!queueReady) {
    queueReady = client
      .queue({ queueName })
      .upsert({ parallelism: QUEUE_PARALLELISM })
      .catch((error) => {
        queueReady = null;
        throw error;
      });
  }
  return queueReady;
};

const processInline = async (stage: string, key: string, userId: string) => {
  if (stage !== 'local') {
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

export const enqueueMediaProcessing = async (key: string, userId: string) => {
  const client = getClient();
  const stage = process.env.APP_ENV ?? 'local';

  if (client) {
    // Outside the try: a missing APP_URL is a deployment config bug and
    // must fail loudly, not masquerade as a QStash outage.
    const baseUrl = getAppUrl().replace(/\/+$/, '');
    const queueName = process.env.QSTASH_QUEUE_NAME as string;
    // Preview deployments sit behind Vercel Deployment Protection; the
    // callback must carry the bypass header or every delivery 401s at
    // the platform layer (3 retries → DLQ) before our code runs. The
    // secret is injected by Vercel when Protection Bypass for Automation
    // is enabled; absent (e.g. production) the header is skipped.
    // Accepted risk: the header rides inside the QStash message, so the
    // secret is visible in our own Upstash console (messages/DLQ).
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const headers = bypassSecret
      ? { 'x-vercel-protection-bypass': bypassSecret }
      : undefined;
    try {
      await ensureQueue(client, queueName);
      await client.queue({ queueName }).enqueueJSON({
        url: `${baseUrl}/api/media/process`,
        body: { key, userId },
        retries: 3,
        headers,
      });
      return 'qstash';
    } catch (error) {
      // Operational failure (QStash outage, rate limit): degrade inline
      // instead of surfacing a raw 500 from confirm.
      console.error(
        '[media-queue] QStash enqueue failed — falling back to inline processing (blocking on non-local stages)',
        error,
      );
      return processInline(stage, key, userId);
    }
  }

  if (stage !== 'local') {
    console.warn(
      '[media-queue] QStash unconfigured on non-local stage — processing inline; the request will block until done',
    );
  }
  return processInline(stage, key, userId);
};
