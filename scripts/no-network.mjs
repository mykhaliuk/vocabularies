// Preload that turns any outbound third-party HTTP request into a failure,
// so "this process does not need the internet" is demonstrated rather than
// inferred from a run that happened to have it. Used by
// `bun run build:offline` and, since VKB-123, by scripts/e2e-server.js for
// the app server the authed suite spawns.
//
// Both request paths are covered on purpose. undici's `fetch` does not go
// through `node:http`, and a dependency reaching for `https.request` directly
// would otherwise slip past a fetch-only guard — a hole in a tool whose whole
// job is to prove there is no hole.
//
// Loopback stays allowed: a build may legitimately talk to something local,
// and blocking that would prove nothing about third parties.
import http from 'node:http';
import https from 'node:https';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const refuse = (target) => {
  throw new Error(
    `[no-network] this process reached out to ${target} — it must resolve ` +
      'everything locally (node_modules, the repo, loopback services)',
  );
};

const isLocal = (hostname) => LOCAL_HOSTS.has(hostname);

const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return realFetch(input, init);
    }
    if (isLocal(hostname)) return realFetch(input, init);
  } catch {
    return realFetch(input, init);
  }
  return refuse(url);
};

// `http.request(url | options, ...)` — the host can arrive as a string, a URL
// or an options object, so read all three rather than assume one shape.
const hostOf = (arg) => {
  if (typeof arg === 'string') {
    try {
      return new URL(arg).hostname;
    } catch {
      return null;
    }
  }
  if (arg instanceof URL) return arg.hostname;
  if (arg && typeof arg === 'object') {
    return arg.hostname ?? arg.host?.split(':')[0] ?? null;
  }
  return null;
};

const guard = (module, name, label) => {
  const real = module[name];
  module[name] = (...args) => {
    const host = hostOf(args[0]) ?? hostOf(args[1]);
    // An unreadable host is refused rather than waved through: this guard is
    // only worth having if its failure mode is a false alarm, not a miss.
    if (host === null || !isLocal(host)) {
      refuse(`${label}.${name} → ${host ?? 'unknown host'}`);
    }
    return real.apply(module, args);
  };
};

guard(http, 'request', 'http');
guard(http, 'get', 'http');
guard(https, 'request', 'https');
guard(https, 'get', 'https');

console.log('[no-network] outbound HTTP is blocked for this process');
