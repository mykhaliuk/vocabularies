import type { RouteLocationNormalized } from 'vue-router';

// Session guard for the authed tab pages. Three-valued on purpose (see
// composables/useSession.ts): only a definite 401 redirects to /login;
// transport failures and 5xx let the page render, because the server stays
// the sole authority on every data request.
const routeUsesAuth = (route: RouteLocationNormalized): boolean => {
  const middleware = route.meta.middleware;
  const list = Array.isArray(middleware) ? middleware : [middleware];
  return list.includes('auth');
};

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.server) {
    const headers = useRequestHeaders(['cookie']);
    try {
      // retry: false — ofetch retries a GET once by default, which would
      // double the delay of the render-through path on a 5xx.
      await $fetch('/api/me', { headers, retry: false });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401) return navigateTo('/login');
      console.error('[auth] session probe failed, rendering through', error);
    }
    return;
  }

  // The SSR leg above already answered for this very navigation — don't pay
  // a second probe during hydration.
  const nuxtApp = useNuxtApp();
  if (nuxtApp.isHydrating && nuxtApp.payload.serverRendered) return;

  // Hops between already-guarded routes (bottom-nav tab taps) skip the
  // probe too: entry into the authed area was checked, and the server
  // re-authorizes every data request anyway.
  if (routeUsesAuth(from) && routeUsesAuth(to)) return;

  if ((await probeSession()) === 'none') {
    // Definite 401: hand the answer to /login so its own guard does not
    // re-probe the endpoint that just said no (useSession.ts contract).
    markSignedOutHandoff();
    return navigateTo('/login');
  }
});
