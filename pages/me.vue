<script setup>
const { data: me, error } = await useFetch('/api/me', {
  credentials: 'include',
});

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

const loggingOut = ref(false);
const logoutError = ref('');

async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = '';
  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    // best-effort: still navigate away. Cookie is HttpOnly; if logout failed
    // server-side, the next protected request will surface the issue.
    console.error('[me] logout request failed', err);
    logoutError.value = 'Logout request failed; navigating anyway.';
  } finally {
    loggingOut.value = false;
  }
  await navigateTo('/');
}
</script>

<template>
  <main v-if="me">
    <h1>Hello, {{ me.displayName ?? me.email }}</h1>
    <p>email: {{ me.email }}</p>
    <p v-if="logoutError" role="alert">{{ logoutError }}</p>
    <button type="button" :disabled="loggingOut" @click="logout">
      {{ loggingOut ? 'Signing out…' : 'Sign out' }}
    </button>
  </main>
</template>
