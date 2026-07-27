<script setup lang="ts">
const props = defineProps<{
  entry: {
    id: string;
    word: string;
    gloss: string | null;
    speaker: string | null;
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

const SPEAKER_SEPARATOR = ' · ';

// Split "Mom · grandmother" into a bold lead and a faint remainder (the
// separator travels with the remainder). No separator → the whole line is
// bold. Returns null when there is no speaker so the line is omitted.
const speakerParts = computed(() => {
  const { speaker } = props.entry;
  if (!speaker) return null;
  const index = speaker.indexOf(SPEAKER_SEPARATOR);
  if (index === -1) return { lead: speaker, rest: null };
  return { lead: speaker.slice(0, index), rest: speaker.slice(index) };
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
    <p v-if="speakerParts" class="entry__speaker">
      <span class="entry__speaker-lead">{{ speakerParts.lead }}</span
      ><span v-if="speakerParts.rest" class="entry__speaker-rest">{{
        speakerParts.rest
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
