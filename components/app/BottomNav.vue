<script setup lang="ts">
import { Bookmark, Feather, Home, Search, User } from 'lucide-vue-next';

const { t } = useI18n();

const tabs = computed(() => [
  { to: '/feed', icon: Home, label: t('app.nav.feed') },
  { to: '/discover', icon: Search, label: t('app.nav.discover') },
  { to: '/saved', icon: Bookmark, label: t('app.nav.saved') },
  { to: '/profile', icon: User, label: t('app.nav.profile') },
]);
</script>

<!-- Floating glass pill nav with a raised compose FAB between the tab
     pairs (prototype chrome.jsx). The wrapper is pointer-transparent so
     the page stays scrollable around the pill. -->
<template>
  <div class="bottom-nav">
    <nav class="bottom-nav__pill" :aria-label="t('app.nav.label')">
      <NuxtLink
        v-for="tab in tabs.slice(0, 2)"
        :key="tab.to"
        :to="tab.to"
        class="bottom-nav__tab"
        :aria-label="tab.label"
      >
        <component :is="tab.icon" :size="23" />
        <span class="bottom-nav__dot" aria-hidden="true" />
      </NuxtLink>
      <div class="bottom-nav__fab-slot">
        <!-- Visual + layout contract only for now: the compose sheet it
             opens lands with VKB-67. -->
        <button
          type="button"
          class="bottom-nav__fab"
          :aria-label="t('app.nav.compose')"
        >
          <Feather :size="24" />
        </button>
      </div>
      <NuxtLink
        v-for="tab in tabs.slice(2)"
        :key="tab.to"
        :to="tab.to"
        class="bottom-nav__tab"
        :aria-label="tab.label"
      >
        <component :is="tab.icon" :size="23" />
        <span class="bottom-nav__dot" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 var(--gutter) calc(14px + var(--safe-bottom));
  pointer-events: none;
}

.bottom-nav__pill {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-pill);
  background: color-mix(in oklch, var(--surface) 80%, transparent);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow: var(--shadow-lg);
}

.bottom-nav__tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 48px;
  color: var(--ink-3);
  text-decoration: none;

  /* vue-router marks the exact-active link; the DS active color + dot
     hang off that attribute instead of a JS active flag. */
  &[aria-current='page'] {
    color: var(--primary);

    & .bottom-nav__dot {
      background: var(--primary);
    }
  }
}

.bottom-nav__dot {
  width: 5px;
  height: 5px;
  margin-top: 5px;
  border-radius: var(--r-pill);
  background: transparent;
  transition: background var(--dur-fast);
}

.bottom-nav__fab-slot {
  position: relative;
  width: 60px;
  height: 48px;
}

.bottom-nav__fab {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) translateY(-14px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 3px solid var(--paper);
  border-radius: var(--r-pill);
  background: var(--primary);
  color: var(--text-on-accent);
  cursor: pointer;
  box-shadow: var(--shadow-float);
  transition: transform var(--dur-fast) var(--ease-out);

  &:active {
    transform: translate(-50%, -50%) translateY(-14px) scale(0.94);
  }
}
</style>
