import * as Sentry from '@sentry/nuxt';

const REPORT_INTERVAL_MS = 5 * 60 * 1000;

// A limiter that cannot be BUILT is a deploy defect: it never self-heals, and
// it is not the transient outage the fail-open policy exists for. Every call
// site builds its limiter inside the catch implementing that policy, so
// without this marker the two arrive as the same event (VKB-138). The marker
// lives here, with the code that classifies it, so `ratelimit.ts` keeps its
// one-way dependency on this module.
const CONFIG_ERROR_CODE = 'ERATELIMIT_CONFIG';

export const ratelimitConfigError = (stage: string) =>
  Object.assign(
    new Error(
      `[ratelimit] UPSTASH_REDIS_REST_URL/_TOKEN required when APP_ENV=${stage}`,
    ),
    { code: CONFIG_ERROR_CODE },
  );

export const isRatelimitConfigError = (error: unknown) =>
  error instanceof Error &&
  (error as { code?: string }).code === CONFIG_ERROR_CODE;

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

// A limiter that was never built. Separate alert and fingerprint from
// fail-open on purpose: that alert means "Upstash went away, it may come
// back", this one means "this deploy has no abuse control and never will".
// Same never-throws contract — it is called from the same catch blocks.
export const reportRatelimitMisconfigured = (
  source: string,
  error: unknown,
) => {
  try {
    if (!gate(`config:${source}`, Date.now())) return;
    Sentry.withScope((scope) => {
      scope.setLevel('fatal');
      scope.setTag('alert', 'ratelimit-misconfigured');
      scope.setTag('ratelimit.source', source);
      scope.setFingerprint(['ratelimit-misconfigured', source]);
      const exception =
        error instanceof Error
          ? error
          : new Error(
              `[ratelimit] misconfigured (${source}): ${String(error)}`,
              { cause: error },
            );
      Sentry.captureException(exception);
    });
  } catch (reportError) {
    console.error('[ratelimit] misconfiguration report failed', {
      reportError,
    });
  }
};

// The single place that tells the two apart, so a call site cannot get the
// classification wrong by copying the wrong neighbour.
export const reportRatelimitFailure = (source: string, error: unknown) => {
  if (isRatelimitConfigError(error)) {
    reportRatelimitMisconfigured(source, error);
    return;
  }
  reportRatelimitFailOpen(source, error);
};
