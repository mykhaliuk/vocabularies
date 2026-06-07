<script setup lang="ts">
import { CloudOff, RefreshCw } from 'lucide-vue-next';

definePageMeta({ layout: false });
useHead({ title: 'Offline · Vocabu' });

const checking = ref(false);
const stillOffline = ref(false);

// Best-effort connectivity probe. navigator.onLine alone is unreliable (it
// only flips when the OS knows it's offline — captive portals and broken
// upstreams report online), so we also try a tiny GET against /api/health.
// On success we reload; on failure or true offline we show the inline hint.
async function retry() {
  if (checking.value) return;
  checking.value = true;
  stillOffline.value = false;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    checking.value = false;
    stillOffline.value = true;
    return;
  }

  try {
    // Cap the probe so half-broken connectivity (captive portal, hung TLS,
    // dead DNS) doesn't leave the user staring at a spinner.
    const response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (typeof window !== 'undefined') window.location.reload();
  } catch {
    stillOffline.value = true;
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <main class="offline">
    <div class="offline__inner">
      <div class="offline__icon" aria-hidden="true">
        <CloudOff :size="38" />
      </div>
      <h1 class="offline__title">You're offline</h1>
      <p class="offline__body">
        Your words are safe — kept right here. We'll sync the moment you're
        back.
      </p>
      <div class="offline__cta">
        <VButton
          variant="secondary"
          size="lg"
          :loading="checking"
          @click="retry"
        >
          <template v-if="!checking" #left>
            <RefreshCw :size="18" />
          </template>
          {{ checking ? 'Checking…' : 'Try again' }}
        </VButton>
      </div>
      <p
        v-if="stillOffline"
        role="status"
        aria-live="polite"
        class="offline__note"
      >
        Still no signal. We'll be here when you're back.
      </p>
    </div>
  </main>
</template>

<style scoped>
.offline {
  position: relative;
  min-height: 100dvh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 36px calc(var(--space-6) + var(--safe-bottom));
}

.offline__inner {
  max-width: 320px;
  animation: vfadeup var(--dur-slow) var(--ease-out);
}

.offline__icon {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  margin: 0 auto var(--space-6);
  background: var(--surface-sunk);
  color: var(--text-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: vfloat 3.4s var(--ease-in-out) infinite;
}

.offline__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 25px;
  font-weight: var(--w-bold);
  letter-spacing: var(--tracking-snug);
  color: var(--text);
}

.offline__body {
  margin: var(--space-3) 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  color: var(--text-muted);
  line-height: var(--leading-normal);
}

.offline__cta {
  margin-top: var(--space-6);
  display: inline-flex;
}

.offline__note {
  margin: var(--space-4) 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text-faint);
  line-height: var(--leading-snug);
}
</style>
