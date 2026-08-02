<script setup lang="ts">
// The speaker disc (prototype primitives.jsx Avatar): one initial on a soft
// tint, round, quiet. Decorative on purpose — every surface that renders it
// prints the speaker's name right next to it, so a screen reader would only
// hear the first letter twice.
const props = withDefaults(
  defineProps<{
    name: string;
    tone?: 'rose' | 'blue' | 'ink' | null;
    size?: number;
  }>(),
  { tone: null, size: 40 },
);

const initial = computed(() => {
  // Spread, not [0]: an emoji or any astral character is a surrogate pair
  // and indexing would render half of it.
  const [first] = [...props.name.trim()];
  return first === undefined ? '' : first.toUpperCase();
});

// No tone (a word kept before tones existed, or the user's own) reads ink —
// the quiet neutral, never a colour picked at random.
const toneClass = computed(() => `v-avatar--${props.tone ?? 'ink'}`);
</script>

<template>
  <span
    class="v-avatar"
    :class="toneClass"
    :style="{ '--v-avatar-size': `${size}px` }"
    aria-hidden="true"
    >{{ initial }}</span
  >
</template>

<style scoped>
.v-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: var(--v-avatar-size);
  height: var(--v-avatar-size);
  border-radius: var(--r-pill);
  font-family: var(--font-sans);
  font-weight: var(--w-bold);
  /* 0.42 of the disc — the prototype's ratio, so the letter keeps its
     optical weight at any size the callers ask for. */
  font-size: calc(var(--v-avatar-size) * 0.42);
  line-height: 1;
  letter-spacing: var(--tracking-snug);
  user-select: none;
}

/* The soft pairs, NOT the --rose-200 / --blue-200 the spec mock draws: those
   steps are deliberately left at their light values in theme-dark.css, so a
   dark-theme viewer would get a bright pink disc on a near-black page — and
   ds:check would pass, because they are perfectly legal tokens. Every pair
   below is re-themed for dark. */
.v-avatar--rose {
  background: var(--primary-soft);
  color: var(--on-primary-soft);
}

.v-avatar--blue {
  background: var(--secondary-soft);
  color: var(--on-secondary-soft);
}

.v-avatar--ink {
  background: var(--surface-sunk);
  color: var(--ink-2);
}
</style>
