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

// The list survives route hops in useState (VKB-144): a return to the feed
// renders the cached words immediately while a refresh runs in the
// background. me.vue purges both keys on logout — in-memory or not, this is
// user data, and the next account signing in from the same tab must never
// see it.
const entries = useState<FeedEntry[]>('feed-cache-entries', () => []);
const nextCursor = useState<string | null>('feed-cache-cursor', () => null);
const loadingMore = ref(false);

// A revisit is a CLIENT-side arrival that found words already cached. On a
// hard load the cache is also non-empty by the time the client runs — the
// SSR pass seeded it and the payload carried it over — but that data is
// seconds old and needs no re-validation; `isHydrating` is what tells the
// two apart. Evaluated at setup: onMounted is too late (seeding has
// happened) and the distinction is gone.
const isRevisit = !useNuxtApp().isHydrating && entries.value.length > 0;

// Bounds what the cache keeps across route hops. Within one visit the list
// grows only as far as the user pages it; without a cap those pages would
// now also accumulate for the lifetime of the tab.
const FEED_CACHE_MAX_ENTRIES = 200;

// Two kinds of writers race for `entries`: resolutions of the asyncData
// below (initial load, retry) and refreshFirstPage() calls (poll ticks,
// compose, revisits). Responses apply in REQUEST order — a response whose
// request started before the last applied one is dropped, so a slow refresh
// can never push a 'ready' entry back to 'processing' or resurrect a word a
// newer response already removed.
let fetchSeq = 0;
let appliedSeq = 0;
let asyncDataSeq = 0;

const isOlderThan = (entry: FeedEntry, boundary: FeedEntry) =>
  entry.createdAt < boundary.createdAt ||
  (entry.createdAt === boundary.createdAt && entry.id < boundary.id);

// The single writer of `entries`: the fresh first page replaces exactly the
// window it covers — applying edits, deletions and status flips — while
// entries the user paged in BELOW that window survive as the tail (an edit
// down there stays stale until a full reload; accepted trade-off). The tail
// keeps its own continuation cursor, unless the cap trims it — the cursor is
// "<createdAt>_<id>" of the last kept row (server/api/entries/index.get.ts),
// both fields the row itself carries.
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

// A 401 on any feed request means the session is gone (revoked elsewhere,
// expired). The auth middleware skips its probe on tab hops precisely
// because "the server re-authorizes every data request" — so this is where
// that answer must be acted on: drop the (now unauthorized) cached words and
// hand over to /login.
const isUnauthorized = (error: unknown) => {
  const status = error as { statusCode?: number; status?: number };
  return status?.statusCode === 401 || status?.status === 401;
};

const handleSignedOut = () => {
  entries.value = [];
  nextCursor.value = null;
  return navigateTo('/login');
};

// Ties every raw fetch this page starts to the mount that started it. The
// seq guards below order writers WITHIN one mount, but `entries` is shared
// state and a request that outlives its mount would re-enter a later visit
// with a frozen watermark — or, worse, resolve after a logout and put the
// previous account's words back on screen. Aborting on unmount makes both
// impossible by construction: no feed request survives leaving the page.
// (The asyncData leg needs none of this — its watchers die with the scope.)
const disposal = new AbortController();

// useRequestFetch forwards the incoming request's cookies during SSR (a bare
// $fetch to an internal route does not), so the first render is authenticated
// instead of 401ing into the error state. On the client it is a normal $fetch.
//
// `lazy` is the actual VKB-144 fix: a blocking asyncData suspends the route
// transition itself, freezing the PREVIOUS view for the whole round-trip
// with no feedback at all. With lazy the awaited promise resolves without
// waiting for the fetch on client-side navigation, so the page lands at
// once — while on the server the await still holds the render until the
// data is in, keeping the first response fully-formed HTML. The states
// below cover the client gap (spinner on an empty cache, slim progress bar
// over a cached list). immediate is per-visit: it fires only when there is
// nothing cached to show — a revisit refreshes through refreshFirstPage()
// in onMounted instead, on the same ordered path as the poll.
const requestFetch = useRequestFetch();
const { data, status, error, refresh } = await useAsyncData(
  'feed',
  () => {
    asyncDataSeq = ++fetchSeq;
    return requestFetch<FeedResponse>('/api/entries');
  },
  { lazy: true, immediate: entries.value.length === 0 },
);

// The server pass seeds here: the await above has resolved `data`, the
// useState cache is empty, and this fills it before the render — payload
// serialization then hands the filled cache to the client, so hydration
// itself needs no seeding (entries arrive non-empty and this call skips).
// The seq is minted, NOT read from asyncDataSeq: when `data` comes out of
// a cache without running the handler, asyncDataSeq is still zero and
// would lose to appliedSeq's initial zero, silently dropping the seed. A
// revisit (non-empty cache) skips too — its `data` is the previous visit's
// response, while the cache is same-or-fresher.
if (entries.value.length === 0) applyFirstPage(data.value, ++fetchSeq);
// A 401 the await above brought back is acted on IN setup, where SSR still
// tracks the redirect — from a watcher the server may finalize the response
// before navigateTo's async work lands, shipping a blank feed instead of
// the 302.
if (error.value && isUnauthorized(error.value)) await handleSignedOut();
// Client-side resolutions: the lazy initial load and retry() land here.
watch(data, (res) => applyFirstPage(res, asyncDataSeq));
watch(error, async (raw) => {
  if (raw && isUnauthorized(raw)) await handleSignedOut();
});

const isInitialLoading = computed(
  () => status.value === 'pending' && entries.value.length === 0,
);
// The gentle indicator of a revisit's background refresh over an
// already-visible list. A failed (non-401) refresh just drops the bar: the
// cached words stay, and the server stays the authority next time around.
const revalidating = ref(false);
const isRefreshing = computed(
  () =>
    revalidating.value ||
    (status.value === 'pending' && entries.value.length > 0),
);
const hasLoadError = computed(
  () => status.value === 'error' && entries.value.length === 0,
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
    // A refresh resolving mid-flight can slide the first-page window down
    // over rows this page also carries; keyed dedup keeps the append safe
    // in that overlap instead of double-rendering a word.
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
  entries.value
    .filter((entry) => entry.media?.status === 'processing')
    .map((entry) => entry.id)
    .join(','),
);

// Fetch the freshest first page and reconcile it into local state through
// applyFirstPage — the poll, a compose, and a revisit all share this one
// path. Single-flight: a tick that finds a refresh already in the air skips
// instead of stacking a second request; the seq guard in applyFirstPage
// covers the writer this flag cannot see (the asyncData resolutions).
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

// The revisit leg of VKB-144: cached words are already on screen, so
// re-validate them behind the slim progress bar instead of blocking
// anything. Gated on isRevisit, not on the cache being non-empty: a hard
// load also reaches here with a seeded cache (this mount's own SSR fetch),
// and re-fetching data that is seconds old would double every first load
// and flash the bar over a fresh page.
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
    <!-- Background refresh over a cached list: a slim indeterminate bar,
         not a takeover — the words underneath stay readable throughout. -->
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

    <FeedEmptyState v-else-if="entries.length === 0" />

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

/* Track of the background-refresh bar. 2px tall and unobtrusive by design:
   the refresh is an update to content the user is already reading. */
.feed__refresh {
  position: relative;
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
