<script setup lang="ts">
defineProps<{ title: string; body: string }>();
</script>

<template>
  <section class="tab-placeholder">
    <h1 class="tab-placeholder__title">{{ title }}</h1>
    <p class="tab-placeholder__body">{{ body }}</p>
    <slot />
  </section>
</template>

<style scoped>
.tab-placeholder {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
}

.tab-placeholder__title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--w-medium);
  color: var(--ink);
}

.tab-placeholder__body {
  margin: 0;
  max-width: 36ch;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--ink-2);
}
</style>
