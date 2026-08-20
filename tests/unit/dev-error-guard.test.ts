import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// Nitro auto-imports, scoped and restored: bun shares process globals across
// test files.
type Globals = { defineEventHandler?: unknown; createError?: unknown };

const globals = globalThis as Globals;
const saved: Globals = {};
let savedEnv: string | undefined;

beforeEach(() => {
  saved.defineEventHandler = globals.defineEventHandler;
  saved.createError = globals.createError;
  savedEnv = process.env.APP_ENV;
  globals.defineEventHandler = (handler: unknown) => handler;
  globals.createError = (input: unknown) =>
    Object.assign(new Error('http'), input);
});

afterEach(() => {
  globals.defineEventHandler = saved.defineEventHandler;
  globals.createError = saved.createError;
  if (savedEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = savedEnv;
});

// The query string defeats bun's module cache; the module reads APP_ENV at
// import, so the stubs must already be installed.
const callRoute = async (stage: string | undefined) => {
  if (stage === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = stage;
  const route = (await import(
    `../../server/api/dev/error.get.ts?stage=${stage ?? 'unset'}`
  )) as { default: () => unknown };
  try {
    route.default();
    return null as unknown;
  } catch (error) {
    return error;
  }
};

describe('/api/dev/error', () => {
  test('404s in production', async () => {
    expect(
      ((await callRoute('production')) as { statusCode?: number }).statusCode,
    ).toBe(404);
  });

  test('throws the synthetic error on dev', async () => {
    expect(((await callRoute('dev')) as Error).message).toContain(
      'synthetic test error',
    );
  });

  test('throws it on local and when APP_ENV is unset', async () => {
    expect(((await callRoute('local')) as Error).message).toContain(
      'synthetic test error',
    );
    expect(((await callRoute(undefined)) as Error).message).toContain(
      'synthetic test error',
    );
  });

  test('an unknown stage is not mistaken for production', async () => {
    expect(((await callRoute('preprod')) as Error).message).toContain(
      'synthetic test error',
    );
  });
});
