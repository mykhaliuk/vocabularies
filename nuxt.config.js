// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  devtools: { enabled: true },
  modules: ['@sentry/nuxt/module', '@vite-pwa/nuxt', '@nuxt/fonts'],
  fonts: {
    // Self-host the Google fonts at build: no render-blocking cross-origin
    // request, woff2 served same-origin + preloaded, fallback metrics injected
    // to keep CLS at zero. Replaces the old <link> to fonts.googleapis.com.
    // latin-only: the English copy (incl. em-dashes + curly quotes, which live
    // in the latin range) needs nothing more, and it slashes the @font-face
    // count + woff2 weight that were bloating the render-blocking CSS.
    defaults: { subsets: ['latin'] },
    families: [
      // Only the weights/styles actually used — italics are body-weight only
      // (em / gloss), Caveat carries the quote marks (500) + words (600).
      {
        name: 'Hanken Grotesk',
        provider: 'google',
        weights: [400, 500, 600, 700, 800],
        styles: ['normal'],
      },
      {
        name: 'Hanken Grotesk',
        provider: 'google',
        weights: [400, 500],
        styles: ['italic'],
      },
      { name: 'Caveat', provider: 'google', weights: [500, 600] },
    ],
  },
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
      htmlAttrs: { lang: 'en' },
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
    // Pre-generate gzip + brotli for static assets so the JS/CSS go over the
    // wire compressed (Vercel does this in prod; this makes preview/self-host
    // match and keeps transfer weight — the main mobile-perf lever — low).
    compressPublicAssets: { gzip: true, brotli: true },
  },
  routeRules: {
    // Marketing landing is fully static: prerendered to HTML at build for
    // instant first paint and full SEO. The hero form / theme toggle hydrate
    // as small islands on top of the static shell.
    '/': { prerender: true },
  },
  sentry: {
    // Upload source maps during the deploy build only when the auth token is
    // present (set SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT in the
    // Vercel env). Local / token-less builds skip upload, so dev stays fast and
    // CI doesn't need Sentry credentials.
    sourceMapsUploadOptions: { enabled: !!process.env.SENTRY_AUTH_TOKEN },
  },
  pwa: {
    registerType: 'autoUpdate',
    // injectManifest: a custom service-worker/sw.js serves the friendly
    // /offline page on failed navigations (runtime caching lives there now).
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.js',
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
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
      // Node CLI tooling (DS sync pipeline, env runner, deploy migrate) is
      // covered by oxlint; keep it out of the strict app typecheck so its
      // quick-script style doesn't gate the build. App code stays strict.
      exclude: [
        '../docs',
        '../scripts',
        '../service-worker',
        '../e2e',
        '../playwright.config.ts',
      ],
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
