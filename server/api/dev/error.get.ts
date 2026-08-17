// Synthetic error route for verifying Sentry wiring. This condition is the
// whole guard — without it the route throws real errors on demand in
// production — so it narrows when stages go away rather than going with them.
export default defineEventHandler(() => {
  const env = process.env.APP_ENV ?? 'local';
  if (env === 'production') {
    throw createError({ statusCode: 404 });
  }
  throw new Error('synthetic test error from /api/dev/error');
});
