<script setup lang="ts">
// Offers the waiting service worker to the user instead of reloading the page
// under them (ADR-0015). $pwa is client-only, so this renders as an empty live
// region on the server and on any browser without service workers.
const { t } = useI18n();
const pwa = usePWA();
const router = useRouter();

const RELOAD_FALLBACK_MS = 4000;
const CHECK_THROTTLE_MS = 60_000;

const isReloading = ref(false);
const isOpen = computed(() => pwa?.needRefresh === true);

let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let stopRouterHook: (() => void) | null = null;
let lastCheckedAt = 0;

const getRegistration = async () => {
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (error) {
    console.error('[UpdatePrompt] registration lookup failed', error);
    return undefined;
  }
};

// The browser looks for a new worker at registration and nowhere else.
const checkForUpdate = async () => {
  if (!navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheckedAt < CHECK_THROTTLE_MS) return;
  lastCheckedAt = now;
  const registration = await getRegistration();
  try {
    await registration?.update();
  } catch (error) {
    console.error('[UpdatePrompt] update check failed', error);
  }
};

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') void checkForUpdate();
};

const onReload = async () => {
  if (isReloading.value) return;
  isReloading.value = true;

  // updateServiceWorker() silently does nothing when no worker is waiting, so
  // the accept path's one real failure is invisible unless checked for here.
  const registration = await getRegistration();
  if (!registration?.waiting) {
    console.error('[UpdatePrompt] no waiting worker; reloading instead');
    window.location.reload();
    return;
  }

  void pwa?.updateServiceWorker(true);
  // The reload rides on the waiting worker taking over. Reload anyway if it
  // never answers, so the button cannot spin forever over a stale bundle.
  fallbackTimer = setTimeout(
    () => window.location.reload(),
    RELOAD_FALLBACK_MS,
  );
};

const onDismiss = () => {
  // Declining after tapping Reload has to disarm that reload, or the page
  // drops out from under a user who just said no.
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  isReloading.value = false;
  void pwa?.cancelPrompt();
};

onMounted(() => {
  if (!('serviceWorker' in navigator)) return;
  lastCheckedAt = Date.now();
  stopRouterHook = router.afterEach(() => void checkForUpdate());
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  if (fallbackTimer !== null) clearTimeout(fallbackTimer);
  if (stopRouterHook !== null) stopRouterHook();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
  <VToast
    :open="isOpen"
    :message="t('update.ready')"
    :action-label="t('update.reload')"
    :dismiss-label="t('update.dismiss')"
    :action-busy="isReloading"
    @action="onReload"
    @dismiss="onDismiss"
  />
</template>
