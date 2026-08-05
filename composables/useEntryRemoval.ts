// Why the feed cannot just refetch after a delete: VKB-142.
export const useEntryRemoval = () => {
  const removedIds = useState<string[]>('entries:removed', () => []);

  const notifyRemoved = (id: string) => {
    if (removedIds.value.includes(id)) return;
    removedIds.value = [...removedIds.value, id];
  };

  return { removedIds, notifyRemoved };
};
