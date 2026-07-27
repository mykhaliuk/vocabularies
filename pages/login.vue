<script setup lang="ts">
import type { LocationQueryValue } from 'vue-router';
import { ArrowRight, KeyRound, Mail } from 'lucide-vue-next';
import { CONFIRM_CODE_LENGTH, CONFIRM_CODE_PATTERN } from '~/shared/magic-link';

definePageMeta({ layout: false });

const { t } = useI18n();
useHead(() => ({ title: t('login.pageTitle') }));

const route = useRoute();
const {
  email,
  trimmedEmail,
  validEmail,
  submitting,
  sent,
  errorMessage,
  submit,
  reset,
  pollActive,
  confirming,
  codeError,
  confirmCode,
} = useMagicLink({ pollClaim: true });
const inputRef = ref<HTMLInputElement | null>(null);
const code = ref('');
const validCode = computed(() => CONFIRM_CODE_PATTERN.test(code.value));

async function onConfirm() {
  if (!validCode.value || confirming.value) return;
  await confirmCode(code.value);
}

// An authenticated visitor has no business on the sign-in screen — send them to
// the app. This covers every route in (the installed-PWA launch hands off here,
// plus bookmarks, the back button, a shared link), not just the PWA case. The
// probe is advisory only: `hasSession()` resolves false on 401 / offline /
// timeout, so a failed probe simply leaves the form in place rather than
// blocking. No loop — /feed sends only *unauthenticated* visitors back here.
onMounted(async () => {
  try {
    // The standalone landing hands off after establishing there is no session;
    // consume that instead of paying for the same probe twice in one launch.
    if (takeSignedOutHandoff()) return;
    if (await hasSession()) await navigateTo('/feed', { replace: true });
  } catch (error) {
    // hasSession() cannot reject (the probe swallows everything), but
    // navigateTo() can — a stale service-worker precache / failed chunk load
    // after a deploy rejects the navigation. Operational error: log and leave
    // the sign-in form in place, which is already the correct fallback here.
    console.error('[login] auth guard failed', error);
  }
});

// Surface auth-callback failures (expired / invalid link) routed here as
// ?error=... by server/api/auth/callback.get.js.
errorMessage.value = getErrorMessage(route.query.error);

function getErrorMessage(
  code: LocationQueryValue | LocationQueryValue[] | undefined,
): string {
  if (code === 'token-invalid') return t('login.errors.tokenInvalid');
  if (code === 'token-expired') return t('login.errors.tokenExpired');
  if (code === 'signin-failed') return t('login.errors.signinFailed');
  if (code === 'too-many') return t('login.errors.tooMany');
  return '';
}

function useDifferentEmail() {
  reset();
  code.value = '';
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
          <h1 class="auth__title">{{ $t('login.brand') }}</h1>
          <p class="auth__tagline">{{ $t('login.tagline') }}</p>
        </header>

        <p v-if="errorMessage" role="alert" class="auth__error">
          {{ errorMessage }}
        </p>

        <form class="auth__form" novalidate @submit.prevent="submit">
          <label for="email" class="auth__label">{{
            $t('login.emailLabel')
          }}</label>
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
            {{ $t('login.submit') }}
            <template #right>
              <ArrowRight :size="18" />
            </template>
          </VButton>

          <p class="auth__hint">
            {{ $t('login.hint') }}
          </p>
        </form>
      </section>

      <section
        v-else
        class="auth__panel auth__panel--sent"
        role="status"
        aria-live="polite"
      >
        <!-- Installed standalone PWA (poll/claim flow): the emailed link opens
             in Safari — a separate jar that can't sign the app in — so the code
             must be entered here. Show the "open the link" message AND the code
             field together from the first render; don't wait for the poll to
             observe the click (VKB-70 FIX 2). -->
        <template v-if="pollActive">
          <div class="auth__sent-icon" aria-hidden="true">
            <KeyRound :size="32" />
          </div>
          <h2 class="auth__sent-title">{{ $t('login.confirm.title') }}</h2>
          <p class="auth__sent-body">
            {{ $t('login.confirm.standaloneBody') }}<br />
            <span class="auth__sent-email">{{ trimmedEmail }}</span>
          </p>

          <form class="auth__code-form" novalidate @submit.prevent="onConfirm">
            <label for="code" class="auth__label">
              {{ $t('login.confirm.codeLabel') }}
            </label>
            <input
              id="code"
              v-model="code"
              class="auth__input auth__code-input"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              :maxlength="CONFIRM_CODE_LENGTH"
              placeholder="0000"
              :readonly="confirming"
            />

            <VButton
              type="submit"
              variant="primary"
              size="lg"
              full
              :loading="confirming"
              :disabled="!validCode"
            >
              {{
                confirming
                  ? $t('login.confirm.submitting')
                  : $t('login.confirm.submit')
              }}
            </VButton>

            <p v-if="codeError" role="alert" class="auth__error">
              {{ codeError }}
            </p>
          </form>
        </template>

        <!-- Desktop / browser: the link opens in the same jar and just signs
             the user in, so this screen only confirms the send. No code field;
             byte-identical to before. -->
        <template v-else>
          <div class="auth__sent-icon" aria-hidden="true">
            <Mail :size="32" />
          </div>
          <h2 class="auth__sent-title">{{ $t('login.sentTitle') }}</h2>
          <p class="auth__sent-body">
            {{ $t('login.sentBody') }}<br />
            <span class="auth__sent-email">{{ trimmedEmail }}</span>
          </p>
        </template>

        <p v-if="errorMessage" role="alert" class="auth__error">
          {{ errorMessage }}
        </p>

        <div class="auth__sent-actions">
          <button
            class="auth__sent-link"
            type="button"
            @click="useDifferentEmail"
          >
            {{ $t('login.useDifferentEmail') }}
          </button>
          <!-- Always available: a failed confirm leaves the user on this
               screen, so asking for a fresh link must always be one tap away.
               Never gated on poll state — that is what turned a failed confirm
               into a dead end. -->
          <p class="auth__sent-resend">
            {{ $t('login.resendPrompt') }}
            <button
              class="auth__sent-resend-btn"
              type="button"
              :disabled="submitting"
              @click="resend"
            >
              {{ submitting ? $t('login.resending') : $t('login.resend') }}
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

/* --- confirmation code --- */
.auth__code-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-6);
  text-align: start;
}

.auth__code-input {
  text-align: center;
  font-size: var(--text-xl);
  font-weight: var(--w-bold);
  /* Letter-spacing pushes the text right; pad the start back so it reads
     centered rather than shifted. */
  letter-spacing: 0.4em;
  padding-inline-start: calc(15px + 0.4em);
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
