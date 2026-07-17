/* Vocabu service worker (injectManifest strategy).

   Replaces the generated SW so a failed navigation serves the friendly
   /offline page (Workbox setCatchHandler) instead of the browser's native
   offline screen. The runtime caching below mirrors the previous generateSW
   `workbox.runtimeCaching` config exactly; only the offline catch handler is
   new. setCatchHandler fires solely on a *failed* request, so /offline is
   never served while online (the bug that retired the old navigateFallback). */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { matchPrecache, precacheAndRoute } from 'workbox-precaching';
import {
  NavigationRoute,
  registerRoute,
  setCatchHandler,
} from 'workbox-routing';
import { OFFLINE_HTML } from './offline-html.js';
import {
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { PWA_API_CACHE, PWA_AVATARS_CACHE } from '../shared/pwa-caches';

// registerType: autoUpdate — take over immediately rather than waiting.
self.skipWaiting();
clientsClaim();

// Navigations to `/` go to the network first so the server-side entry-locale
// redirect (ADR-0006) and the vocabu-locale cookie are honored — `/` is also
// the PWA start_url, so without this every installed-app launch would be
// answered from the precache with the English page, bypassing the locale
// contract. Registered BEFORE precacheAndRoute (Workbox matches routes in
// registration order). Offline falls back to the precached English landing —
// same behavior as before this route existed. fetch(event.request) on a
// navigation returns an opaqueredirect the browser follows, so the 302 to
// /fr | /uk works through the SW.
registerRoute(
  ({ request, url, sameOrigin }) =>
    sameOrigin && request.mode === 'navigate' && url.pathname === '/',
  async ({ event }) => {
    try {
      return await fetch(event.request);
    } catch {
      const cached = await matchPrecache('/');
      if (cached) return cached;
      return new Response(OFFLINE_HTML, {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  },
);

// Precache the build assets injected by vite-pwa, including the prerendered
// /offline page that the catch handler serves.
precacheAndRoute(self.__WB_MANIFEST);

// --- runtime caching (mirrors the former generateSW config) ---

// /api/me* — user data, never served from cache.
registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin && /^\/api\/me(\/|$|\?)/.test(url.pathname),
  new NetworkOnly(),
  'GET',
);

// Other same-origin /api/* — network-first with a short timeout + tiny cache.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: PWA_API_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
    ],
  }),
  'GET',
);

// Avatars on R2 (or local MinIO :9100) — stale-while-revalidate.
registerRoute(
  ({ url }) =>
    url.hostname.endsWith('.r2.cloudflarestorage.com') ||
    ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      url.port === '9100'),
  new StaleWhileRevalidate({
    cacheName: PWA_AVATARS_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
  'GET',
);

// Route navigations through Workbox (NetworkOnly = always-fresh SSR, no stale
// shell) so the catch handler below can serve /offline when the network is
// gone. Without this, navigations bypass Workbox and the browser shows its
// native offline screen. Precached prerendered routes (/fr, /uk) are matched
// by precacheAndRoute above first ('/' by the network-first route at the
// top), so this only governs uncached navigations.
registerRoute(new NavigationRoute(new NetworkOnly()));

// --- offline fallback ---
// Fires only when a request fails (e.g. offline). Failed navigations get a
// self-contained offline page returned straight from the SW (inline HTML — no
// precache lookup, so no URL-normalization mismatch, and no SPA re-route since
// it isn't a Nuxt page). Anything else gets a normal network error.
setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate' || request.destination === 'document') {
    return new Response(OFFLINE_HTML, {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return Response.error();
});
