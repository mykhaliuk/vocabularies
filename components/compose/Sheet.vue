<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next';
import type { SpeakerView } from '~/server/utils/speaker-view';

// Compose bottom sheet (prototype compose.jsx / compose-dark screenshot),
// adapted to upload-first (VKB-67). Rises over the blurred app behind it.
const { t } = useI18n();
const { isOpen, close, notifyPosted } = useCompose();
const {
  phase,
  progress,
  errorMessage,
  errorCode,
  submit,
  reset,
  swap,
  cancel,
  askCancel,
  unaskCancel,
} = useMediaUpload();
// Shapes the picker only — the server stays the gate (ADR-0012).
const { entitlements } = useEntitlements();

const premiumOpen = ref(false);
const confirmOpen = ref(false);

// A submit that finishes while "Discard this word?" is on screen must not
// answer it: onKeep parks here, and whatever the user taps decides.
let answerQuestion: ((keep: boolean) => void) | null = null;

const questionAnswered = () =>
  new Promise<boolean>((resolve) => {
    answerQuestion = resolve;
  });

const settleQuestion = (keep: boolean) => {
  if (keep) unaskCancel();
  confirmOpen.value = false;
  const notify = answerQuestion;
  answerQuestion = null;
  notify?.(keep);
};

const videoLimitLabel = computed(() => {
  const seconds = entitlements.value?.maxVideoDurationSec;
  return seconds === undefined
    ? ''
    : t('app.compose.media.seconds', { n: seconds });
});

const word = ref('');
const sid = ref<string | undefined>();
const gloss = ref('');
const story = ref('');
const file = ref<File | null>(null);
const wordInput = ref<HTMLInputElement | null>(null);
const speakerChips = ref<{ resetPanel: () => void } | null>(null);

// The chip row's people. Fetched on every sheet OPENING, never while it is
// open: the MRU order settles between sessions, so chips do not move under
// the thumb (speaker-spec §Creation flow). A failed fetch degrades to just
// "＋ someone new" — attribution is optional, the word is not blocked.
const speakersList = ref<SpeakerView[]>([]);

const loadSpeakers = async () => {
  try {
    const res = await $fetch<{ speakers: SpeakerView[] }>('/api/speakers', {
      credentials: 'include',
    });
    speakersList.value = res.speakers;
  } catch (error) {
    console.error('[ComposeSheet] speakers load failed', error);
  }
};

// A person created inline joins the end of the row already selected; the
// MRU order catches up on the next opening.
const onSpeakerCreated = (speaker: SpeakerView) => {
  speakersList.value = [...speakersList.value, speaker];
};

const isBusy = computed(
  () =>
    phase.value === 'creating' ||
    phase.value === 'uploading' ||
    phase.value === 'finalizing',
);
const canPost = computed(() => word.value.trim().length > 0 && !isBusy.value);

// Async progress is otherwise invisible to a screen reader: the button label
// and the progress bar both change without moving focus.
const liveStatus = computed(() => {
  if (phase.value === 'uploading') {
    return t('app.compose.media.uploading', { pct: progress.value });
  }
  if (phase.value === 'finalizing') return t('app.compose.media.finalizing');
  return '';
});

const resetForm = () => {
  word.value = '';
  sid.value = undefined;
  gloss.value = '';
  story.value = '';
  file.value = null;
  speakerChips.value?.resetPanel();
  reset();
};

// Reset + focus when the sheet opens; the fields never carry over between
// words. The timer is cleared on close so focus is never moved into a sheet
// that has already gone inert.
let focusTimer: ReturnType<typeof setTimeout> | null = null;

watch(isOpen, (open) => {
  if (focusTimer !== null) clearTimeout(focusTimer);
  if (!open) {
    // The premium sheet teleports to <body>, so the closed sheet's `inert`
    // never reaches it — left open it would float over a closed compose.
    premiumOpen.value = false;
    settleQuestion(true);
    return;
  }
  resetForm();
  void loadSpeakers();
  focusTimer = setTimeout(() => wordInput.value?.focus(), 280);
});

// Dismissing is a discard (VKB-154): the sheet goes at once and the composable
// deletes behind it, so a half-written word never survives as a text-only
// entry nobody asked for. The confirm is the guard against a mis-tap.
const isDirty = computed(
  () =>
    word.value.trim().length > 0 ||
    gloss.value.trim().length > 0 ||
    story.value.trim().length > 0 ||
    sid.value !== undefined ||
    !!file.value,
);

const discardNow = () => {
  settleQuestion(false);
  cancel();
  close();
};

const onCancel = () => {
  if (isDirty.value) {
    askCancel();
    confirmOpen.value = true;
    return;
  }
  discardNow();
};

const keepEditing = () => {
  settleQuestion(true);
  void nextTick(() => {
    if (isOpen.value) wordInput.value?.focus();
  });
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !isOpen.value) return;
  if (confirmOpen.value) {
    keepEditing();
    return;
  }
  // The premium sheet answers Escape itself; without this the compose sheet
  // would ask to discard a word the user never tried to dismiss.
  if (premiumOpen.value) return;
  onCancel();
};

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  if (focusTimer !== null) clearTimeout(focusTimer);
  window.removeEventListener('keydown', onKeydown);
});

const onKeep = async () => {
  if (!canPost.value) return;
  const result = await submit(
    {
      word: word.value,
      gloss: gloss.value,
      sid: sid.value,
      story: story.value,
      file: file.value,
    },
    { entryId: undefined },
  );
  if (!result) return; // phase === 'error', errorMessage shown inline
  // Asked mid-flight: their answer outranks the completion that landed under
  // it, because the request came first.
  if (confirmOpen.value && !(await questionAnswered())) return;
  notifyPosted();
  close();
  resetForm();
  await navigateTo('/feed');
};
</script>

<template>
  <!-- `inert` (not just aria-hidden) so the closed sheet's fields and buttons
       leave the tab order entirely — aria-hidden alone would keep them
       keyboard-focusable inside a hidden subtree. -->
  <div
    class="compose"
    :class="{ 'compose--open': isOpen }"
    :aria-hidden="!isOpen"
    :inert="!isOpen"
  >
    <div class="compose__scrim" @click="onCancel" />

    <section
      class="compose__sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="t('app.compose.title')"
      :inert="confirmOpen"
    >
      <div class="compose__handle" aria-hidden="true" />

      <header class="compose__header">
        <button type="button" class="compose__cancel" @click="onCancel">
          {{ t('app.compose.cancel') }}
        </button>
        <span class="compose__title">{{ t('app.compose.title') }}</span>
        <span class="compose__header-spacer" aria-hidden="true" />
      </header>

      <div class="compose__body">
        <label class="compose__field-label" for="compose-word">
          {{ t('app.compose.wordLabel') }}
        </label>
        <input
          id="compose-word"
          ref="wordInput"
          v-model="word"
          class="compose__word"
          :class="{ 'compose__word--filled': word.length > 0 }"
          :placeholder="t('app.compose.wordPlaceholder')"
          autocomplete="off"
        />

        <div class="compose__field">
          <span class="compose__field-label">
            {{ t('app.compose.speakerLabel') }}
          </span>
          <ComposeSpeakerChips
            ref="speakerChips"
            class="compose__chips"
            :speakers="speakersList"
            :selected="sid"
            @update:selected="sid = $event"
            @created="onSpeakerCreated"
          />
        </div>

        <div class="compose__field">
          <label class="compose__field-label" for="compose-gloss">
            {{ t('app.compose.glossLabel') }}
          </label>
          <input
            id="compose-gloss"
            v-model="gloss"
            class="compose__input"
            :placeholder="t('app.compose.glossPlaceholder')"
            autocomplete="off"
          />
        </div>

        <div class="compose__field">
          <label class="compose__field-label" for="compose-story">
            {{ t('app.compose.storyLabel') }}
          </label>
          <textarea
            id="compose-story"
            v-model="story"
            class="compose__input compose__textarea"
            rows="3"
            :placeholder="t('app.compose.storyPlaceholder')"
          />
        </div>

        <ComposeMediaAttach
          :file="file"
          :phase="phase"
          :progress="progress"
          :entitlements="entitlements"
          :error-code="errorCode"
          :error-message="errorMessage"
          @update:file="file = $event"
          @retry="onKeep"
          @swap="swap"
          @see-premium="premiumOpen = true"
        />

        <!-- Only form-level failures: a media failure is reported inside the
             picker, next to the file it is about. -->
        <p
          v-if="phase === 'error' && errorMessage && !file"
          class="compose__error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>

      <!-- Primary action in the thumb zone (prototype compose.jsx): a filled
           --primary-action surface, so the accent never has to carry text
           contrast on its own. -->
      <div class="compose__footer">
        <VButton full size="lg" :disabled="!canPost" @click="onKeep">
          <template v-if="isBusy" #left>
            <Loader2 :size="16" class="compose__spin" />
          </template>
          {{ isBusy ? t('app.compose.keeping') : t('app.compose.keep') }}
        </VButton>
      </div>

      <span class="compose__live" role="status" aria-live="polite">
        {{ liveStatus }}
      </span>
    </section>

    <ComposeDiscardSheet
      :open="confirmOpen"
      @confirm="discardNow"
      @cancel="keepEditing"
    />

    <ComposePremiumSheet
      :open="premiumOpen"
      :video-limit-label="videoLimitLabel"
      @close="premiumOpen = false"
    />
  </div>
</template>

<style scoped>
.compose {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
.compose--open {
  pointer-events: auto;
}

.compose__scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  opacity: 0;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
  transition:
    opacity var(--dur-base) var(--ease-out),
    backdrop-filter var(--dur-base);
}
.compose--open .compose__scrim {
  opacity: 1;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.compose__sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--app-column);
  margin-inline: auto;
  max-height: 94%;
  background: var(--surface);
  border-top-left-radius: var(--r-xl);
  border-top-right-radius: var(--r-xl);
  box-shadow: var(--shadow-lg);
  transform: translateY(110%);
  transition: transform var(--dur-slow) var(--ease-out);
}
.compose--open .compose__sheet {
  transform: translateY(0);
}

.compose__handle {
  width: 40px;
  height: 4px;
  margin: 10px auto 0;
  border-radius: var(--r-pill);
  background: var(--hairline-2);
}

.compose__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px 12px;
  border-bottom: 1px solid var(--hairline);
}
.compose__title {
  font-family: var(--font-sans);
  font-size: 16px;
  font-weight: var(--w-bold);
  color: var(--ink);
}
.compose__cancel {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-min);
  border: 0;
  background: transparent;
  padding: 8px 4px;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: var(--w-medium);
  color: var(--ink-2);
  cursor: pointer;
}
.compose__cancel:disabled {
  color: var(--ink-3);
  cursor: default;
}

/* Balances the cancel button so the title stays optically centred. */
.compose__header-spacer {
  width: 62px;
}

.compose__footer {
  flex: 0 0 auto;
  padding: 12px 18px calc(14px + var(--safe-bottom));
  border-top: 1px solid var(--hairline);
  background: var(--surface);
}

/* Visually hidden, but announced: upload/processing progress for AT. */
.compose__live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.compose__spin {
  animation: vspin 0.8s linear infinite;
}

.compose__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 20px;
}

.compose__field-label {
  display: block;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: var(--w-bold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.compose__word {
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 6px 2px 12px;
  border: 0;
  border-bottom: 2px solid var(--hairline-2);
  outline: 0;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 26px;
  font-weight: var(--w-bold);
  letter-spacing: -0.02em;
  color: var(--ink);
  transition: border-color var(--dur-fast);
}
/* An input cuts an overlong placeholder with no ellipsis and no signal.
   `em`, not a rem token: it resolves against the field's own px size, so the
   hint cannot outgrow the headword when the root font-size is raised. */
.compose__word::placeholder {
  font-size: 0.77em;
  font-weight: var(--w-regular);
}

.compose__word:focus,
.compose__word--filled {
  border-bottom-color: var(--primary);
}

.compose__field {
  margin-top: 18px;
}

.compose__chips {
  margin-top: 7px;
}

.compose__input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 7px;
  padding: 13px 14px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-sm);
  outline: 0;
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: 16px;
  color: var(--ink);
  transition: border-color var(--dur-fast);
}
.compose__input:focus {
  border-color: var(--primary);
}
.compose__textarea {
  resize: none;
  line-height: var(--leading-normal);
}

.compose__error {
  margin: 14px 0 0;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--danger);
}

@media (prefers-reduced-motion: reduce) {
  .compose__sheet,
  .compose__scrim,
  .compose__word {
    transition: none;
  }
  .compose__spin {
    animation: none;
  }
}
</style>
