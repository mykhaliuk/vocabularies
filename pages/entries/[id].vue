<script setup lang="ts">
import { Bookmark, Calendar, ChevronDown, CircleAlert } from 'lucide-vue-next';

definePageMeta({ layout: false, middleware: 'auth' });

// The word detail, read half (word-detail-spec.html). One centred column:
// the person, the word, the meaning, the media, the story, where it is
// filed, and the day it was said — in decreasing weight around the word.
//
// Not here on purpose, each pinned to its own ticket: the ⋯ menu and delete
// (VKB-95), editing the said-on date (VKB-111), and the whole social row,
// which v0 cuts as one piece.

// Shapes returned by GET /api/entries/:id (declared inline — no DTO layer).
type EntryMedia = {
  mediaId: string;
  kind: 'audio' | 'video';
  status: 'processing' | 'ready' | 'failed';
  durationSec: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  error: string | null;
};

type EntrySpeaker = {
  name: string;
  tone: 'rose' | 'blue' | 'ink' | null;
  rel: string | null;
  birthday: string | null;
};

type EntryDetail = {
  id: string;
  word: string;
  gloss: string | null;
  speaker: EntrySpeaker | null;
  saidAt: string;
  story: string | null;
  collection: string | null;
  createdAt: string;
};

type EntryDetailResponse = {
  entry: EntryDetail;
  media: EntryMedia | null;
  playback: {
    videoUrl: string | null;
    posterUrl: string | null;
    audioUrl: string | null;
  } | null;
};

const { t, locale } = useI18n();
const route = useRoute();
// NuxtPage keys the page by its interpolated path, so a different id mounts
// a fresh component — the id can be read once rather than watched.
const entryId = String(route.params.id);

// useRequestFetch forwards the incoming request's cookies during SSR (a bare
// $fetch to an internal route does not), so the first render is
// authenticated instead of 401ing into the error state.
const requestFetch = useRequestFetch();
const { data, error, refresh } = await useAsyncData(`entry:${entryId}`, () =>
  requestFetch<EntryDetailResponse>(
    `/api/entries/${encodeURIComponent(entryId)}`,
  ),
);

const entry = computed(() => data.value?.entry ?? null);
const media = computed(() => data.value?.media ?? null);

// A 404 is an answer, not a hiccup: the word is gone (or never was), and
// offering "try again" would only promise a retry that cannot succeed.
//
// `undefined`, not `null`: useAsyncData types its error ref as
// `Ref<NuxtError | undefined>` and clears it by writing `void 0`, so a
// null check would call every successful load a failure.
const isMissing = computed(() => error.value?.statusCode === 404);
const hasLoadError = computed(
  () => error.value !== undefined && !isMissing.value,
);

// No try/catch: refresh() cannot reject. Nuxt catches inside its own
// promise chain, parks the failure on the `error` ref above and resolves —
// so a failed retry surfaces as a re-render, never as a throw.
const retry = () => {
  void refresh();
};

// Seed the playback cache from the payload this page already holds, so the
// player mounted below does not re-request the same entry on first play.
// Runs during setup, ahead of any child mounting; the composable drops the
// call on the server, where its cache is shared across requests.
const { primePlayback } = useEntryPlayback();
watchEffect(() => {
  const loaded = data.value;
  if (loaded) primePlayback(loaded.entry.id, loaded.playback);
});

const { formatAgeLabel, formatSpeakerLead, formatSpeakerTail } =
  useSpeakerLine();
const speakerLead = computed(() =>
  formatSpeakerLead(entry.value?.speaker ?? null),
);
const speakerRest = computed(() =>
  entry.value
    ? formatSpeakerTail(entry.value.speaker, entry.value.saidAt)
    : null,
);

const headwordSize = computed(() => headwordSizePx(entry.value?.word ?? ''));

// The said-on date is the one date the app renders as text, and it is
// rendered in the reader's locale: the mocks' fixed "10 May 2026" would be
// a bug in fr and uk. saidAt is a plain YYYY-MM-DD, so it is formatted in
// UTC — the calendar day is the fact, and a negative-offset viewer must not
// be shown the day before.
const saidAtLabel = computed(() => {
  const value = entry.value?.saidAt;
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
});

// The frozen age rides the date row as well as the metaline — the speaker
// spec puts it in both, because the date is what the age is measured from.
const saidLine = computed(() => {
  if (!entry.value) return '';
  const age = formatAgeLabel(entry.value.speaker, entry.value.saidAt);
  const date = saidAtLabel.value;
  return age === null
    ? t('app.entry.saidOn', { date })
    : t('app.entry.saidOnAged', { date, age });
});

// Open on mount, per visit (spec §Behaviour): you came here for the story,
// and the fold is a reader's tool for a long one, not a gate.
const isStoryOpen = ref(true);

useHead(() => ({
  title: entry.value
    ? t('app.entry.pageTitle', { word: entry.value.word })
    : t('app.entry.pageTitleFallback'),
}));
</script>

<template>
  <NuxtLayout name="app-detail" :title="entry?.word ?? ''">
    <article v-if="entry" class="detail">
      <div class="detail__head">
        <VAvatar
          :name="speakerLead"
          :tone="entry.speaker?.tone ?? null"
          :size="52"
        />

        <p class="detail__meta">
          <span class="detail__meta-lead">{{ speakerLead }}</span
          ><span v-if="speakerRest" class="detail__meta-rest">{{
            speakerRest
          }}</span>
        </p>

        <h1 class="detail__word" :style="{ fontSize: `${headwordSize}px` }">
          <span class="detail__quote">“</span>{{ entry.word
          }}<span class="detail__quote">”</span>
        </h1>

        <p v-if="entry.gloss" class="detail__gloss">{{ entry.gloss }}</p>

        <!-- Inside the header stack, not below it: the voice is part of the
             word, not an attachment to it. -->
        <FeedMediaBlock
          v-if="media"
          class="detail__media"
          :media="media"
          :entry-id="entry.id"
          variant="big"
        />
      </div>

      <div v-if="entry.story" class="detail__unfold">
        <button
          type="button"
          class="detail__toggle"
          :aria-expanded="isStoryOpen"
          @click="isStoryOpen = !isStoryOpen"
        >
          <ChevronDown
            :size="16"
            class="detail__chev"
            :class="{ 'detail__chev--open': isStoryOpen }"
            aria-hidden="true"
          />
          {{
            isStoryOpen ? t('app.entry.storyHide') : t('app.entry.storyShow')
          }}
        </button>
        <p v-if="isStoryOpen" class="detail__story">{{ entry.story }}</p>
      </div>

      <!-- Read-only: collections are free text on the entry, and re-filing
           happens in edit. -->
      <div v-if="entry.collection" class="detail__collection">
        <span class="detail__chip">
          <Bookmark :size="14" aria-hidden="true" />{{ entry.collection }}
        </span>
      </div>

      <p class="detail__said">
        <span class="detail__said-body">
          <Calendar :size="13" aria-hidden="true" />{{ saidLine }}
        </span>
      </p>
    </article>

    <div v-else-if="isMissing || hasLoadError" class="detail__state">
      <span class="detail__state-icon" aria-hidden="true">
        <CircleAlert :size="30" />
      </span>
      <p class="detail__state-msg">
        {{ isMissing ? t('app.entry.notFound') : t('app.entry.loadError') }}
      </p>
      <VButton v-if="hasLoadError" variant="secondary" size="sm" @click="retry">
        {{ t('offline.tryAgain') }}
      </VButton>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: 620px;
  margin-inline: auto;
}

/* Centre-aligned column, gap 16 — the optical pulls (metaline -4, gloss -6,
   media +6) sit on the blocks themselves, not on this flow gap. */
.detail__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: var(--space-5) 0 var(--space-2);
  text-align: center;
}

.detail__meta {
  margin: -4px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.3;
  white-space: nowrap;
}

.detail__meta-lead {
  font-weight: var(--w-semibold);
  color: var(--ink);
}

.detail__meta-rest {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

/* Handwritten branch of the prototype's word style (app.jsx), same as the
   feed card: Caveat wants no negative tracking, a looser 1.2 leading, and
   bottom padding so its long descenders are not clipped. */
.detail__word {
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

.detail__quote {
  font-weight: var(--w-regular);
  color: var(--ink-3);
}

.detail__gloss {
  margin: -6px 0 0;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-style: italic;
  color: var(--ink-2);
}

.detail__media {
  margin-top: 6px;
  width: 100%;
}

.detail__unfold {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 14px;
}

.detail__toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: var(--tap-min);
  padding: var(--space-2) var(--space-1);
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  color: var(--link);
  white-space: nowrap;
}

.detail__chev {
  transition: transform var(--dur-base) var(--ease-out);
}

.detail__chev--open {
  transform: rotate(180deg);
}

/* The one place centred body copy is right: the block is short, the page is
   a keepsake, and the column is built around the word's axis. */
.detail__story {
  margin: 6px 0 0;
  max-width: 330px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-relaxed);
  color: var(--ink);
  text-align: center;
}

.detail__collection {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}

.detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: var(--r-sm);
  background: var(--surface-sunk);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: var(--w-semibold);
  color: var(--ink-2);
}

.detail__said {
  display: flex;
  justify-content: center;
  margin: 16px 0 0;
}

.detail__said-body {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: var(--space-2) 6px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
}

/* Centred load failure, mirroring the feed's own state. */
.detail__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-16) var(--space-6);
  text-align: center;
}

.detail__state-icon {
  display: inline-flex;
  color: var(--danger);
}

.detail__state-msg {
  margin: 0;
  max-width: 300px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .detail__chev {
    transition: none;
  }
}
</style>
