interface HistoryRouter {
  back: () => void;
  options: { history: { state: { back?: unknown } } };
}

type Navigate = (to: string, options: { replace: boolean }) => unknown;

// REPLACE, never push, when nothing of ours is behind: pushing would park the
// word behind the OS back button, so back would walk into the screen just left
// and every round trip would grow the stack.
//
// Accepted limitation: a feed link tapped before hydration is a native
// document navigation that leaves no router state, so this takes the replace
// branch even though that feed document stays behind the OS back button, and
// the feed's scroll is gone.
export const leaveToFeed = async (
  router: HistoryRouter,
  navigate: Navigate,
): Promise<void> => {
  const previous = router.options.history.state.back;
  if (typeof previous === 'string') {
    router.back();
    return;
  }
  await navigate('/feed', { replace: true });
};
