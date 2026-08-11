// Lazy playback-URL resolver for feed entries (VKB-66). GET /api/entries/[id]
// returns a `playback` object only when the entry's media is `ready`; the URLs
// are S3 presigned GETs that expire after ~1h. The audio player calls this on
// first play to fetch the presigned audioUrl on demand rather than eagerly for
// every card in the feed, and re-calls with force=true to refetch once after a
// playback error (an expired URL is the likely cause).

interface PlaybackUrls {
  videoUrl: string | null;
  posterUrl: string | null;
  audioUrl: string | null;
}

interface EntryDetailResponse {
  playback: PlaybackUrls | null;
}

// Module-level cache shared across every component instance: a given entry's
// presigned URLs are resolved once and reused until an explicit force refetch.
//
// Bounded, because module state outlives every component that reads it: a long
// scrolling session would otherwise accumulate entries for the lifetime of the
// tab. Oldest-first eviction suits the access pattern — the feed is reverse
// chronological, so the entries pushed out are the ones scrolled past, and a
// re-resolve costs one request. It also caps how long an evicted (and by then
// likely expired) URL can linger.
const CACHE_LIMIT = 100;
const cache = new Map<string, PlaybackUrls>();

const remember = (entryId: string, playback: PlaybackUrls) => {
  // Re-insert so refreshed entries move to the newest position.
  cache.delete(entryId);
  cache.set(entryId, playback);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
};

// Editing a word can replace or remove the clip behind these URLs, and the
// cache would otherwise keep playing the old one until eviction (VKB-110).
export const forgetPlayback = (entryId: string) => {
  cache.delete(entryId);
};

export const useEntryPlayback = () => {
  // The word detail screen already fetched GET /api/entries/:id — including
  // its `playback` — to render the page. Handing that payload over here
  // means the player it mounts does not repeat the same request on first
  // play.
  //
  // The client guard is prophylactic, not a fix for a leak: `resolvePlayback`
  // is only ever reached from a user gesture, so nothing reads this cache
  // during SSR and no presigned URL has ever crossed between requests. What
  // the guard buys is that the shared module state is not WRITTEN on the
  // server either — the day something does read it there, the isolation is
  // already in place, and it sits with the cache rather than in every caller
  // that might arrive later.
  const primePlayback = (entryId: string, playback: PlaybackUrls | null) => {
    if (!import.meta.client || !playback) return;
    remember(entryId, playback);
  };

  const resolvePlayback = async (
    entryId: string,
    force = false,
  ): Promise<PlaybackUrls | null> => {
    if (!force) {
      const cached = cache.get(entryId);
      if (cached) return cached;
    }
    try {
      const res = await $fetch<EntryDetailResponse>(
        // Ids are uuids today, so nothing here needs escaping — encoded anyway
        // so the call cannot become the reason a future id shape breaks.
        '/api/entries/' + encodeURIComponent(entryId),
        { credentials: 'include' },
      );
      const { playback } = res;
      // `playback` stays null while media is still processing or has failed —
      // don't cache that, so a later call retries once the media is ready.
      if (playback) remember(entryId, playback);
      return playback;
    } catch (error) {
      console.error('[entry-playback] resolve failed', error);
      return null;
    }
  };

  return { primePlayback, resolvePlayback };
};
