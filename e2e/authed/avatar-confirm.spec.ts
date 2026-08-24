import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';

// The suite runs in CI with no reachable bucket (VKB-115), so only the legs
// that fail before storage run everywhere; the upload round-trip is local.
const NO_STORAGE =
  !process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('.invalid');

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('a signed-out confirm is unauthorized', async ({ request }) => {
  const response = await request.post('/api/me/avatar/confirm', {
    data: { key: 'avatars/nobody/x.png' },
  });
  expect(response.status()).toBe(401);
});

test('a malformed body and a foreign key are both rejected', async ({
  authedPage,
}) => {
  const malformed = await authedPage.request.post('/api/me/avatar/confirm', {
    data: {},
  });
  expect(malformed.status()).toBe(400);

  const foreign = await authedPage.request.post('/api/me/avatar/confirm', {
    data: { key: `avatars/${randomUUID()}/sneaky.png` },
  });
  expect(foreign.status()).toBe(400);
  expect((await foreign.json()).statusMessage).toBe('invalid avatar key');
});

test('a confirmed upload marks the profile as having an avatar', async ({
  authedPage,
}) => {
  test.skip(NO_STORAGE, 'needs a reachable bucket (MinIO locally; VKB-115)');

  const minted = await authedPage.request.post('/api/me/avatar', {
    data: { contentType: 'image/png' },
  });
  expect(minted.status()).toBe(200);
  const { uploadUrl, key } = await minted.json();

  const put = await authedPage.request.fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    data: PNG_1PX,
  });
  expect(put.ok()).toBe(true);

  const confirmed = await authedPage.request.post('/api/me/avatar/confirm', {
    data: { key },
  });
  expect(confirmed.status()).toBe(200);
  expect(confirmed.headers()['cache-control']).toBe('no-store');
  const body = await confirmed.json();
  expect(body.hasAvatar).toBe(true);

  const { key: ghostKey } = await (
    await authedPage.request.post('/api/me/avatar', {
      data: { contentType: 'image/png' },
    })
  ).json();
  const ghost = await authedPage.request.post('/api/me/avatar/confirm', {
    data: { key: ghostKey },
  });
  expect(ghost.status()).toBe(400);
  expect((await ghost.json()).statusMessage).toBe('avatar object not found');
});
