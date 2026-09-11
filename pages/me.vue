<script setup lang="ts">
import type { MeResponse, PublicUser } from '~/server/utils/auth';
import { DISPLAY_NAME_MAX } from '~/shared/display-name';
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

// lazy: an awaited fetch here suspends the client route transition (VKB-149).
const {
  data: me,
  error,
  status,
} = await useFetch<MeResponse>('/api/me', {
  credentials: 'include',
  lazy: true,
});

const answerLoadFailure = async (failure: FetchError) => {
  if (failure.statusCode === 401) {
    await navigateTo('/login');
    return;
  }
  const fatal = createError({
    statusCode: failure.statusCode ?? 500,
    statusMessage: 'Failed to load profile',
    fatal: true,
  });
  // Thrown on the server so SSR renders the error page; a client-side load
  // settles after setup, where only showError can still reach the page.
  if (import.meta.server) throw fatal;
  showError(fatal);
};

if (error.value) await answerLoadFailure(error.value);
watch(error, async (failure) => {
  if (!failure) return;
  try {
    await answerLoadFailure(failure);
  } catch (redirectError) {
    // navigateTo can reject (stale precache, failed chunk); without the error
    // page the screen would sit empty, with no data and no way back.
    console.error('[me] sign-in redirect failed', redirectError);
    showError(
      createError({
        statusCode: 500,
        statusMessage: 'Failed to load profile',
        fatal: true,
      }),
    );
  }
});

const isLoading = computed(() => status.value === 'pending' && !me.value);

const avatarUrl = ref<string | undefined>();
const avatarLoadFailure = ref<unknown>(null);
const uploading = ref(false);

type UploadFailure =
  | { kind: 'invalid-type' }
  | { kind: 'upload'; cause: unknown };
const uploadFailure = ref<UploadFailure | null>(null);

const nameDraft = ref('');
const savingName = ref(false);
const nameSaveFailed = ref(false);
const nameSaved = ref(false);

watch(
  () => me.value?.displayName,
  (value) => {
    nameDraft.value = value ?? '';
  },
  { immediate: true },
);

const trimmedName = computed(() => nameDraft.value.trim());
// `!uploading`: uploadAvatar ends with its own /api/me state write, and a
// save landing between the avatar PATCH and that write would be overwritten.
const canSaveName = computed(
  () =>
    trimmedName.value.length > 0 &&
    trimmedName.value !== (me.value?.displayName ?? '') &&
    !savingName.value &&
    !uploading.value,
);

const nameError = computed(() =>
  nameSaveFailed.value ? t('me.name.error') : '',
);

const nameSavedMessage = computed(() =>
  nameSaved.value ? t('me.name.saved') : '',
);

function onNameInput() {
  nameSaved.value = false;
  nameSaveFailed.value = false;
}

// Not @keydown.enter="saveName": Vue's .enter modifier checks only the key,
// so it would also fire on the Enter that commits an IME composition — with
// the pre-composition draft.
function onNameEnter(keyEvent: KeyboardEvent) {
  if (!keyEvent.isComposing) saveName();
}

async function saveName() {
  if (!canSaveName.value) return;
  const displayName = trimmedName.value;
  savingName.value = true;
  nameSaveFailed.value = false;
  try {
    // The PATCH response is merged into `me` instead of refresh(): refresh
    // swallows its own fetch error and resets `me` to undefined, which would
    // unmount the page while reporting success.
    const updated = await $fetch<PublicUser>('/api/me', {
      method: 'PATCH',
      body: { displayName },
    });
    if (me.value) me.value = { ...me.value, ...updated };
    nameSaved.value = true;
  } catch (err) {
    console.error('[me] display name save failed', err);
    if (isFetchError(err) && err.statusCode === 401) {
      await navigateTo('/login');
      return;
    }
    nameSaveFailed.value = true;
  } finally {
    savingName.value = false;
  }
}

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
    avatarUrl.value = undefined;
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

// Keyed on hasAvatar, not watchEffect: the name-save merge replaces
// me.value's identity, and an identity-tracking effect would re-sign and
// re-download an unchanged avatar on every rename.
watch(
  () => me.value?.hasAvatar,
  () => loadAvatarUrl(),
  { immediate: true },
);

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
    // Same merge-not-refresh treatment as saveName: confirm returns the
    // updated PublicUser, and refresh() failing here would blank the page
    // after an upload that worked.
    const hadAvatar = me.value?.hasAvatar === true;
    const updated = await $fetch<PublicUser>('/api/me/avatar/confirm', {
      method: 'POST',
      body: { key },
    });
    if (me.value) me.value = { ...me.value, ...updated };
    // Replacing an avatar stores a new key while hasAvatar stays true, so
    // the keyed watch above won't re-sign the URL — do it explicitly.
    if (hadAvatar) await loadAvatarUrl();
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
  // Same privacy motive as the cache purge above: logout navigates
  // client-side, so the feed's in-memory caches (pages/feed.vue) would
  // otherwise survive into the next account's session.
  clearNuxtState(['feed-cache-entries', 'feed-cache-cursor']);
  clearNuxtData('feed');
  await navigateTo('/');
}
</script>

<template>
  <main v-if="me">
    <!-- /me sits outside the app shell. In standalone there is no address bar,
         so without this the only way back is the OS back gesture. -->
    <p>
      <NuxtLink to="/feed">{{ $t('me.backToFeed') }}</NuxtLink>
    </p>
    <h1>{{ $t('me.greeting', { name: me.displayName ?? me.email }) }}</h1>
    <p>{{ $t('me.emailLabel', { email: me.email }) }}</p>

    <section>
      <h2>{{ $t('me.name.title') }}</h2>
      <div class="name-row">
        <input
          v-model="nameDraft"
          class="name-input"
          type="text"
          :maxlength="DISPLAY_NAME_MAX"
          :placeholder="$t('me.name.placeholder')"
          :aria-label="$t('me.name.title')"
          :readonly="savingName"
          @input="onNameInput"
          @keydown.enter="onNameEnter"
        />
        <VButton
          class="name-save"
          :loading="savingName"
          :disabled="!canSaveName"
          @click="saveName"
        >
          {{ $t('me.name.save') }}
        </VButton>
      </div>
      <p v-if="nameError" role="alert">{{ nameError }}</p>
      <!-- Always present: a live region announces only content CHANGES, so a
           conditionally-inserted one is never read out. -->
      <p class="name-status" role="status">{{ nameSavedMessage }}</p>
    </section>

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
  <p v-else-if="isLoading" class="me-loading" role="status">
    {{ $t('me.loading') }}
  </p>
</template>

<style scoped>
/* The greeting and email line render the raw address; a long unbroken one
   must wrap instead of widening the page past the phone viewport. */
main {
  overflow-wrap: anywhere;
}

.name-row {
  display: flex;
  gap: var(--space-2);
  max-width: 420px;
}

.name-input {
  flex: 1;
  min-width: 0;
  min-height: var(--tap-min);
  padding: 5px 12px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-md);
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  transition:
    border-color var(--dur-fast),
    box-shadow var(--dur-fast);
}

.name-input::placeholder {
  color: var(--text-faint);
}

.name-input:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.name-input:read-only {
  background: var(--surface-sunk);
}

.name-status:empty {
  margin: 0;
}

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
