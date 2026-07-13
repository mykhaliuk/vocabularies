<script setup lang="ts">
import type { PublicUser } from '~/server/utils/auth.d.ts';
import { PWA_API_CACHE, PWA_AVATARS_CACHE } from '~/shared/pwa-caches';

interface FetchError {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
}

const isFetchError = (value: unknown): value is FetchError =>
  typeof value === 'object' && value !== null;

const messageOf = (error: unknown, fallback: string): string => {
  if (isFetchError(error)) {
    if (typeof error.statusMessage === 'string') return error.statusMessage;
    if (typeof error.message === 'string') return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
};

const { t, locale, locales, setLocale } = useI18n();

useHead(() => ({ title: t('me.pageTitle') }));

const {
  data: me,
  error,
  refresh,
} = await useFetch<PublicUser>('/api/me', { credentials: 'include' });

if (error.value) {
  if (error.value.statusCode === 401) {
    await navigateTo('/login');
  } else {
    throw createError({
      statusCode: error.value.statusCode ?? 500,
      statusMessage: 'Failed to load profile',
      fatal: true,
    });
  }
}

const avatarUrl = ref<string | null>(null);
const avatarLoadFailure = ref<unknown>(null);
const uploading = ref(false);

type UploadFailure =
  | { kind: 'invalid-type' }
  | { kind: 'upload'; cause: unknown };
const uploadFailure = ref<UploadFailure | null>(null);

// Transient messages are derived from state at render time (not captured
// via t() when the failure happens) so they re-translate on locale switch.
const avatarError = computed(() => {
  if (avatarLoadFailure.value === null) return '';
  return messageOf(avatarLoadFailure.value, t('me.avatar.loadError'));
});

const uploadError = computed(() => {
  if (uploadFailure.value === null) return '';
  if (uploadFailure.value.kind === 'invalid-type') {
    return t('me.avatar.invalidType');
  }
  return messageOf(uploadFailure.value.cause, t('me.avatar.uploadError'));
});

async function loadAvatarUrl() {
  if (!me.value?.hasAvatar) {
    avatarUrl.value = null;
    avatarLoadFailure.value = null;
    return;
  }
  try {
    const data = await $fetch<{ url: string }>('/api/me/avatar-url');
    avatarUrl.value = data.url;
    avatarLoadFailure.value = null;
  } catch (err) {
    avatarLoadFailure.value = err;
  }
}

watchEffect(loadAvatarUrl);

async function uploadAvatar(domEvent: Event) {
  const target = domEvent.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || uploading.value) return;
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    uploadFailure.value = { kind: 'invalid-type' };
    return;
  }
  uploading.value = true;
  uploadFailure.value = null;
  try {
    const { uploadUrl, key } = await $fetch<{
      uploadUrl: string;
      key: string;
    }>('/api/me/avatar', {
      method: 'POST',
      body: { contentType: file.type },
    });
    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    if (!putResponse.ok) {
      throw new Error(`upload failed: ${putResponse.status}`);
    }
    await $fetch('/api/me/avatar/confirm', {
      method: 'POST',
      body: { key },
    });
    await refresh();
  } catch (err) {
    console.error('[me] avatar upload failed', err);
    uploadFailure.value = { kind: 'upload', cause: err };
  } finally {
    uploading.value = false;
    target.value = '';
  }
}

type DebugResult =
  | { kind: 'sending' }
  | { kind: 'unexpected' }
  | { kind: 'triggered'; code: number | string };

const debugResult = ref<DebugResult | null>(null);

const debugMessage = computed(() => {
  const result = debugResult.value;
  if (result === null) return '';
  if (result.kind === 'sending') return t('me.debug.sending');
  if (result.kind === 'unexpected') return t('me.debug.unexpected');
  return t('me.debug.triggered', { code: result.code });
});

async function triggerError() {
  debugResult.value = { kind: 'sending' };
  try {
    await $fetch('/api/dev/error');
    debugResult.value = { kind: 'unexpected' };
  } catch (err) {
    const code = isFetchError(err) ? err.statusCode : undefined;
    debugResult.value = { kind: 'triggered', code: code ?? '?' };
  }
}

const localeSwitchFailed = ref(false);
const localeError = computed(() =>
  localeSwitchFailed.value ? t('me.language.error') : '',
);

async function switchLocale(code: Parameters<typeof setLocale>[0]) {
  localeSwitchFailed.value = false;
  try {
    // Locale messages are lazy-loaded over the network on first switch;
    // without this catch a failed load is an unhandled rejection and the
    // click silently does nothing.
    await setLocale(code);
  } catch (err) {
    console.error('[me] locale switch failed', err);
    localeSwitchFailed.value = true;
  }
}

const loggingOut = ref(false);
const logoutFailed = ref(false);
const logoutError = computed(() =>
  logoutFailed.value ? t('me.logoutError') : '',
);

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutFailed.value = false;
  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('[me] logout request failed', err);
    logoutFailed.value = true;
  } finally {
    loggingOut.value = false;
  }
  if (typeof caches !== 'undefined') {
    const results = await Promise.allSettled([
      caches.delete(PWA_API_CACHE),
      caches.delete(PWA_AVATARS_CACHE),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[me] cache purge failed', result.reason);
      }
    }
  }
  await navigateTo('/');
}
</script>

<template>
  <main v-if="me">
    <h1>{{ $t('me.greeting', { name: me.displayName ?? me.email }) }}</h1>
    <p>{{ $t('me.emailLabel', { email: me.email }) }}</p>

    <section>
      <h2>{{ $t('me.avatar.title') }}</h2>
      <img
        v-if="avatarUrl"
        :src="avatarUrl"
        :alt="$t('me.avatar.alt')"
        width="128"
        height="128"
      />
      <p v-else-if="avatarError" role="alert">{{ avatarError }}</p>
      <p v-else-if="!me.hasAvatar">{{ $t('me.avatar.empty') }}</p>

      <input
        type="file"
        accept="image/png,image/jpeg"
        :disabled="uploading"
        @change="uploadAvatar"
      />
      <p v-if="uploading">{{ $t('me.avatar.uploading') }}</p>
      <p v-if="uploadError" role="alert">{{ uploadError }}</p>
    </section>

    <section>
      <h2>{{ $t('me.language.title') }}</h2>
      <div
        class="locale-chips"
        role="group"
        :aria-label="$t('me.language.title')"
      >
        <button
          v-for="loc in locales"
          :key="loc.code"
          type="button"
          class="locale-chip"
          :class="{ 'is-active': loc.code === locale }"
          :aria-pressed="loc.code === locale"
          @click="switchLocale(loc.code)"
        >
          {{ loc.name }}
        </button>
      </div>
      <p v-if="localeError" role="alert">{{ localeError }}</p>
    </section>

    <section>
      <h2>{{ $t('me.debug.title') }}</h2>
      <button type="button" @click="triggerError">
        {{ $t('me.debug.trigger') }}
      </button>
      <p v-if="debugMessage">{{ debugMessage }}</p>
    </section>

    <p v-if="logoutError" role="alert">{{ logoutError }}</p>
    <button type="button" :disabled="loggingOut" @click="logout">
      {{ loggingOut ? $t('me.signingOut') : $t('me.signOut') }}
    </button>
  </main>
</template>

<style scoped>
.locale-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.locale-chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-min);
  padding: 5px 14px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-pill);
  background: var(--surface);
  color: var(--ink-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    transform var(--dur-fast) var(--ease-out);
}

.locale-chip:active {
  transform: scale(0.97);
}

.locale-chip.is-active {
  border-color: var(--rose-200);
  background: var(--rose-50);
  color: var(--on-primary-soft);
}
</style>
