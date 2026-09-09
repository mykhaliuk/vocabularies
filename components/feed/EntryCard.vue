<script setup lang="ts">
import type { FeedEntryView } from '~/server/utils/entry-view';

const props = defineProps<{
  entry: FeedEntryView;
}>();

// Bold name, faint "· relation · age" tail — shared with the word detail
// screen, which must read identically (composables/useSpeakerLine.ts). No
// speaker → the word is the user's own and reads "You": attribution never
// blocks a word, so it never hides either.
const { formatSpeakerLead, formatSpeakerTail } = useSpeakerLine();

const speakerLead = computed(() => formatSpeakerLead(props.entry.speaker));
const speakerRest = computed(() =>
  formatSpeakerTail(props.entry.speaker, props.entry.saidAt),
);

// utils/headword-size.ts owns the ladder; the rest of the handwritten
// branch (zero tracking, 1.2 leading, descender padding) is in the
// stylesheet below.
const headwordSize = computed(() => headwordSizePx(props.entry.word));

// The card is the way into the word (word-detail-spec §Behaviour). The
// headword itself is a real link, so the entry is reachable by keyboard,
// announced as a link, and openable in a new tab; the click handler only
// widens that same target to the rest of the card, the way a thumb expects.
const entryPath = computed(
  () => `/entries/${encodeURIComponent(props.entry.id)}`,
);

const openEntry = (event: MouseEvent) => {
  // A tap that landed on the headword link or on a media control has
  // already been answered — do not answer it twice. Element, not
  // HTMLElement: a tap on a Lucide glyph reports the <svg> as its target.
  const target = event.target as Element | null;
  if (target?.closest('a, button')) return;
  // A drag across the gloss ends in a click too. That click is the end of a
  // selection, not a tap: navigating would throw away the words the reader
  // just highlighted. A collapsed selection is the caret, which every
  // ordinary tap leaves behind — only a range blocks.
  //
  // A double-click is NOT covered, and knowingly so. The events run
  // md1 / mu1 / click1 / md2 / mu2 / click2 / dblclick, and Chromium applies
  // the word selection on md2 — so click1 still sees a collapsed caret and
  // opens the word. Catching it would mean holding every navigation back to
  // wait for a possible second click, and a deliberate tap delay on a
  // mobile-first product is the worse trade than a desktop copy gesture
  // that opens the word.
  const selection = window.getSelection();
  if (selection?.isCollapsed === false) return;
  void navigateTo(entryPath.value);
};
</script>

<template>
  <article class="entry" @click="openEntry">
    <p class="entry__speaker">
      <span class="entry__speaker-lead">{{ speakerLead }}</span
      ><span v-if="speakerRest" class="entry__speaker-rest">{{
        speakerRest
      }}</span>
    </p>

    <h2 class="entry__word" :style="{ fontSize: `${headwordSize}px` }">
      <NuxtLink class="entry__link" :to="entryPath">
        <span class="entry__quote">“</span>{{ entry.word
        }}<span class="entry__quote">”</span>
      </NuxtLink>
    </h2>

    <p v-if="entry.gloss" class="entry__gloss">{{ entry.gloss }}</p>

    <!-- The story is deliberately NOT here. The feed card is speaker · word ·
         gloss · media (prototype feed.jsx); the story belongs to the detail
         screen, behind its "meaning & story" toggle. It stays on the entry
         payload for that screen. -->
    <!-- Play is play: a tap on the player must not also open the word
         (prototype feed.jsx:140). -->
    <FeedMediaBlock
      class="entry__media"
      :media="entry.media"
      :entry-id="entry.id"
      @click.stop
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
  cursor: pointer;
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

/* The link carries no link styling: the word is already the loudest thing
   on the card, and underlining it would turn a keepsake into a nav item.
   The focus ring is what makes it visibly reachable by keyboard. */
.entry__link {
  color: inherit;
  text-decoration: none;
  border-radius: var(--r-xs);

  &:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 4px;
  }
}

.entry__quote {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

.entry__gloss {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-style: italic;
  color: var(--ink-2);
}

.entry__media {
  margin-top: 2px;
  width: 100%;
}
</style>
