<script setup lang="ts">
// Detail shell (word-detail-spec.html §Metrics). Same frosted 54px bar as
// the tab shell, but nothing fixed at the bottom: the reply composer went
// with the social row, so the scroll container recovers its air and a future
// swipe between siblings has the edge to itself. No BottomNav — this screen
// is a page you open to remember, and the way out of it is the back arrow.
// The ComposeSheet is here without that FAB: the ⋯ menu's "edit word" is what
// raises it (entry-actions-spec §Flow).
defineProps<{ title?: string }>();
</script>

<template>
  <div class="detail-shell">
    <AppTopBar back :title="title">
      <template v-if="$slots['bar-right']" #right>
        <slot name="bar-right" />
      </template>
    </AppTopBar>
    <main class="detail-shell__main">
      <slot />
    </main>
    <ComposeSheet />
  </div>
</template>

<style scoped>
.detail-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.detail-shell__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  /* Gutter 20, top 8, bottom 40 + safe area — the spec's own numbers (the
     120px that cleared the pinned composer is recovered). */
  padding: var(--space-2) var(--space-5)
    calc(var(--space-10) + var(--safe-bottom));
}
</style>
