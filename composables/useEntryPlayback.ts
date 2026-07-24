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
const cache = new Map<string, PlaybackUrls>();

export const useEntryPlayback = () => {
  const resolvePlayback = async (
    entryId: string,
    force = false,
  ): Promise<PlaybackUrls | null> => {
    if (!force) {
      const cached = cache.get(entryId);
      if (cached) return cached;
    }
    try {
      const res = await $fetch<EntryDetailResponse>('/api/entries/' + entryId, {
        credentials: 'include',
      });
      const { playback } = res;
      // `playback` stays null while media is still processing or has failed —
      // don't cache that, so a later call retries once the media is ready.
      if (playback) cache.set(entryId, playback);
      return playback;
    } catch (error) {
      console.error('[entry-playback] resolve failed', error);
      return null;
    }
  };

  return { resolvePlayback };
};
