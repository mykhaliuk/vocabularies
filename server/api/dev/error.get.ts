// Synthetic error route for Sentry wiring. This condition is the whole guard.
export default defineEventHandler(() => {
  const env = process.env.APP_ENV ?? 'local';
  if (env === 'production') {
    throw createError({ statusCode: 404 });
  }
  throw new Error('synthetic test error from /api/dev/error');
});
