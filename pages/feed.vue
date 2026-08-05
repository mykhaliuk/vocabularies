<script setup lang="ts">
import { CircleAlert, Loader2, RotateCcw } from 'lucide-vue-next';

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

const entries = useState<FeedEntry[]>('feed-cache-entries', () => []);
const nextCursor = useState<string | null>('feed-cache-cursor', () => null);
const loadingMore = ref(false);

// A hard load also lands with a seeded cache (its own SSR pass); only
// isHydrating tells it from a revisit, and only before the seeding below.
const isRevisit = !useNuxtApp().isHydrating && entries.value.length > 0;

const FEED_CACHE_MAX_ENTRIES = 200;

// Responses apply in request order; an older in-flight response is dropped.
let fetchSeq = 0;
let appliedSeq = 0;
let asyncDataSeq = 0;

const isOlderThan = (entry: FeedEntry, boundary: FeedEntry) =>
  entry.createdAt < boundary.createdAt ||
  (entry.createdAt === boundary.createdAt && entry.id < boundary.id);

// Fresh page 1 replaces the window it covers; paged-in entries below it
// survive as the tail. A trimmed tail gets a client-minted cursor —
// "<createdAt>_<id>" (server/api/entries/index.get.ts).
const applyFirstPage = (res: FeedResponse | null | undefined, seq: number) => {
  if (!res || seq <= appliedSeq) return;
  appliedSeq = seq;
  const fresh = res.entries;
  const boundary = fresh[fresh.length - 1];
  if (!boundary) {
    entries.value = [];
    nextCursor.value = res.nextCursor;
    return;
  }
  const tail = entries.value.filter((entry) => isOlderThan(entry, boundary));
  const kept = [...fresh, ...tail].slice(0, FEED_CACHE_MAX_ENTRIES);
  entries.value = kept;
  if (tail.length === 0) {
    nextCursor.value = res.nextCursor;
  } else if (kept.length < fresh.length + tail.length) {
    const lastKept = kept[kept.length - 1] as FeedEntry;
    nextCursor.value = `${lastKept.createdAt}_${lastKept.id}`;
  }
};

// Tab hops skip the auth middleware probe — a 401 here IS the
// re-authorization answer and must not hide behind the cached words.
const isUnauthorized = (error: unknown) => {
  const status = error as { statusCode?: number; status?: number };
  return status?.statusCode === 401 || status?.status === 401;
};

const handleSignedOut = () => {
  entries.value = [];
  nextCursor.value = null;
  // Or the seed below replants it for the next account in this tab.
  clearNuxtData('feed');
  return navigateTo('/login');
};

// No feed request survives leaving the page: a late resolution would write
// into a later visit (or account) with a stale seq watermark.
const disposal = new AbortController();

// useRequestFetch forwards the incoming request's cookies during SSR (a bare
// $fetch to an internal route does not), so the first render is authenticated
// instead of 401ing into the error state. On the client it is a normal $fetch.
//
// Without `lazy` this await suspends the route transition itself — the
// VKB-144 freeze; with it, client navigation lands at once and SSR still
// awaits the data.
const requestFetch = useRequestFetch();
const { data, status, error, refresh } = await useAsyncData(
  'feed',
  () => {
    asyncDataSeq = ++fetchSeq;
    return requestFetch<FeedResponse>('/api/entries');
  },
  { lazy: true, immediate: entries.value.length === 0 },
);

// Server-pass seed; hydration gets it via the useState payload. Seq is
// minted because a cached `data` never ran the handler — asyncDataSeq
// would still be 0 and lose to appliedSeq's 0.
if (entries.value.length === 0) applyFirstPage(data.value, ++fetchSeq);
// In setup, where SSR still tracks the redirect; a watcher can lose the
// race against response finalization.
if (error.value && isUnauthorized(error.value)) await handleSignedOut();
watch(data, (res) => applyFirstPage(res, asyncDataSeq));
watch(error, async (raw) => {
  if (raw && isUnauthorized(raw)) await handleSignedOut();
});

const { removedIds } = useEntryRemoval();
const visibleEntries = computed(() =>
  entries.value.filter((entry) => !removedIds.value.includes(entry.id)),
);

const isEmpty = computed(
  () => visibleEntries.value.length === 0 && nextCursor.value === null,
);

const isInitialLoading = computed(
  () => status.value === 'pending' && entries.value.length === 0,
);
const revalidating = ref(false);
const isRefreshing = computed(
  () =>
    revalidating.value ||
    (status.value === 'pending' && entries.value.length > 0),
);
const hasLoadError = computed(
  () => status.value === 'error' && visibleEntries.value.length === 0,
);

const retry = async () => {
  try {
    await refresh();
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
      { credentials: 'include', signal: disposal.signal },
    );
    // A refresh landing mid-flight can already carry rows from this page.
    const known = new Set(entries.value.map((entry) => entry.id));
    const appended = res.entries.filter((entry) => !known.has(entry.id));
    entries.value = [...entries.value, ...appended];
    nextCursor.value = res.nextCursor;
  } catch (error) {
    if (disposal.signal.aborted) return;
    if (isUnauthorized(error)) {
      await handleSignedOut();
      return;
    }
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
  visibleEntries.value
    .filter((entry) => entry.media?.status === 'processing')
    .map((entry) => entry.id)
    .join(','),
);

// Single-flight; the seq guard covers the one writer this flag cannot see
// (the asyncData resolutions).
let refreshInFlight = false;

const refreshFirstPage = async () => {
  if (refreshInFlight) return;
  refreshInFlight = true;
  const seq = ++fetchSeq;
  try {
    const res = await $fetch<FeedResponse>('/api/entries', {
      credentials: 'include',
      signal: disposal.signal,
    });
    applyFirstPage(res, seq);
  } catch (error) {
    if (disposal.signal.aborted) return;
    if (isUnauthorized(error)) {
      await handleSignedOut();
      return;
    }
    console.error('feed refresh failed', error);
  } finally {
    refreshInFlight = false;
  }
};

// isRevisit, not cache-non-empty: a hard load reaches here with its own
// SSR's seed and would double-fetch every first load.
onMounted(async () => {
  if (!isRevisit) return;
  revalidating.value = true;
  try {
    await refreshFirstPage();
  } finally {
    revalidating.value = false;
  }
});

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
    void refreshFirstPage();
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
// view right away. The refresh changes the processing set, so the watcher
// above restarts the poll with a fresh attempt budget.
const { postedVersion } = useCompose();
watch(postedVersion, () => {
  void refreshFirstPage();
});

onUnmounted(() => {
  stopPolling();
  disposal.abort();
});
</script>

<template>
  <div class="feed">
    <div
      v-if="isRefreshing"
      class="feed__refresh"
      role="progressbar"
      :aria-label="$t('app.feed.refreshing')"
    >
      <span class="feed__refresh-bar" aria-hidden="true" />
    </div>

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

    <div v-else-if="isInitialLoading" class="feed__state" role="status">
      <span
        class="feed__state-icon feed__state-icon--loading"
        aria-hidden="true"
      >
        <Loader2 :size="30" />
      </span>
      <p class="feed__state-msg">{{ $t('app.feed.loading') }}</p>
    </div>

    <FeedEmptyState v-else-if="isEmpty" />

    <div v-else class="feed__list">
      <template v-for="(entry, index) in visibleEntries" :key="entry.id">
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
        <p v-else-if="visibleEntries.length > 0" class="feed__end">
          {{ $t('app.feed.end') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.feed {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  max-width: var(--app-column);
  margin-inline: auto;
}

/* Overlaid, not in flow: appearing and disappearing must never shift the
   list under the reader. */
.feed__refresh {
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  overflow: hidden;
  border-radius: var(--r-pill);
}

.feed__refresh-bar {
  display: block;
  height: 100%;
  width: 40%;
  border-radius: var(--r-pill);
  background: var(--primary);
  animation: feed-sweep 1100ms ease-in-out infinite;
}

/* The bar is 40% of the track: -100% of itself starts fully off-screen left,
   350% of itself (= 140% of the track) ends fully off-screen right. */
@keyframes feed-sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(350%);
  }
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

/* After the base rule: same specificity, so source order is what lets the
   loading variant drop the error red. */
.feed__state-icon--loading {
  color: var(--ink-3);
  animation: feed-spin 700ms linear infinite;
}

@keyframes feed-spin {
  to {
    transform: rotate(360deg);
  }
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

  /* Still perceivable, no longer travelling: the bar breathes in place. */
  .feed__refresh-bar {
    width: 100%;
    animation: feed-pulse 1600ms ease-in-out infinite;
  }

  @keyframes feed-pulse {
    0%,
    100% {
      opacity: 0.25;
    }

    50% {
      opacity: 0.6;
    }
  }
}
</style>
