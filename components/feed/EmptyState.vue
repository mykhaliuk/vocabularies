<script setup lang="ts">
import { Feather } from 'lucide-vue-next';

const { t } = useI18n();
</script>

<template>
  <div class="empty">
    <div class="empty__badge">
      <Feather :size="32" />
    </div>
    <h2 class="empty__title">{{ t('app.feed.empty.title') }}</h2>
    <p class="empty__subtitle">{{ t('app.feed.empty.subtitle') }}</p>

    <!-- Handwritten hint + arrow guiding the eye down to the compose FAB. -->
    <div class="empty__hint" aria-hidden="true">
      <span class="empty__hint-text">{{ t('app.feed.empty.hint') }}</span>
      <svg
        class="empty__arrow"
        width="46"
        height="68"
        viewBox="0 0 46 70"
        fill="none"
        stroke="var(--primary)"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M28 5 C 36 24, 35 44, 23 62" />
        <path d="M13 52 L 23 64 L 34 54" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.empty {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 40px 40px 0;
  text-align: center;
}

.empty__badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 78px;
  height: 78px;
  margin-bottom: 22px;
  border: 1px solid var(--primary-soft-border);
  border-radius: var(--r-pill);
  background: var(--primary-soft);
  color: var(--primary);
}

.empty__title {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 22px;
  font-weight: var(--w-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--ink);
}

.empty__subtitle {
  margin: 10px 0 0;
  max-width: 270px;
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

.empty__hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.empty__hint-text {
  font-family: var(--font-hand);
  font-size: 23px;
  font-weight: var(--w-semibold);
  color: var(--primary);
  transform: rotate(-4deg);
}

.empty__arrow {
  animation: vbob 2.2s var(--ease-in-out) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .empty__arrow {
    animation: none;
  }
}
</style>
