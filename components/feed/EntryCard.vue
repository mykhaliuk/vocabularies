<script setup lang="ts">
import { speakerAgeAt } from '~/shared/speaker-age';
import type { EntrySpeakerView } from '~/server/utils/entry-view';

const props = defineProps<{
  entry: {
    id: string;
    word: string;
    gloss: string | null;
    speaker: EntrySpeakerView | null;
    saidAt: string;
    story: string | null;
    collection: string | null;
    createdAt: string;
    media: {
      mediaId: string;
      kind: 'audio' | 'video';
      status: 'processing' | 'ready' | 'failed';
      durationSec: number | null;
      width: number | null;
      height: number | null;
      peaks: number[] | null;
      error: string | null;
    } | null;
  };
}>();

const { t } = useI18n();

// The frozen age: birthday measured against the day the word was said,
// never against today (speaker-spec §The age rule). Null renders nothing —
// no birthday, or a birthday after saidAt (data can be messy).
const ageLabel = computed(() => {
  const sp = props.entry.speaker;
  if (!sp) return null;
  const age = speakerAgeAt(sp.birthday, props.entry.saidAt);
  if (!age) return null;
  if (age.kind === 'newborn') return t('app.feed.age.newborn');
  if (age.kind === 'months') return t('app.feed.age.months', { n: age.n });
  return t('app.feed.age.years', { n: age.n });
});

// Bold name, faint "· relation · age" tail. No speaker → the word is the
// user's own and reads "You" — attribution never blocks a word, so it never
// hides either.
const speakerLead = computed(
  () => props.entry.speaker?.name ?? t('app.feed.you'),
);
const speakerRest = computed(() => {
  const sp = props.entry.speaker;
  if (!sp) return null;
  const parts = [sp.rel, ageLabel.value].filter(Boolean);
  return parts.length > 0 ? ' · ' + parts.join(' · ') : null;
});

// The headword shrinks as the phrase grows so a single long word never
// overflows the centered card. The ladder is the prototype's (feed.jsx
// WordText) scaled by its handwritten branch: Caveat's x-height is far
// smaller than Hanken's, so the design multiplies the step by 1.32
// (app.jsx --word-scale) — the rest of that branch (zero tracking, 1.2
// leading, descender padding) lives in the stylesheet below.
const HAND_SCALE = 1.32;

const headwordSize = computed(() => {
  const length = props.entry.word.length;
  const step =
    length <= 13
      ? 40
      : length <= 20
        ? 33
        : length <= 30
          ? 27
          : length <= 44
            ? 22
            : 19;
  return Math.round(step * HAND_SCALE);
});
</script>

<template>
  <article class="entry">
    <p class="entry__speaker">
      <span class="entry__speaker-lead">{{ speakerLead }}</span
      ><span v-if="speakerRest" class="entry__speaker-rest">{{
        speakerRest
      }}</span>
    </p>

    <h2 class="entry__word" :style="{ fontSize: `${headwordSize}px` }">
      <span class="entry__quote">“</span>{{ entry.word
      }}<span class="entry__quote">”</span>
    </h2>

    <p v-if="entry.gloss" class="entry__gloss">{{ entry.gloss }}</p>

    <!-- The story is deliberately NOT here. The feed card is speaker · word ·
         gloss · media (prototype feed.jsx); the story belongs to the detail
         screen, behind its "meaning & story" toggle. It stays on the entry
         payload for that screen. -->
    <FeedMediaBlock
      class="entry__media"
      :media="entry.media"
      :entry-id="entry.id"
    />
  </article>
</template>

<style scoped>
.entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 26px 20px;
  text-align: center;
}

.entry__speaker {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 13.5px;
  line-height: 1.3;
}

.entry__speaker-lead {
  font-weight: var(--w-semibold);
  color: var(--ink);
}

.entry__speaker-rest {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

/* Handwritten branch of the prototype's word style (app.jsx): Caveat wants
   no negative tracking, a looser 1.2 leading, and bottom padding so its long
   descenders are not clipped. */
.entry__word {
  align-self: stretch;
  margin: 0;
  padding-bottom: 0.14em;
  font-family: var(--font-hand);
  font-weight: var(--w-semibold);
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
  color: var(--ink);
  overflow-wrap: break-word;
}

.entry__quote {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

.entry__gloss {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 16px;
  font-style: italic;
  color: var(--ink-2);
}

.entry__media {
  margin-top: 2px;
  width: 100%;
}
</style>
