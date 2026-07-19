type FetchErrorLike = {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  response?: { headers?: { get?: (name: string) => string | null } };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Translate = ReturnType<typeof useI18n>['t'];

const isFetchErrorLike = (value: unknown): value is FetchErrorLike =>
  typeof value === 'object' && value !== null;

// Map a failed magic-link request to a calm, human sentence. Network/DNS
// failures arrive as Error instances; HTTP failures carry a statusCode.
const translateError = (error: unknown, t: Translate): string => {
  if (isFetchErrorLike(error)) {
    const status = error.statusCode;
    if (status === 429) {
      const retryAfter = error.response?.headers?.get?.('Retry-After');
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return t('magicLink.errors.tooManyRetry', { seconds });
      }
      return t('magicLink.errors.tooMany');
    }
    if (status === 400) return t('magicLink.errors.invalidEmail');
    if (typeof status === 'number' && status >= 500) {
      return t('magicLink.errors.serverError');
    }
    if (typeof error.statusMessage === 'string' && error.statusMessage) {
      return error.statusMessage;
    }
  }
  if (error instanceof Error && error.message) {
    return t('magicLink.errors.networkError');
  }
  return t('magicLink.errors.generic');
};

// Shared passwordless sign-in flow: holds the email field, validity, request
// state and a friendly error. Used by both the landing hero and /login so the
// POST + error handling live in exactly one place. The cross-jar poll/claim
// flow (VKB-70) is opt-in via `pollClaim` — only /login carries the
// confirmation-code UI, so the landing hero sends a plain link (desktop
// behavior) rather than stranding a standalone PWA on a screen with no code
// input.
export const useMagicLink = (options: { pollClaim?: boolean } = {}) => {
  const { pollClaim = false } = options;
  const { t } = useI18n();
  const poll = useSigninPoll();
  const email = ref('');
  const submitting = ref(false);
  const sent = ref(false);
  const errorMessage = ref('');
  const awaitingCode = poll.awaitingCode;
  const confirming = ref(false);
  const codeError = ref('');

  const trimmedEmail = computed(() => email.value.trim());
  const validEmail = computed(() => EMAIL_RE.test(trimmedEmail.value));

  const submit = async () => {
    if (!validEmail.value || submitting.value) return;
    submitting.value = true;
    errorMessage.value = '';
    // Installed PWAs (on /login) get a poll key bound to this sign-in so they
    // can claim the session on their own jar (VKB-70); undefined otherwise.
    const pollKey = pollClaim ? poll.prepareKey(trimmedEmail.value) : undefined;
    try {
      await $fetch('/api/auth/magic-link', {
        method: 'POST',
        body: { email: trimmedEmail.value, pollKey },
      });
      sent.value = true;
      if (pollKey) poll.beginPolling();
    } catch (error) {
      errorMessage.value = translateError(error, t);
    } finally {
      submitting.value = false;
    }
  };

  const reset = () => {
    sent.value = false;
    errorMessage.value = '';
    codeError.value = '';
    // "Use a different email" discards the pending sign-in: stop polling and
    // drop the stored key so a new send mints a fresh one.
    poll.clear();
  };

  // Submit the confirmation code shown on the click page. On success the poll
  // composable navigates to /me. `invalid` keeps the input for a retry;
  // `expired` (window closed / attempt cap) returns the user to the email form
  // with a message to request a new link.
  const confirmCode = async (code: string) => {
    if (confirming.value) return;
    confirming.value = true;
    codeError.value = '';
    const result = await poll.submitCode(code);
    confirming.value = false;
    if (result === 'ready') return;
    if (result === 'invalid') codeError.value = t('login.confirm.errorInvalid');
    else if (result === 'expired') {
      sent.value = false;
      errorMessage.value = t('login.confirm.errorExpired');
    } else codeError.value = t('login.confirm.errorGeneric');
  };

  // Cold-start resume (VKB-70): iOS evicts a backgrounded PWA while the user is
  // in Mail clicking the link; on relaunch the component mounts fresh with no
  // visibilitychange and sent=false. If a still-valid poll survived in storage,
  // re-attach to it and restore the "check your inbox" state so the claim is
  // collected instead of silently showing the empty form.
  onMounted(() => {
    if (!pollClaim) return;
    const resumed = poll.resume();
    if (!resumed) return;
    email.value = resumed.email;
    sent.value = true;
  });

  return {
    email,
    trimmedEmail,
    validEmail,
    submitting,
    sent,
    errorMessage,
    submit,
    reset,
    awaitingCode,
    confirming,
    codeError,
    confirmCode,
  };
};
