import { expect } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

// Hermeticity, not "offline" (VKB-123): tests may talk to anything the repo
// brings up itself — the app server, Postgres, MinIO — and never to the
// public internet. Local infra stays in coverage; third parties are out.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

// A legitimate exception is declared here, per hostname, in a reviewed diff —
// never by a spec quietly reaching out. Empty on purpose. (An entry here
// must also be carved out of the resolver rule below.)
export const ALLOWED_EXTERNAL_HOSTS: ReadonlySet<string> = new Set();

// The block itself lives in Chromium's DNS resolver: every non-localhost
// name maps to NOTFOUND, so an external request dies with
// ERR_NAME_NOT_RESOLVED before any connection exists. Route interception was
// tried first and rejected — enabling it intercepts EVERY request in the
// context (media range requests break, and the added per-request latency
// resurfaced the VKB-178 locale race), where the resolver rule costs
// nothing on the localhost path.
export const HERMETIC_LAUNCH_ARGS = [
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
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
