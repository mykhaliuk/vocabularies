import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

// The synthetic Sentry route is only safe because of one condition, and
// VKB-169 narrowed that condition while deleting a stage. Asserted rather
// than eyeballed: the failure mode is a route that throws real errors on
// demand in production, and it is invisible until someone requests it.
//
// Nitro auto-imports have to be supplied outside the server runtime. Scoped
// and restored — bun shares process globals across test files, so a stub left
// standing makes another file's behaviour depend on run order.
type Globals = {
  defineEventHandler?: unknown;
  createError?: unknown;
};

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

// Imported per test: the handler reads APP_ENV when called, but the module is
// evaluated at import, so the stubs above have to be in place first. The
// query string defeats bun's module cache between cases.
const callRoute = async (stage: string | undefined) => {
  if (stage === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = stage;
  const route = (await import(
    `../../server/api/dev/error.get.ts?stage=${stage ?? 'unset'}`
  )) as { default: () => unknown };
  try {
    route.default();
    return { threw: null as unknown };
  } catch (error) {
    return { threw: error };
  }
};

describe('/api/dev/error', () => {
  test('404s in production', async () => {
    const { threw } = await callRoute('production');
    expect((threw as { statusCode?: number }).statusCode).toBe(404);
  });

  test('still throws the synthetic error on dev', async () => {
    const { threw } = await callRoute('dev');
    expect((threw as Error).message).toContain('synthetic test error');
  });

  test('and on local, including when APP_ENV is unset', async () => {
    expect(((await callRoute('local')).threw as Error).message).toContain(
      'synthetic test error',
    );
    expect(((await callRoute(undefined)).threw as Error).message).toContain(
      'synthetic test error',
    );
  });

  // The retired stage must not come back as a hole: whatever APP_ENV says, a
  // name that is not `production` gets the dev behaviour, deliberately.
  test('an unknown stage name is not treated as production', async () => {
    const { threw } = await callRoute('preprod');
    expect((threw as Error).message).toContain('synthetic test error');
  });
});
