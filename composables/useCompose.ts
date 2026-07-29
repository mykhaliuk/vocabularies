// Shared compose-sheet state. The FAB (in AppBottomNav), the sheet (mounted in
// the app layout), and the feed page live in different component trees, so the
// open flag and the "an entry was just posted" signal are held in useState
// singletons rather than a module ref (SSR-safe, no hydration mismatch).
export const useCompose = () => {
  const isOpen = useState('compose:open', () => false);
  // Bumped after a successful post so the feed can pull the fresh (processing)
  // entry into view without a full navigation.
  const postedVersion = useState('compose:posted', () => 0);

  const open = () => {
    isOpen.value = true;
  };
  const close = () => {
    isOpen.value = false;
  };
  const notifyPosted = () => {
    postedVersion.value += 1;
  };

  return { isOpen, postedVersion, open, close, notifyPosted };
};
