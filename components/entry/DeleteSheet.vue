<script setup lang="ts">
// The delete confirm (entry-actions-spec.html §The surfaces). A bottom sheet
// over the detail: the word itself does the emotional work, one honest
// sentence names what leaves with it, and there is one Delete/Cancel pair.
//
// No undo toast — that shape needs soft delete server-side and is VKB-102.
const props = withDefaults(
  defineProps<{
    open: boolean;
    word: string;
    hasStory: boolean;
    // The kept moment, if the entry has one that survived transcoding.
    mediaKind?: 'audio' | 'video' | null;
    busy?: boolean;
    failed?: boolean;
  }>(),
  { mediaKind: null, busy: false, failed: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const { t } = useI18n();

// The middle sentence is assembled from what the entry actually has, never a
// generic warning (spec §The surfaces). The bare word is deliberately absent
// from the table: there is nothing to name, and inventing a clause for it would
// overstate what the tap costs.
//
// Spelt as t() calls rather than key strings so scripts/i18n-check.js can see
// them — a table of bare key names is invisible to it, and a typo there would
// reach the sheet as its own key.
const consequence = computed(() => {
  const story = props.hasStory ? 'story' : 'none';
  const media = props.mediaKind ?? 'none';
  const sentences: Record<string, string> = {
    'story+audio': t('app.entry.delete.losesStoryVoice'),
    'story+video': t('app.entry.delete.losesStoryVideo'),
    'story+none': t('app.entry.delete.losesStory'),
    'none+audio': t('app.entry.delete.losesVoice'),
    'none+video': t('app.entry.delete.losesVideo'),
  };
  return sentences[`${story}+${media}`] ?? '';
});

const sentence = computed(() =>
  [
    t('app.entry.delete.question'),
    consequence.value,
    t('app.entry.delete.irreversible'),
  ]
    .filter((part) => part !== '')
    .join(' '),
);

const cancel = ref<HTMLElement | null>(null);

// Focus lands on Cancel, never on the destructive button: a sheet that opens
// with Delete under the keyboard turns one stray Enter into a lost keepsake.
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    await nextTick();
    cancel.value?.querySelector('button')?.focus();
  },
);

// Both ways out of the sheet without answering it. Refused mid-delete: the
// request is already in flight, and dismissing the sheet would leave the reader
// on a word that is about to vanish under them.
const dismiss = () => {
  if (!props.busy) emit('cancel');
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) dismiss();
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <!-- `inert` rather than aria-hidden alone, matching the compose sheet: the
       closed sheet's two buttons must leave the tab order entirely. -->
  <div
    class="confirm"
    :class="{ 'confirm--open': open }"
    :aria-hidden="!open"
    :inert="!open"
  >
    <div class="confirm__scrim" @click="dismiss" />

    <!-- Named by the word rather than by the question: the question is the
         first sentence of the body below, so labelling with it would have a
         screen reader read it twice and never name the entry at stake. -->
    <section
      class="confirm__sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-word"
    >
      <div class="confirm__grab" aria-hidden="true" />

      <p id="delete-confirm-word" class="confirm__word">
        <span class="confirm__quote">“</span>{{ word
        }}<span class="confirm__quote">”</span>
      </p>

      <p class="confirm__body">{{ sentence }}</p>

      <!-- Never swallowed: the word is still there, and saying nothing would
           read exactly like a deletion that worked. -->
      <p v-if="failed" class="confirm__error" role="alert">
        {{ t('app.entry.delete.failed') }}
      </p>

      <div class="confirm__stack">
        <VButton
          variant="danger"
          size="lg"
          full
          :loading="busy"
          @click="emit('confirm')"
        >
          {{ t('app.entry.delete.confirm') }}
        </VButton>
        <span ref="cancel" class="confirm__cancel">
          <VButton
            variant="secondary"
            size="lg"
            full
            :disabled="busy"
            @click="emit('cancel')"
          >
            {{ t('app.entry.delete.cancel') }}
          </VButton>
        </span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.confirm {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
.confirm--open {
  pointer-events: auto;
}

.confirm__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  opacity: 0;
  transition: opacity var(--dur-base) var(--ease-out);
}
.confirm--open .confirm__scrim {
  opacity: 1;
}

.confirm__sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 20px calc(22px + var(--safe-bottom));
  border-top-left-radius: var(--r-xl);
  border-top-right-radius: var(--r-xl);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  text-align: center;
  transform: translateY(110%);
  transition: transform var(--dur-slow) var(--ease-out);
}
.confirm--open .confirm__sheet {
  transform: translateY(0);
}

.confirm__grab {
  width: 40px;
  height: 4px;
  margin-bottom: 18px;
  border-radius: var(--r-pill);
  background: var(--hairline-2);
}

/* The handwritten face, as everywhere a headword is rendered — this sheet is
   asking about THIS word, and the word is the argument. */
.confirm__word {
  margin: 0;
  max-width: 100%;
  padding-bottom: 0.14em;
  font-family: var(--font-hand);
  font-size: 34px;
  font-weight: var(--w-medium);
  line-height: 1.2;
  color: var(--ink);
  overflow-wrap: break-word;
}

.confirm__quote {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

.confirm__body {
  margin: 10px 0 0;
  max-width: 280px;
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

.confirm__error {
  margin: 12px 0 0;
  max-width: 280px;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: var(--leading-normal);
  color: var(--danger);
}

.confirm__stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  margin-top: 22px;
}

.confirm__cancel {
  display: block;
}

@media (prefers-reduced-motion: reduce) {
  .confirm__sheet,
  .confirm__scrim {
    transition: none;
  }
}
</style>
