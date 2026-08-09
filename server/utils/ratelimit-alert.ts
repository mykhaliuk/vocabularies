import * as Sentry from '@sentry/nuxt';

const REPORT_INTERVAL_MS = 5 * 60 * 1000;

// Sentry's fingerprint dedup groups repeats into one issue, but grouping
// alone does not stop a dead limiter from emitting an event per request —
// this gate does. Per-instance state: it resets on cold start, which only
// costs an extra event in an already-open issue.
export const createReportGate = (intervalMs: number) => {
  const lastReportAt = new Map<string, number>();
  return (source: string, now: number) => {
    const last = lastReportAt.get(source);
    if (last !== undefined && now - last < intervalMs) return false;
    lastReportAt.set(source, now);
    return true;
  };
};

const gate = createReportGate(REPORT_INTERVAL_MS);

// Called from inside fail-open catch blocks: a throw here would escape the
// catch and fail the very request the policy keeps alive, so it never throws.
export const reportRatelimitFailOpen = (source: string, error: unknown) => {
  try {
    if (!gate(source, Date.now())) return;
    Sentry.withScope((scope) => {
      scope.setLevel('error');
      scope.setTag('alert', 'ratelimit-failopen');
      scope.setTag('ratelimit.source', source);
      scope.setFingerprint(['ratelimit-failopen', source]);
      const exception =
        error instanceof Error
          ? error
          : new Error(`[ratelimit] fail-open (${source}): ${String(error)}`, {
              cause: error,
            });
      Sentry.captureException(exception);
    });
  } catch (reportError) {
    console.error('[ratelimit] fail-open report failed', { reportError });
  }
};
