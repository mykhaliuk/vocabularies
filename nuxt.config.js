import { PWA_API_CACHE, PWA_AVATARS_CACHE } from './shared/pwa-caches.js';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  devtools: { enabled: true },
  modules: ['@sentry/nuxt/module', '@vite-pwa/nuxt'],
  css: [
    '~/assets/css/tokens.css',
    '~/assets/css/theme-light.css',
    '~/assets/css/theme-dark.css',
    '~/assets/css/typography.css',
    '~/assets/css/animations.css',
    '~/assets/css/base.css',
  ],
  app: {
    head: {
      meta: [
        // Per-mode browser-chrome colour (Android Chrome address bar,
        // iOS Safari status bar). Separate from the PWA manifest
        // theme_color (which is used in standalone/install contexts).
        {
          name: 'theme-color',
          content: '#FBFEFF',
          media: '(prefers-color-scheme: light)',
        },
        {
          name: 'theme-color',
          content: '#0E1417',
          media: '(prefers-color-scheme: dark)',
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&display=swap',
        },
      ],
      script: [
        // Synchronously honour an explicit theme override stored in
        // localStorage so users with a manual choice see it on first paint
        // (no FOUC). OS preference applies automatically via the
        // @media (prefers-color-scheme: dark) block in theme-dark.css.
        {
          tagPriority: 'critical',
          innerHTML: `(function(){try{var t=localStorage.getItem('vocabu-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})();`,
        },
      ],
    },
  },
  nitro: {
    prerender: { routes: ['/offline'] },
  },
  sentry: {
    sourceMapsUploadOptions: { enabled: false },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Vocabu',
      short_name: 'Vocabu',
      description: 'Never lose your sweet moments.',
      theme_color: '#ED5379',
      background_color: '#FBFEFF',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      icons: [
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        {
          urlPattern: ({ url, sameOrigin }) =>
            sameOrigin && /^\/api\/me(\/|$|\?)/.test(url.pathname),
          handler: 'NetworkOnly',
          method: 'GET',
        },
        {
          urlPattern: ({ url, sameOrigin }) =>
            sameOrigin && url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          method: 'GET',
          options: {
            cacheName: PWA_API_CACHE,
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            cacheableResponse: { statuses: [200] },
          },
        },
        {
          urlPattern: ({ url }) =>
            url.hostname.endsWith('.r2.cloudflarestorage.com') ||
            ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
              url.port === '9100'),
          handler: 'StaleWhileRevalidate',
          method: 'GET',
          options: {
            cacheName: PWA_AVATARS_CACHE,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            cacheableResponse: { statuses: [200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        checkJs: true,
        noImplicitAny: true,
        noUncheckedIndexedAccess: true,
      },
      exclude: ['../docs'],
    },
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
