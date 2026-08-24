import { expect, test } from '@playwright/test';

// The suite runs with and without a reachable bucket (CI has no MinIO), so
// the pin is the route's own rule — status code restates the payload — not a
// hard 200.
const isStorageOk = (status: string) =>
  status === 'ok' || status.startsWith('degraded');

const isRedisOk = (status: string, env: string) =>
  status === 'ok' || (env === 'local' && status === 'skipped');

test('health reports a reachable database', async ({ request }) => {
  const response = await request.get('/api/health');

  const body = await response.json();
  expect(body.db).toEqual({ status: 'ok' });
});

test('the status code restates the payload', async ({ request }) => {
  const response = await request.get('/api/health');

  const body = await response.json();
  const healthy =
    body.db.status === 'ok' &&
    isStorageOk(body.storage.status) &&
    isRedisOk(body.redis.status, body.env);
  expect(response.status()).toBe(healthy ? 200 : 503);
});

test('the health payload keeps its shape and stays uncached', async ({
  request,
}) => {
  const response = await request.get('/api/health');

  expect(response.headers()['cache-control']).toBe('no-store');
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['db', 'env', 'redis', 'storage']);
  expect(body.env).toBe('local');
  for (const leg of [body.db, body.storage, body.redis]) {
    expect(typeof leg.status).toBe('string');
  }
});
