<script setup lang="ts">
import type { LocationQueryValue } from 'vue-router';
import { ArrowRight, ExternalLink, Mail } from 'lucide-vue-next';

definePageMeta({ layout: false });
useHead({ title: 'Sign in · Vocabu' });

const route = useRoute();
const email = ref('');
const submitting = ref(false);
const sent = ref(false);
const errorMessage = ref(getErrorMessage(route.query.error));
const inputRef = ref<HTMLInputElement | null>(null);

const trimmedEmail = computed(() => email.value.trim());
const validEmail = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail.value),
);

function getErrorMessage(
  code: LocationQueryValue | LocationQueryValue[] | undefined,
): string {
  if (code === 'token-invalid')
    return "That link is no longer valid. We'll send a fresh one.";
  if (code === 'token-expired')
    return "That link expired. Ask for a new one and you're in.";
  if (code === 'signin-failed')
    return 'Something got tangled signing you in. Try again.';
  return '';
}

type FetchErrorLike = {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  response?: { headers?: { get?: (name: string) => string | null } };
};

function isFetchErrorLike(value: unknown): value is FetchErrorLike {
  return typeof value === 'object' && value !== null;
}

function translateError(error: unknown): string {
  if (isFetchErrorLike(error)) {
    const status = error.statusCode;
    if (status === 429) {
      const retryAfter = error.response?.headers?.get?.('Retry-After');
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return `Too many tries. Wait ${seconds}s and try again.`;
      }
      return 'Too many tries. Wait a moment and try again.';
    }
    if (status === 400) return "That email doesn't look right. Try again.";
    if (typeof status === 'number' && status >= 500) {
      return 'Our side hiccuped. Try again in a moment.';
    }
    if (typeof error.statusMessage === 'string' && error.statusMessage) {
      return error.statusMessage;
    }
  }
  if (error instanceof Error && error.message) {
    // Network / DNS / CORS errors land here with messages like
    // "Failed to fetch" — translate to something friendlier.
    return "We couldn't reach Vocabu. Check your connection and try again.";
  }
  return "We couldn't send the link. Try again in a moment.";
}

async function submit() {
  if (!validEmail.value || submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    await $fetch('/api/auth/magic-link', {
      method: 'POST',
      body: { email: trimmedEmail.value },
    });
    sent.value = true;
  } catch (error) {
    errorMessage.value = translateError(error);
  } finally {
    submitting.value = false;
  }
}

function useDifferentEmail() {
  sent.value = false;
  errorMessage.value = '';
  nextTick(() => inputRef.value?.focus());
}

async function resend() {
  if (submitting.value) return;
  errorMessage.value = '';
  await submit();
}
</script>

<template>
  <main class="auth">
    <div class="auth__inner">
      <section v-if="!sent" class="auth__panel auth__panel--enter">
        <header class="auth__brand">
          <img
            src="/logo-mark.svg"
            alt=""
            width="56"
            height="56"
            class="auth__logo"
          />
          <h1 class="auth__title">Vocabu</h1>
          <p class="auth__tagline">Never lose your sweet moments.</p>
        </header>

        <p v-if="errorMessage" role="alert" class="auth__error">
          {{ errorMessage }}
        </p>

        <form class="auth__form" novalidate @submit.prevent="submit">
          <label for="email" class="auth__label">Your email</label>
          <input
            id="email"
            ref="inputRef"
            v-model="email"
            class="auth__input"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@email.com"
            :readonly="submitting"
          />

          <VButton
            type="submit"
            variant="primary"
            size="lg"
            full
            :loading="submitting"
            :disabled="!validEmail"
          >
            Send me a link
            <template #right>
              <ArrowRight :size="18" />
            </template>
          </VButton>

          <p class="auth__hint">
            No passwords. We'll email you a link to sign in.
          </p>
        </form>
      </section>

      <section
        v-else
        class="auth__panel auth__panel--sent"
        role="status"
        aria-live="polite"
      >
        <div class="auth__sent-icon" aria-hidden="true">
          <Mail :size="32" />
        </div>
        <h2 class="auth__sent-title">Check your inbox</h2>
        <p class="auth__sent-body">
          We sent a sign-in link to<br />
          <span class="auth__sent-email">{{ trimmedEmail }}</span>
        </p>

        <p v-if="errorMessage" role="alert" class="auth__error">
          {{ errorMessage }}
        </p>

        <div class="auth__sent-cta">
          <VButton
            variant="blue"
            size="lg"
            full
            :href="`mailto:${trimmedEmail}`"
            target="_blank"
          >
            <template #left>
              <ExternalLink :size="18" />
            </template>
            Open my inbox
          </VButton>
        </div>

        <div class="auth__sent-actions">
          <button
            class="auth__sent-link"
            type="button"
            @click="useDifferentEmail"
          >
            Use a different email
          </button>
          <p class="auth__sent-resend">
            Didn't get it?
            <button
              class="auth__sent-resend-btn"
              type="button"
              :disabled="submitting"
              @click="resend"
            >
              {{ submitting ? 'Sending…' : 'Resend' }}
            </button>
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Native CSS nesting supports compound (&.mod), pseudo (&:hover), and
   descendant (& .child) — but NOT BEM concatenation (&__inner is invalid).
   So child class rules live at top level; nesting is reserved for states. */

.auth {
  position: relative;
  min-height: 100dvh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding: 0 28px calc(20px + var(--safe-bottom));
}

.auth__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 360px;
  width: 100%;
  margin: 0 auto;
}

.auth__panel {
  animation: vfadeup var(--dur-slow) var(--ease-out);

  &.auth__panel--sent {
    text-align: center;
  }
}

.auth__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: var(--space-8);
}

.auth__logo {
  border-radius: var(--r-md);
  margin-bottom: 18px;
}

.auth__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 30px;
  font-weight: var(--w-extra);
  letter-spacing: -0.03em;
  color: var(--text);
}

.auth__tagline {
  margin: 10px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text-muted);
  line-height: var(--leading-normal);
}

.auth__error {
  margin: 0 0 var(--space-4);
  padding: 10px var(--space-3);
  border-radius: var(--r-sm);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
  text-align: start;
}

.auth__panel--sent .auth__error {
  margin: var(--space-4) 0 0;
}

.auth__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth__label {
  display: block;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: var(--w-bold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: -8px; /* tighten to input */
}

.auth__input {
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text);
  background: var(--surface);
  border-radius: var(--r-sm);
  padding: 14px 15px;
  border: 1.5px solid var(--hairline-2);
  outline: none;
  transition:
    border-color var(--dur-fast),
    box-shadow var(--dur-fast);

  &::placeholder {
    color: var(--text-faint);
  }

  &:focus-visible {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-soft);
  }

  &:read-only {
    background: var(--surface-sunk);
  }
}

.auth__hint {
  margin: 0;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--text-faint);
  line-height: var(--leading-normal);
}

/* --- sent phase --- */
.auth__sent-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin: 0 auto var(--space-6);
  background: var(--secondary-soft);
  color: var(--secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vpop 360ms var(--ease-out);
}

.auth__sent-title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: var(--w-bold);
  letter-spacing: var(--tracking-snug);
  color: var(--text);
}

.auth__sent-body {
  margin: var(--space-3) 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text-muted);
  line-height: var(--leading-normal);
}

.auth__sent-email {
  font-weight: var(--w-semibold);
  color: var(--text);
}

.auth__sent-cta {
  display: block;
  margin-top: var(--space-6);
}

.auth__sent-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--space-4);
}

.auth__sent-link {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  color: var(--text-muted);
  padding: 10px var(--space-1);
  min-height: var(--tap-min);
}

.auth__sent-resend {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-faint);
}

.auth__sent-resend-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--w-semibold);
  color: var(--link);
  padding: var(--space-1);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
