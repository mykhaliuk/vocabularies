// The counterpart of useCompose's `postedVersion`: a word kept is pulled into
// the feed, a word deleted is dropped from it, and neither costs a fetch.
//
// The detail screen and the feed are different pages, so the signal is a
// useState singleton rather than a module ref (SSR-safe, no hydration
// mismatch). Ids only, never rows: the feed already holds the row and needs
// nothing from the screen that deleted it.
//
// Bounded by how many words one session deletes, so an array of short strings
// reads better than a Set here and the whole thing stays JSON-serialisable
// across the SSR payload.
export const useEntryRemoval = () => {
  const removedIds = useState<string[]>('entries:removed', () => []);

  const notifyRemoved = (id: string) => {
    if (removedIds.value.includes(id)) return;
    removedIds.value = [...removedIds.value, id];
  };

  return { removedIds, notifyRemoved };
};
