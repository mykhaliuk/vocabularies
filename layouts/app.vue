<!-- Authed app shell: frosted brand top bar + floating glass bottom nav
     (docs/design/prototype/project/Vocabu/chrome.jsx). -->
<template>
  <div class="app-shell">
    <AppTopBar />
    <main class="app-shell__main">
      <slot />
    </main>
    <AppBottomNav />
    <ComposeSheet />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.app-shell__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  /* Bottom clearance so content scrolls clear of the floating nav:
     pill (~66px) + its 14px bottom offset + breathing room, plus the
     device safe area. */
  padding: var(--space-4) var(--gutter) calc(96px + var(--safe-bottom));
}
</style>
