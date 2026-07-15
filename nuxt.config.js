// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  devtools: { enabled: true },
  // Agent worktrees live inside the repo at .claude/worktrees/*, each a full
  // Nuxt checkout with its own node_modules/.nuxt (~13k dirs total). chokidar
  // v5 has no fsevents and opens one fs.watch descriptor per directory, so the
  // dev watcher recursing into every worktree exhausts file descriptors
  // (EMFILE: too many open files, watch). Exclude .claude from every watcher:
  // Nuxt's own builder watcher (this `ignore`), plus Vite and Nitro below.
  ignore: ['**/.claude/**'],
  watchers: {
    chokidar: {
      ignored: [(path) => path.includes('/.claude/')],
    },
  },
  modules: [
    '@sentry/nuxt/module',
    '@vite-pwa/nuxt',
    '@nuxt/fonts',
    '@nuxtjs/i18n',
  ],
  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'uk', language: 'uk-UA', name: 'Українська', file: 'uk.json' },
    ],
    defaultLocale: 'en',
    // Single-domain mobile PWA: no /fr/ URL prefixes, locale is entirely
    // cookie/header driven (no_prefix skips i18n routing altogether).
    strategy: 'no_prefix',
    experimental: {
      // Editor autocomplete for message keys, generated from the default
      // locale. NOT a hard gate: vue-i18n keeps a plain-string t() overload,
      // so unknown keys still typecheck — `bun run i18n:check` is the
      // enforcement (key parity across locales + usage integrity).
      typedOptionsAndMessages: 'default',
    },
    detectBrowserLanguage: {
      // SSR reads Accept-Language on first visit; once a locale is set it's
      // written to this cookie, which then wins on every later request —
      // the same "explicit choice persists" contract as the theme override
      // cookie/localStorage read in `app.head.script` below.
      useCookie: true,
      cookieKey: 'vocabu-locale',
    },
  },
  fonts: {
    // Self-host the Google fonts at build: no render-blocking cross-origin
    // request, woff2 served same-origin + preloaded, fallback metrics injected
    // to keep CLS at zero. Replaces the old <link> to fonts.googleapis.com.
    // latin + cyrillic: covers the en/fr copy (incl. em-dashes + curly quotes,
    // which live in the latin range) and the uk locale's Cyrillic glyphs, so
    // Hanken Grotesk/Caveat render for all three locales instead of falling
    // back to a system font.
    defaults: { subsets: ['latin', 'cyrillic'] },
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
      // <html lang>/dir are set reactively per-locale in app.vue via
      // useLocaleHead(); no static default needed here.
      link: [
        // Icon set generated from the brand mark by scripts/generate-icons.js
        // (`bun run icons:gen`). SVG listed first so modern browsers pick it
        // over the .ico; the .ico (16x16 + 32x32 frames) is the legacy
        // fallback for browsers that don't support SVG favicons.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
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
  vite: {
    server: {
      // Agent worktrees live inside the repo (.claude/worktrees/*), each a
      // full Nuxt checkout with its own node_modules/.nuxt. Left unignored,
      // the dev watcher recurses into every copy and exhausts file-watch
      // descriptors (EMFILE: too many open files, watch).
      watch: {
        ignored: ['**/.claude/**'],
      },
    },
  },
  nitro: {
    prerender: { routes: ['/offline'] },
    // Keep Nitro's server-side file watcher out of the agent worktrees too;
    // same EMFILE reason as the Vite watch ignore above.
    watchOptions: {
      ignored: ['**/.claude/**'],
    },
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
      // Separate "any" (rounded card) and "maskable" (full-bleed paper,
      // mark inside the 80% safe zone) variants — one shared
      // "any maskable" image cannot satisfy both contracts.
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-maskable-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
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
