<!-- Brand variant of the prototype top bar: centered logo + wordmark.
     Title/back variants arrive with the detail screens that need them. -->
<template>
  <header class="top-bar">
    <img
      src="/logo-mark.svg"
      alt=""
      width="22"
      height="22"
      class="top-bar__mark"
    />
    <span class="top-bar__brand">Vocabu</span>
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
</style>
