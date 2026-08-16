// Preload that turns any outbound HTTP request into a build failure, so
// "the build does not need the internet" is demonstrated rather than inferred
// from a build that happened to have it. Used by `bun run build:offline`.
//
// Loopback stays allowed: a build may legitimately talk to something local,
// and blocking that would prove nothing about third parties.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const realFetch = globalThis.fetch;

globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return realFetch(input, init);
    }
    if (LOCAL_HOSTS.has(hostname)) return realFetch(input, init);
  } catch {
    return realFetch(input, init);
  }
  throw new Error(
    `[no-network] the build reached out to ${url} — it must resolve ` +
      'everything from node_modules and the repo',
  );
};

console.log('[no-network] outbound HTTP is blocked for this build');
