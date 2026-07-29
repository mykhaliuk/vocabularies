<script setup lang="ts">
import { CircleAlert, RotateCcw } from 'lucide-vue-next';

definePageMeta({ layout: 'app', middleware: 'auth' });

// Shapes returned by GET /api/entries (declared inline — no DTO layer).
type FeedMedia = {
  mediaId: string;
  kind: 'audio' | 'video';
  status: 'processing' | 'ready' | 'failed';
  durationSec: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
  error: string | null;
};

type FeedSpeaker = {
  name: string;
  tone: 'rose' | 'blue' | 'ink' | null;
  rel: string | null;
  birthday: string | null;
};

type FeedEntry = {
  id: string;
  word: string;
  gloss: string | null;
  speaker: FeedSpeaker | null;
  saidAt: string;
  story: string | null;
  collection: string | null;
  createdAt: string;
  media: FeedMedia | null;
};

type FeedResponse = { entries: FeedEntry[]; nextCursor: string | null };

const { t } = useI18n();
useHead(() => ({ title: t('app.feed.pageTitle') }));

// While any entry is still transcoding, re-poll the first page so a
// just-composed word flips from processing to ready without a manual refresh.
// Bounded: an abandoned upload leaves its row 'processing' forever (the bytes
// were never confirmed), and that must not pin the page to an endless loop.
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 75; // ~5 minutes, matching the worker's own ceiling

const entries = ref<FeedEntry[]>([]);
const nextCursor = ref<string | null>(null);
const loadingMore = ref(false);

// useRequestFetch forwards the incoming request's cookies during SSR (a bare
// $fetch to an internal route does not), so the first render is authenticated
// instead of 401ing into the error state. On the client it is a normal $fetch.
const requestFetch = useRequestFetch();
const { data, status, refresh } = await useAsyncData('feed', () =>
  requestFetch<FeedResponse>('/api/entries'),
);

const seed = (res: FeedResponse | null | undefined) => {
  if (!res) return;
  entries.value = [...res.entries];
  nextCursor.value = res.nextCursor;
};

// Seed once from the resolved payload. We deliberately do NOT watch `data`:
// pagination and polling mutate `entries` locally, and a blind re-seed would
// drop every appended page.
seed(data.value);

const isInitialLoading = computed(() => status.value === 'pending');
const hasLoadError = computed(
  () => status.value === 'error' && entries.value.length === 0,
);

const retry = async () => {
  try {
    await refresh();
    seed(data.value);
  } catch (error) {
    console.error('feed retry failed', error);
  }
};

const loadMoreFailed = ref(false);

const loadMore = async () => {
  const cursor = nextCursor.value;
  if (!cursor || loadingMore.value) return;
  loadingMore.value = true;
  loadMoreFailed.value = false;
  try {
    const res = await $fetch<FeedResponse>(
      '/api/entries?cursor=' + encodeURIComponent(cursor),
      { credentials: 'include' },
    );
    entries.value = [...entries.value, ...res.entries];
    nextCursor.value = res.nextCursor;
  } catch (error) {
    console.error('feed loadMore failed', error);
    loadMoreFailed.value = true;
  } finally {
    loadingMore.value = false;
  }
};

// Keyed by WHICH entries are processing, not merely whether any are. The
// attempt budget below is per batch, and a plain boolean is edge-triggered:
// once a stuck row spent the budget, a later upload joining that same `true`
// state would never restart the timer, and would sit on 'processing' until a
// manual refresh. A changed set is evidence of new work, so it earns a fresh
// budget; a set that never changes still exhausts one and stops.
const processingKey = computed(() =>
  entries.value
    .filter((entry) => entry.media?.status === 'processing')
    .map((entry) => entry.id)
    .join(','),
);

// Merge the freshest first page into local state: update media/status on
// entries we already show and prepend any entries composed since last load,
// while preserving the order of pages the user has already paged in.
// Single-flight: overlapping polls could otherwise land out of order and let
// an older response push a 'ready' entry back to 'processing'.
let merging = false;

const mergeFirstPage = async () => {
  if (merging) return;
  merging = true;
  try {
    const res = await $fetch<FeedResponse>('/api/entries', {
      credentials: 'include',
    });
    const freshById = new Map(res.entries.map((entry) => [entry.id, entry]));
    const knownIds = new Set(entries.value.map((entry) => entry.id));

    const prepended = res.entries.filter((entry) => !knownIds.has(entry.id));
    const updated = entries.value.map((entry) => {
      const fresh = freshById.get(entry.id);
      return fresh ? { ...entry, media: fresh.media } : entry;
    });

    entries.value = [...prepended, ...updated];
  } catch (error) {
    console.error('feed poll failed', error);
  } finally {
    merging = false;
  }
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollAttempts = 0;

const stopPolling = () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const startPolling = () => {
  if (!import.meta.client || pollTimer !== null) return;
  pollAttempts = 0;
  pollTimer = setInterval(() => {
    pollAttempts += 1;
    if (pollAttempts > POLL_MAX_ATTEMPTS) {
      stopPolling();
      return;
    }
    void mergeFirstPage();
  }, POLL_INTERVAL_MS);
};

watch(
  processingKey,
  (key) => {
    stopPolling();
    if (key !== '') startPolling();
  },
  { immediate: true },
);

// A word composed via the sheet lands as a processing entry; pull it into
// view right away. The merge changes the processing set, so the watcher
// above restarts the poll with a fresh attempt budget.
const { postedVersion } = useCompose();
watch(postedVersion, () => {
  void mergeFirstPage();
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="feed">
    <div v-if="hasLoadError" class="feed__state">
      <span class="feed__state-icon" aria-hidden="true">
        <CircleAlert :size="30" />
      </span>
      <p class="feed__state-msg">{{ $t('app.feed.loadError') }}</p>
      <VButton variant="secondary" size="sm" @click="retry">
        <template #left><RotateCcw :size="16" /></template>
        {{ $t('offline.tryAgain') }}
      </VButton>
    </div>

    <FeedEmptyState v-else-if="entries.length === 0 && !isInitialLoading" />

    <div v-else class="feed__list">
      <template v-for="(entry, index) in entries" :key="entry.id">
        <div v-if="index > 0" class="feed__divider" aria-hidden="true" />
        <FeedEntryCard :entry="entry" />
      </template>

      <div class="feed__divider" aria-hidden="true" />
      <div class="feed__footer">
        <button
          v-if="nextCursor"
          type="button"
          class="feed__more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{
            loadMoreFailed
              ? $t('app.feed.loadMoreRetry')
              : $t('app.feed.loadMore')
          }}
        </button>
        <p v-else-if="entries.length > 0" class="feed__end">
          {{ $t('app.feed.end') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: 620px;
  margin-inline: auto;
}

.feed__list {
  display: flex;
  flex-direction: column;
}

/* Hairline between consecutive entries and closing the column — the
   edge-to-edge dividers that define the feed rhythm. */
.feed__divider {
  height: 1px;
  background: var(--hairline);
}

.feed__footer {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-5) var(--space-2);
}

/* Quiet text-button: "show more" pulls the next page in place. */
.feed__more {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--w-semibold);
  color: var(--link);
  min-height: var(--tap-min);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--r-btn);
  transition:
    color var(--dur-fast),
    background var(--dur-fast);
}

.feed__more:hover {
  background: var(--secondary-soft);
}

.feed__more:disabled {
  color: var(--ink-3);
  background: transparent;
  cursor: default;
}

.feed__end {
  margin: 0;
  text-align: center;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--ink-3);
}

/* Centered load-failure fallback with a retry. */
.feed__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  text-align: center;
  padding: var(--space-16) var(--space-6);
}

.feed__state-icon {
  display: inline-flex;
  color: var(--danger);
}

.feed__state-msg {
  margin: 0;
  max-width: 300px;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .feed__more {
    transition: none;
  }
}
</style>
