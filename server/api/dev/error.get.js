// Synthetic error route for verifying Sentry wiring. Disabled in
// preprod/production stages.
export default defineEventHandler(() => {
  const env = process.env.APP_ENV ?? 'local';
  if (env === 'preprod' || env === 'production') {
    throw createError({ statusCode: 404 });
  }
  throw new Error('synthetic test error from /api/dev/error');
});
