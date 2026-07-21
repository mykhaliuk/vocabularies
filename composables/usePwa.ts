// Installed standalone PWA detection (VKB-70). An installed PWA runs in its own
// cookie/storage jar, so it needs the cross-jar poll/claim sign-in path and must
// be routed to /login — the flow's home — rather than the codeless marketing
// landing. This is the ONE detector: both useSigninPoll (whether to mint a poll
// key) and the landing redirect read it, so the two can never disagree about
// what "standalone" means. Auto-imported by Nuxt from composables/.
export const isStandalone = (): boolean => {
  if (!import.meta.client) return false;
  const displayStandalone = window.matchMedia?.(
    '(display-mode: standalone)',
  ).matches;
  // iOS Safari signals a standalone launch via this non-standard flag.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return Boolean(displayStandalone || iosStandalone);
};
