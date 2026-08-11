<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  isEdit: boolean;
  // A clip that already reached the server lands on the word whatever this
  // sheet answers, so the promise below has to know about it.
  isMediaSent: boolean;
}>();

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const { t } = useI18n();

const question = computed(() =>
  props.isEdit
    ? t('app.compose.discard.editQuestion')
    : t('app.compose.discard.question'),
);
const body = computed(() => {
  if (!props.isEdit) return t('app.compose.discard.body');
  if (props.isMediaSent) return t('app.compose.discard.editBodySent');
  return t('app.compose.discard.editBody');
});
const confirmLabel = computed(() =>
  props.isEdit
    ? t('app.compose.discard.editConfirm')
    : t('app.compose.discard.confirm'),
);
// Separate keys because fr/uk say "keep writing", which an editor is not.
const keepLabel = computed(() =>
  props.isEdit
    ? t('app.compose.discard.editKeep')
    : t('app.compose.discard.keep'),
);

const keepWrapper = ref<HTMLElement | null>(null);

// The safe answer takes focus, never the destructive one.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    await nextTick();
    keepWrapper.value?.querySelector('button')?.focus();
  },
);
</script>

<template>
  <div
    class="discard"
    :class="{ 'discard--open': open }"
    :aria-hidden="!open"
    :inert="!open"
  >
    <div class="discard__scrim" @click="emit('cancel')" />

    <section
      class="discard__sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-discard-question"
    >
      <div class="discard__grab" aria-hidden="true" />

      <p id="compose-discard-question" class="discard__question">
        {{ question }}
      </p>
      <p class="discard__body">{{ body }}</p>

      <div class="discard__stack">
        <VButton variant="danger" size="lg" full @click="emit('confirm')">
          {{ confirmLabel }}
        </VButton>
        <span ref="keepWrapper" class="discard__keep">
          <VButton variant="secondary" size="lg" full @click="emit('cancel')">
            {{ keepLabel }}
          </VButton>
        </span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.discard {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.discard--open {
  pointer-events: auto;
}

.discard__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.discard--open .discard__scrim {
  opacity: 1;
}

.discard__sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: var(--app-column);
  margin-inline: auto;
  padding: 14px 20px calc(22px + var(--safe-bottom));
  border-top-left-radius: var(--r-xl);
  border-top-right-radius: var(--r-xl);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
  transform: translateY(110%);
  transition: transform var(--dur-slow) var(--ease-out);
}
.discard--open .discard__sheet {
  transform: translateY(0);
}

.discard__grab {
  width: 40px;
  height: 4px;
  margin-bottom: 18px;
  border-radius: var(--r-pill);
  background: var(--hairline-2);
}

.discard__question {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 18px;
  font-weight: var(--w-bold);
  color: var(--ink);
}

.discard__body {
  margin: 8px 0 0;
  max-width: 280px;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

.discard__stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  margin-top: 22px;
}

.discard__keep {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .discard__sheet,
  .discard__scrim {
    transition: none;
  }
}
</style>
