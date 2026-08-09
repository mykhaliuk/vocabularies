import { reportRatelimitFailOpen } from '~/server/utils/ratelimit-alert';
import { useEmailRatelimit, useIpRatelimit } from '~/server/utils/ratelimit';

export interface MagicLinkRatelimitVerdict {
  allowed: boolean;
  reset: number;
}

// Run the two limiter checks in parallel via allSettled so a transient Upstash
// outage on one bucket does not mask the other's verdict, and we know which
// failed when logging. Policy: fail-open on Upstash errors — rate limit is a
// defense, blocking all logins on a Redis hiccup is a worse outcome than
// briefly allowing unmetered traffic. Sentry will surface the error.
export const checkMagicLinkRateLimits = async (
  email: string,
  ip: string,
): Promise<MagicLinkRatelimitVerdict> => {
  const results = await Promise.allSettled([
    useEmailRatelimit().limit(email),
    useIpRatelimit().limit(ip),
  ]);

  const [emailSettled, ipSettled] = results;

  if (
    emailSettled === undefined ||
    ipSettled === undefined ||
    emailSettled.status === 'rejected' ||
    ipSettled.status === 'rejected'
  ) {
    const emailError =
      emailSettled?.status === 'rejected' ? emailSettled.reason : null;
    const ipError = ipSettled?.status === 'rejected' ? ipSettled.reason : null;
    console.error('[magic-link] ratelimit upstream failure (failing open)', {
      emailError,
      ipError,
    });
    reportRatelimitFailOpen('magic-link', emailError ?? ipError);
    return { allowed: true, reset: 0 };
  }

  const allowed = emailSettled.value.success && ipSettled.value.success;
  const reset = Math.max(emailSettled.value.reset, ipSettled.value.reset);
  return { allowed, reset };
};
