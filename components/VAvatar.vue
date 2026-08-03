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

// The initial and the tone's token pair are pure, and live in utils/avatar.ts
// so a unit test can pin them — bun test cannot mount this file.
const initial = computed(() => avatarInitial(props.name));

const style = computed(() => ({
  '--v-avatar-size': `${props.size}px`,
  ...avatarToneVars(props.tone),
}));
</script>

<template>
  <span class="v-avatar" :style="style" aria-hidden="true">{{ initial }}</span>
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
  background: var(--v-avatar-bg);
  color: var(--v-avatar-fg);
  font-family: var(--font-sans);
  font-weight: var(--w-bold);
  /* 0.42 of the disc — the prototype's ratio, so the letter keeps its
     optical weight at any size the callers ask for. */
  font-size: calc(var(--v-avatar-size) * 0.42);
  line-height: 1;
  letter-spacing: var(--tracking-snug);
  user-select: none;
}
</style>
