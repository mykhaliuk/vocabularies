import type { EntryView, MediaView } from '~/server/utils/entry-view';

// Shared compose-sheet state. The FAB (in AppBottomNav), the sheet (mounted by
// the tab and detail shells alike), and the feed page live in different
// component trees, so this state is held in useState singletons rather than
// module refs (SSR-safe, no hydration mismatch).
export const useCompose = () => {
  const isOpen = useState('compose:open', () => false);
  // Null while composing a fresh word, the entry itself while editing one.
  const editedEntry = useState<EntryView | null>('compose:edited', () => null);
  // The media that entry already carries, so the slot can open in its kept
  // state without a second fetch: EntryView deliberately carries no media.
  const editedMedia = useState<MediaView | null>(
    'compose:edited-media',
    () => null,
  );
  // Bumped after a successful post so the feed can pull the fresh (processing)
  // entry into view without a full navigation.
  const postedVersion = useState('compose:posted', () => 0);
  // The same signal for an edit, carrying which word moved.
  const savedVersion = useState('compose:saved', () => 0);
  const savedEntryId = useState<string | null>('compose:saved-id', () => null);

  const open = () => {
    editedEntry.value = null;
    editedMedia.value = null;
    isOpen.value = true;
  };
  const openForEdit = (entry: EntryView, media: MediaView | null) => {
    editedEntry.value = entry;
    editedMedia.value = media;
    isOpen.value = true;
  };
  const close = () => {
    isOpen.value = false;
  };
  const notifyPosted = () => {
    postedVersion.value += 1;
  };
  const notifySaved = (entryId: string) => {
    savedEntryId.value = entryId;
    savedVersion.value += 1;
  };

  return {
    isOpen,
    editedEntry,
    editedMedia,
    postedVersion,
    savedVersion,
    savedEntryId,
    open,
    openForEdit,
    close,
    notifyPosted,
    notifySaved,
  };
};
