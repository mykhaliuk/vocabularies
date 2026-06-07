type FetchErrorLike = {
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  response?: { headers?: { get?: (name: string) => string | null } };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isFetchErrorLike = (value: unknown): value is FetchErrorLike =>
  typeof value === 'object' && value !== null;

// Map a failed magic-link request to a calm, human sentence. Network/DNS
// failures arrive as Error instances; HTTP failures carry a statusCode.
const translateError = (error: unknown): string => {
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
    return "We couldn't reach Vocabu. Check your connection and try again.";
  }
  return "We couldn't send the link. Try again in a moment.";
};

// Shared passwordless sign-in flow: holds the email field, validity, request
// state and a friendly error. Used by both the landing hero and /login so the
// POST + error handling live in exactly one place.
export const useMagicLink = () => {
  const email = ref('');
  const submitting = ref(false);
  const sent = ref(false);
  const errorMessage = ref('');

  const trimmedEmail = computed(() => email.value.trim());
  const validEmail = computed(() => EMAIL_RE.test(trimmedEmail.value));

  const submit = async () => {
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
  };

  const reset = () => {
    sent.value = false;
    errorMessage.value = '';
  };

  return {
    email,
    trimmedEmail,
    validEmail,
    submitting,
    sent,
    errorMessage,
    submit,
    reset,
  };
};
