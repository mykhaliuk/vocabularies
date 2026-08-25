import { expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

// Hermeticity, not "offline" (VKB-123): tests may talk to anything the repo
// brings up itself — the app server, Postgres, MinIO — and never to the
// public internet. Local infra stays in coverage; third parties are out.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// A legitimate exception is declared here, per hostname, in a reviewed diff —
// never by a spec quietly reaching out. Empty on purpose.
export const ALLOWED_EXTERNAL_HOSTS: ReadonlySet<string> = new Set<string>();

// The block itself lives in Chromium's DNS resolver: every non-excluded name
// maps to NOTFOUND, so an external request dies with ERR_NAME_NOT_RESOLVED
// before any connection exists.
const HOST_RESOLVER_EXCLUDES = ['localhost', ...ALLOWED_EXTERNAL_HOSTS].map(
  (host) => `EXCLUDE ${host}`,
);
export const HERMETIC_LAUNCH_ARGS = [
  `--host-resolver-rules=MAP * ~NOTFOUND, ${HOST_RESOLVER_EXCLUDES.join(', ')}`,
];

const isExternal = (rawUrl: string) => {
  const url = new URL(rawUrl);
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    !LOCAL_HOSTS.has(url.hostname) &&
    !ALLOWED_EXTERNAL_HOSTS.has(url.hostname)
  );
};

// The loud half: the resolver kills the connection, but a fire-and-forget
// request would die silently. This listener (passive — no interception)
// collects every external attempt, and the returned assert fails the test
// naming the URLs.
export const watchPublicInternet = (context: BrowserContext) => {
  const offenders: string[] = [];
  context.on('request', (request) => {
    if (isExternal(request.url())) offenders.push(request.url());
  });
  return () => {
    expect(
      offenders,
      'tests must not reach the public internet (e2e/hermetic.ts)',
    ).toEqual([]);
  };
};
