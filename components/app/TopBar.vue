<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';

// Two variants of the same 54px frosted bar (prototype chrome.jsx):
//   default — centred logo + wordmark, the authed tab shell.
//   back    — back arrow left, title centred, `right` slot on the end.
const props = withDefaults(defineProps<{ back?: boolean; title?: string }>(), {
  back: false,
  title: undefined,
});

const { t } = useI18n();
const router = useRouter();

const hasNav = computed(() => props.back || props.title !== undefined);

const goBack = () => {
  // A word reached by a CLIENT-SIDE navigation returns to the feed for
  // real: the stack shortens and the feed keeps whatever scroll it had.
  const previous = router.options.history.state.back;
  if (typeof previous === 'string') {
    router.back();
    return;
  }
  // Nothing of ours behind the word, so the feed is invented as the
  // destination. REPLACE, never push: this is an "up" affordance, and
  // pushing would park the word behind the OS back button forever, so back
  // would walk into the screen the user just left and every round trip
  // would grow the stack.
  //
  // Reached by a refresh, a pasted link, a notification — and also by a feed
  // link tapped BEFORE hydration, which the browser answers with a native
  // document navigation that leaves no router state behind. That last case
  // is an accepted limitation, not a promise kept: the feed re-renders from
  // scratch, its scroll is gone, and the feed document the browser left
  // stays behind the OS back button whatever this handler does. Only the
  // arrow's own behaviour is ours to get right here.
  void navigateTo('/feed', { replace: true });
};
</script>

<template>
  <header class="top-bar" :class="{ 'top-bar--nav': hasNav }">
    <template v-if="hasNav">
      <button
        v-if="back"
        type="button"
        class="top-bar__side top-bar__back"
        :aria-label="t('app.nav.back')"
        @click="goBack"
      >
        <ArrowLeft :size="21" aria-hidden="true" />
      </button>
      <span v-else class="top-bar__side" aria-hidden="true" />

      <!-- Chrome, not the page heading: the screen below prints its own
           <h1>, and a second one here would only repeat it. -->
      <span class="top-bar__title">{{ title }}</span>

      <slot name="right">
        <span class="top-bar__side" aria-hidden="true" />
      </slot>
    </template>

    <template v-else>
      <img
        src="/logo-mark.svg"
        alt=""
        width="22"
        height="22"
        class="top-bar__mark"
      />
      <span class="top-bar__brand">Vocabu</span>
    </template>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 54px;
  background: var(--bar-bg);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--hairline);
}

.top-bar--nav {
  gap: 0;
  padding: 0 var(--space-2);
}

.top-bar__side {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--tap-min);
  height: var(--tap-min);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-2);
}

.top-bar__back {
  cursor: pointer;
  border-radius: var(--r-pill);
  transition: transform var(--dur-fast) var(--ease-out);

  &:active {
    transform: scale(0.9);
  }
}

/* One line, clipped rather than wrapped: the bar is chrome and must keep
   its 54px however long the word below it runs. */
.top-bar__title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: var(--text-md);
  font-weight: var(--w-bold);
  letter-spacing: var(--tracking-snug);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-bar__mark {
  display: block;
  border-radius: var(--r-xs);
}

.top-bar__brand {
  font-size: 21px;
  font-weight: var(--w-bold);
  letter-spacing: -0.03em;
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .top-bar__back {
    transition: none;
  }
}
</style>
