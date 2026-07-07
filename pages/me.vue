<script setup lang="ts">
import type { PublicUser } from '~/server/utils/auth.d.ts';
import { PWA_API_CACHE, PWA_AVATARS_CACHE } from '~/shared/pwa-caches.js';

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

const { t } = useI18n();

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
const avatarError = ref('');
const uploading = ref(false);
const uploadError = ref('');

async function loadAvatarUrl() {
  if (!me.value?.hasAvatar) {
    avatarUrl.value = null;
    return;
  }
  try {
    const data = await $fetch<{ url: string }>('/api/me/avatar-url');
    avatarUrl.value = data.url;
    avatarError.value = '';
  } catch (err) {
    avatarError.value = messageOf(err, t('me.avatar.loadError'));
  }
}

watchEffect(loadAvatarUrl);

async function uploadAvatar(domEvent: Event) {
  const target = domEvent.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file || uploading.value) return;
  if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
    uploadError.value = t('me.avatar.invalidType');
    return;
  }
  uploading.value = true;
  uploadError.value = '';
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
    uploadError.value = messageOf(err, t('me.avatar.uploadError'));
  } finally {
    uploading.value = false;
    target.value = '';
  }
}

const triggerErrorState = ref('');

async function triggerError() {
  triggerErrorState.value = t('me.debug.sending');
  try {
    await $fetch('/api/dev/error');
    triggerErrorState.value = t('me.debug.unexpected');
  } catch (err) {
    const code = isFetchError(err) ? err.statusCode : undefined;
    triggerErrorState.value = t('me.debug.triggered', { code: code ?? '?' });
  }
}

const loggingOut = ref(false);
const logoutError = ref('');

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('[me] logout request failed', err);
    logoutError.value = t('me.logoutError');
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
      <h2>{{ $t('me.debug.title') }}</h2>
      <button type="button" @click="triggerError">
        {{ $t('me.debug.trigger') }}
      </button>
      <p v-if="triggerErrorState">{{ triggerErrorState }}</p>
    </section>

    <p v-if="logoutError" role="alert">{{ logoutError }}</p>
    <button type="button" :disabled="loggingOut" @click="logout">
      {{ loggingOut ? $t('me.signingOut') : $t('me.signOut') }}
    </button>
  </main>
</template>
