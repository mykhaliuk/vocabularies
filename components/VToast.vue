<script setup lang="ts">
import { X } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    open: boolean;
    message: string;
    dismissLabel: string;
    actionLabel?: string;
    actionBusy?: boolean;
  }>(),
  { actionLabel: undefined, actionBusy: false },
);

defineEmits<{ action: []; dismiss: [] }>();
</script>

<!-- The live region outlives its content on purpose: a region inserted
     together with its text is announced inconsistently by screen readers. -->
<template>
  <div class="v-toast" role="status" aria-live="polite">
    <Transition name="v-toast">
      <div v-if="open" class="v-toast__card">
        <p class="v-toast__message">{{ message }}</p>
        <VButton
          v-if="actionLabel"
          size="md"
          :loading="actionBusy"
          @click="$emit('action')"
        >
          {{ actionLabel }}
        </VButton>
        <button
          type="button"
          class="v-toast__dismiss"
          :aria-label="dismissLabel"
          @click="$emit('dismiss')"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Top of the screen, clear of the thumb-zone chrome, and deliberately under
   the sheets so an open modal is never interrupted. The wrapper is
   pointer-transparent, so the page stays usable around it. */
.v-toast {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 55;
  display: flex;
  justify-content: center;
  padding: calc(var(--space-3) + var(--safe-top)) var(--gutter) 0;
  pointer-events: none;
}

.v-toast__card {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: var(--app-column);
  padding: var(--space-3);
  border: 1px solid var(--hairline);
  border-radius: var(--r-card);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.v-toast__message {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-medium);
  line-height: var(--leading-snug);
  color: var(--ink);
}

.v-toast__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--tap-min);
  height: var(--tap-min);
  padding: 0;
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-out);

  &:active {
    transform: scale(0.9);
  }
}

.v-toast-enter-active,
.v-toast-leave-active {
  transition:
    transform var(--dur-base) var(--ease-out),
    opacity var(--dur-base) var(--ease-out);
}

.v-toast-enter-from,
.v-toast-leave-to {
  transform: translateY(-12px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .v-toast__dismiss,
  .v-toast-enter-active,
  .v-toast-leave-active {
    transition: none;
  }
}
</style>
