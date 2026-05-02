<script setup>
const route = useRoute();
const email = ref('');
const submitting = ref(false);
const sent = ref(false);
const errorMessage = ref(getErrorMessage(route.query.error));

function getErrorMessage(code) {
  if (code === 'token-invalid')
    return 'That sign-in link is invalid or already used.';
  if (code === 'token-expired')
    return 'That sign-in link has expired. Request a new one.';
  if (code === 'signin-failed')
    return 'Something went wrong while signing you in. Please try again.';
  return '';
}

async function submit() {
  if (!email.value || submitting.value) return;
  submitting.value = true;
  errorMessage.value = '';
  try {
    await $fetch('/api/auth/magic-link', {
      method: 'POST',
      body: { email: email.value },
    });
    sent.value = true;
  } catch (error) {
    errorMessage.value =
      error?.statusMessage ?? error?.message ?? 'Could not send the link.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main>
    <h1>Sign in</h1>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>

    <form v-if="!sent" @submit.prevent="submit">
      <label>
        Email
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          :disabled="submitting"
        />
      </label>
      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Sending…' : 'Send magic link' }}
      </button>
    </form>

    <p v-else>Check your email for a sign-in link.</p>
  </main>
</template>
