import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

// The classifier and the thrower are in different modules, and the whole
// point of VKB-138 is that they agree. Testing the predicate alone would stay
// green if someone replaced the marked error with a plain one — which is
// exactly the regression that puts a deploy defect back into the outage
// alert. So this asserts the real limiter's real throw.
//
// A subprocess per probe: the limiter modules cache both the Redis client and
// each limiter at module scope, so the verdict depends on the process's env
// at first touch. cwd is outside the repo because bun auto-loads .env.local,
// which would hand the probe the credentials it exists to remove.
const PROBE = `
const { isRatelimitConfigError } = await import(process.env.ALERT_MODULE);
const limiters = await import(process.env.RATELIMIT_MODULE);
try {
  limiters[process.env.PROBE_FACTORY]();
  console.log('BUILT');
} catch (error) {
  console.log(isRatelimitConfigError(error) ? 'CONFIG-ERROR' : 'PLAIN-ERROR');
}
`;

const moduleUrl = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

const build = (factory: string, env: Record<string, string>) => {
  const result = Bun.spawnSync(['bun', '-e', PROBE], {
    cwd: tmpdir(),
    env: {
      PATH: process.env.PATH ?? '',
      PROBE_FACTORY: factory,
      RATELIMIT_MODULE: moduleUrl('../../server/utils/ratelimit.ts'),
      ALERT_MODULE: moduleUrl('../../server/utils/ratelimit-alert.ts'),
      ...env,
    },
  });
  const line = result.stdout
    .toString()
    .split('\n')
    .find((entry) =>
      ['BUILT', 'CONFIG-ERROR', 'PLAIN-ERROR'].includes(entry.trim()),
    );
  if (!line) throw new Error(`probe produced no verdict: ${result.stderr}`);
  return line.trim();
};

const FACTORIES = [
  'useEmailRatelimit',
  'useIpRatelimit',
  'useCallbackIpRatelimit',
  'useAuthPollRatelimit',
  'useAuthConfirmRatelimit',
  'useMediaUploadRatelimit',
];

describe('missing Upstash config is classified, not swallowed', () => {
  for (const factory of FACTORIES) {
    test(`${factory} throws a recognised config error off local`, () => {
      expect(build(factory, { APP_ENV: 'production' })).toBe('CONFIG-ERROR');
    });
  }

  test('local still gets a working null limiter', () => {
    expect(build('useEmailRatelimit', { APP_ENV: 'local' })).toBe('BUILT');
  });

  test('a configured stage builds the real limiter', () => {
    expect(
      build('useEmailRatelimit', {
        APP_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://stub.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'stub-token',
      }),
    ).toBe('BUILT');
  });
});
