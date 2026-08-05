import type { EntryView } from '~/server/utils/entry-view';

// Shared compose-sheet state. The FAB (in AppBottomNav), the sheet (mounted in
// the app layout), and the feed page live in different component trees, so this
// state is held in useState singletons rather than module refs (SSR-safe, no
// hydration mismatch).
export const useCompose = () => {
  const isOpen = useState('compose:open', () => false);
  // Null while composing a fresh word, the entry itself while editing one.
  const editedEntry = useState<EntryView | null>('compose:edited', () => null);
  // Bumped after a successful post so the feed can pull the fresh (processing)
  // entry into view without a full navigation.
  const postedVersion = useState('compose:posted', () => 0);

  const open = () => {
    editedEntry.value = null;
    isOpen.value = true;
  };
  const openForEdit = (entry: EntryView) => {
    editedEntry.value = entry;
    isOpen.value = true;
  };
  const close = () => {
    isOpen.value = false;
  };
  const notifyPosted = () => {
    postedVersion.value += 1;
  };

  return {
    isOpen,
    editedEntry,
    postedVersion,
    open,
    openForEdit,
    close,
    notifyPosted,
  };
};
