import { describe, expect, test } from 'bun:test';

const CONFIG_PATH = new URL('../../playwright.config.ts', import.meta.url)
  .pathname;

// The reuse decision is read from the environment at module evaluation, and
// bun caches the module per process — so each env case gets its own process.
const reuseUnder = (env: Record<string, string | undefined>) => {
  const script =
    `const config = (await import(${JSON.stringify(CONFIG_PATH)})).default; ` +
    'console.log(JSON.stringify(config.webServer.reuseExistingServer));';
  const result = Bun.spawnSync({
    cmd: ['bun', '-e', script],
    env: { ...process.env, CI: undefined, E2E_REUSE_SERVER: undefined, ...env },
  });
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout.toString().trim());
};

describe('smoke playwright config (VKB-146)', () => {
  test('never reuses a running server by default', () => {
    expect(reuseUnder({})).toBe(false);
  });

  test('reuse is opt-in via E2E_REUSE_SERVER=1', () => {
    expect(reuseUnder({ E2E_REUSE_SERVER: '1' })).toBe(true);
  });

  test('stays off port 3000 where a dev server usually listens', async () => {
    const { default: config } = await import(CONFIG_PATH);
    expect(config.use.baseURL).not.toContain(':3000');
    expect(config.webServer.url).toBe(config.use.baseURL);
    expect(config.webServer.env.NITRO_PORT).toBe(
      String(new URL(config.use.baseURL).port),
    );
  });
});
