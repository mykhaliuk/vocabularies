// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  devtools: { enabled: true },
  modules: ['@sentry/nuxt/module'],
  sentry: {
    sourceMapsUploadOptions: { enabled: false },
  },
  runtimeConfig: {
    appEnv: process.env.APP_ENV ?? 'local',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    dbDriver: process.env.DB_DRIVER ?? 'pg',
    databaseUrl: process.env.DATABASE_URL ?? '',
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? '',
    s3Endpoint: process.env.S3_ENDPOINT ?? '',
    s3Region: process.env.S3_REGION ?? 'auto',
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    s3Bucket: process.env.S3_BUCKET ?? '',
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    emailFrom: process.env.EMAIL_FROM ?? '',
    upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? '',
    upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    sentryDsn: process.env.SENTRY_DSN ?? '',
    public: {
      appEnv: process.env.APP_ENV ?? 'local',
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      sentryDsn: process.env.SENTRY_DSN ?? '',
    },
  },
});
