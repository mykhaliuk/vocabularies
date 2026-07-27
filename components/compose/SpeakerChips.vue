<script setup lang="ts">
import { Check, Plus } from 'lucide-vue-next';
import { speakerAgeAt } from '~/shared/speaker-age';
import type { SpeakerView } from '~/server/utils/speaker-view';

// "Who said it" as a chip row (VKB-97, speaker-spec §Creation flow):
// selection is single and toggleable, "＋ someone new" expands a soft rose
// panel with the shared form — name required, relation and birthday
// optional forever. Creating a person never costs the word being written:
// the panel lives inside the sheet, and Add selects the fresh chip.
const props = defineProps<{
  speakers: SpeakerView[];
  selected: string | null;
}>();

const emit = defineEmits<{
  'update:selected': [string | null];
  created: [SpeakerView];
}>();

const { t } = useI18n();

const creating = ref(false);
const submitting = ref(false);
const createError = ref(false);
const name = ref('');
const rel = ref('');
const birthday = ref('');

// Suggestion chips for the relation — shown only while it is empty.
const REL_SUGGESTION_KEYS = [
  'daughter',
  'son',
  'dad',
  'mum',
  'bestFriend',
] as const;

const canAdd = computed(() => name.value.trim().length > 0);

// "they're 22 mo today" — age against today, because here we are talking
// about the person, not a word.
const todayIso = () => new Date().toISOString().slice(0, 10);

const birthdayHint = computed(() => {
  if (!birthday.value) return t('app.compose.speaker.hintEmpty');
  const age = speakerAgeAt(birthday.value, todayIso());
  if (!age) return t('app.compose.speaker.hintEmpty');
  const label =
    age.kind === 'newborn'
      ? t('app.feed.age.newborn')
      : age.kind === 'months'
        ? t('app.feed.age.months', { n: age.n })
        : t('app.feed.age.years', { n: age.n });
  return t('app.compose.speaker.hintFilled', { age: label });
});

const toggle = (id: string) => {
  emit('update:selected', props.selected === id ? null : id);
};

const startCreating = () => {
  name.value = '';
  rel.value = '';
  birthday.value = '';
  createError.value = false;
  creating.value = true;
};

const cancelCreating = () => {
  creating.value = false;
  createError.value = false;
};

const add = async () => {
  if (!canAdd.value || submitting.value) return;
  submitting.value = true;
  createError.value = false;
  try {
    const res = await $fetch<{ speaker: SpeakerView }>('/api/speakers', {
      method: 'POST',
      credentials: 'include',
      body: {
        name: name.value.trim(),
        rel: rel.value.trim() || undefined,
        birthday: birthday.value || undefined,
      },
    });
    emit('created', res.speaker);
    emit('update:selected', res.speaker.id);
    creating.value = false;
  } catch (error) {
    console.error('[SpeakerChips] create failed', error);
    createError.value = true;
  } finally {
    submitting.value = false;
  }
};

defineExpose({ isCreating: creating });
</script>

<template>
  <div class="chips">
    <div class="chips__row">
      <button
        v-for="speaker in speakers"
        :key="speaker.id"
        type="button"
        class="chips__chip"
        :class="{ 'chips__chip--active': selected === speaker.id }"
        @click="toggle(speaker.id)"
      >
        <Check v-if="selected === speaker.id" :size="14" aria-hidden="true" />
        {{ speaker.name }}
      </button>
      <button
        v-if="!creating"
        type="button"
        class="chips__chip chips__chip--new"
        @click="startCreating"
      >
        <Plus :size="14" aria-hidden="true" />
        {{ t('app.compose.speaker.someoneNew') }}
      </button>
    </div>

    <div v-if="creating" class="chips__panel">
      <div class="chips__field">
        <label class="chips__label" for="speaker-name">
          {{ t('app.compose.speaker.nameLabel') }}
        </label>
        <input
          id="speaker-name"
          v-model="name"
          class="chips__input"
          :placeholder="t('app.compose.speaker.namePlaceholder')"
          autocomplete="off"
        />
      </div>

      <div class="chips__field">
        <label class="chips__label" for="speaker-rel">
          {{ t('app.compose.speaker.relLabel') }}
          <span class="chips__optional">
            {{ t('app.compose.speaker.optional') }}
          </span>
        </label>
        <input
          id="speaker-rel"
          v-model="rel"
          class="chips__input"
          :placeholder="t('app.compose.speaker.relPlaceholder')"
          autocomplete="off"
        />
        <div v-if="!rel" class="chips__suggestions">
          <button
            v-for="key in REL_SUGGESTION_KEYS"
            :key="key"
            type="button"
            class="chips__chip chips__chip--suggest"
            @click="rel = t(`app.compose.speaker.rel.${key}`)"
          >
            {{ t(`app.compose.speaker.rel.${key}`) }}
          </button>
        </div>
      </div>

      <div class="chips__field">
        <label class="chips__label" for="speaker-birthday">
          {{ t('app.compose.speaker.birthdayLabel') }}
          <span class="chips__optional">
            {{ t('app.compose.speaker.optional') }}
          </span>
        </label>
        <input
          id="speaker-birthday"
          v-model="birthday"
          type="date"
          class="chips__input"
        />
        <p class="chips__hint">{{ birthdayHint }}</p>
      </div>

      <p v-if="createError" class="chips__error" role="alert">
        {{ t('app.compose.speaker.createError') }}
      </p>

      <div class="chips__acts">
        <VButton size="sm" :disabled="!canAdd || submitting" @click="add">
          {{
            submitting
              ? t('app.compose.speaker.adding')
              : t('app.compose.speaker.add')
          }}
        </VButton>
        <button type="button" class="chips__cancel" @click="cancelCreating">
          {{ t('app.compose.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chips__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* Round chips (chips are round per the brand rules — buttons are not). */
.chips__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 14px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-pill);
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: var(--w-semibold);
  color: var(--ink-2);
  cursor: pointer;
  transition:
    border-color var(--dur-fast),
    background var(--dur-fast),
    color var(--dur-fast);
}

.chips__chip--active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.chips__chip--new {
  border-style: dashed;
  color: var(--ink-3);
}

.chips__chip--suggest {
  min-height: 32px;
  padding: 5px 11px;
  font-size: 13px;
  font-weight: var(--w-medium);
}

/* The soft rose creation panel (speakers.jsx SpeakerPicker). */
.chips__panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border: 1.5px solid var(--primary-soft-border);
  border-radius: var(--r-md);
  background: var(--primary-soft);
}

.chips__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chips__label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: var(--w-bold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.chips__optional {
  text-transform: none;
  letter-spacing: 0;
  font-weight: var(--w-regular);
}

.chips__input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 13px;
  border: 1.5px solid var(--hairline-2);
  border-radius: var(--r-sm);
  outline: 0;
  background: var(--surface);
  font-family: var(--font-sans);
  font-size: 16px;
  color: var(--ink);
  color-scheme: light dark;
  transition: border-color var(--dur-fast);
}

.chips__input:focus {
  border-color: var(--primary);
}

.chips__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 2px;
}

.chips__hint {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--ink-3);
}

.chips__hint b {
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}

.chips__error {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--danger);
}

.chips__acts {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chips__cancel {
  min-height: var(--tap-min);
  padding: 8px 10px;
  border: 0;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: var(--w-medium);
  color: var(--ink-2);
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .chips__chip,
  .chips__input {
    transition: none;
  }
}
</style>
