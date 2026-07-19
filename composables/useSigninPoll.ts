import { MAGIC_LINK_TTL_MS, POLL_KEY_PATTERN } from '~/shared/magic-link';

// Cross-jar sign-in poll/claim client (VKB-70). An installed standalone PWA
// has its own cookie/storage jar, so the emailed magic link — which opens in
// Safari — can never set the session cookie in the PWA. Instead the PWA mints
// a high-entropy poll key, sends its hash to bind the pending sign-in, then
// polls /api/auth/poll: once the link click arms the claim, the poll issues
// the session cookie into the PWA's own jar. The key is a bearer secret; it
// lives only in this jar and is cleared on success or expiry.
//
// The live poll key is held in the composable closure (activeKey) as the
// source of truth; localStorage is best-effort persistence, used only to
// resume after a cold start (iOS evicts a backgrounded PWA while the user is
// in Mail). A failed persist therefore degrades resume-across-restart but
// never blocks the current session's polling.

const STORAGE_KEY = 'vocabu_poll';
const POLL_START_MS = 2000;
const POLL_MAX_MS = 8000;
const POLL_FACTOR = 1.5;

interface StoredPoll {
  key: string;
  email: string;
  deadline: number;
}

interface PollResponse {
  status: 'pending' | 'ready';
}

// Only installed PWAs need the poll/claim path — a plain browser opens the
// link in the same jar and the callback cookie just works. Gating here keeps
// the desktop/browser flow byte-identical: no poll key, no claim row.
const isStandalone = (): boolean => {
  if (!import.meta.client) return false;
  const displayStandalone = window.matchMedia?.(
    '(display-mode: standalone)',
  ).matches;
  // iOS Safari signals a standalone launch via this non-standard flag.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return Boolean(displayStandalone || iosStandalone);
};

const removeStored = (): void => {
  if (!import.meta.client) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[signin-poll] clear failed', error);
  }
};

const readStored = (): StoredPoll | null => {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPoll;
    if (
      typeof parsed?.key !== 'string' ||
      !POLL_KEY_PATTERN.test(parsed.key) ||
      typeof parsed.email !== 'string' ||
      typeof parsed.deadline !== 'number'
    ) {
      // Well-formed JSON but not a usable poll entry — drop it so the next
      // send mints a fresh key rather than reusing a malformed one.
      removeStored();
      return null;
    }
    return parsed;
  } catch (error) {
    // A corrupt value would fail every tick — log once and drop it so the
    // read self-heals instead of silently never polling.
    console.error('[signin-poll] read failed', error);
    removeStored();
    return null;
  }
};

const writeStored = (value: StoredPoll): void => {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (error) {
    // Best-effort only: activeKey still drives polling this session; we just
    // lose the ability to resume after a cold restart.
    console.error('[signin-poll] persist failed (resume disabled)', error);
  }
};

const mintKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const useSigninPoll = () => {
  // Live state — activeKey is the source of truth for the running poll.
  let activeKey: string | null = null;
  let activeEmail = '';
  let deadline = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = POLL_START_MS;
  let listening = false;
  // Exactly one poll request may be in flight at a time — a visibilitychange
  // flap must not launch a second concurrent chain (would multiply the request
  // rate and can trip the server's per-IP bucket on shared egress).
  let inFlight = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function stopPolling(): void {
    clearTimer();
    if (listening && import.meta.client) {
      document.removeEventListener('visibilitychange', onVisible);
      listening = false;
    }
  }

  function clear(): void {
    stopPolling();
    activeKey = null;
    activeEmail = '';
    deadline = 0;
    removeStored();
  }

  function scheduleNext(): void {
    clearTimer();
    if (Date.now() >= deadline) {
      clear();
      return;
    }
    timer = setTimeout(pollOnce, backoffMs);
    backoffMs = Math.min(Math.round(backoffMs * POLL_FACTOR), POLL_MAX_MS);
  }

  async function pollOnce(): Promise<void> {
    timer = null;
    const key = activeKey;
    if (!key) {
      stopPolling();
      return;
    }
    if (Date.now() >= deadline) {
      clear();
      return;
    }
    // Single-chain guard: if a request is already awaiting, do nothing — that
    // chain will reschedule when it resolves.
    if (inFlight) return;
    inFlight = true;
    try {
      const res = await $fetch<PollResponse>('/api/auth/poll', {
        method: 'POST',
        body: { pollKey: key },
      });
      if (res.status === 'ready') {
        clear();
        await navigateTo('/me');
        return;
      }
    } catch (error) {
      // Transient (429 / 5xx / network): only a ready response ends the loop;
      // everything else retries with backoff until the deadline.
      console.error('[signin-poll] poll attempt failed', error);
    } finally {
      inFlight = false;
    }
    scheduleNext();
  }

  function onVisible(): void {
    if (document.visibilityState !== 'visible') return;
    // The user just returned to the PWA — the link was likely clicked while we
    // were backgrounded. Reset the backoff so the next poll is soon; if a poll
    // is already in flight, let it reschedule rather than starting a second
    // chain. Otherwise cancel the pending timer and poll now.
    backoffMs = POLL_START_MS;
    if (inFlight) return;
    clearTimer();
    void pollOnce();
  }

  function beginPolling(): void {
    if (!import.meta.client || !activeKey) return;
    backoffMs = POLL_START_MS;
    if (!listening) {
      document.addEventListener('visibilitychange', onVisible);
      listening = true;
    }
    clearTimer();
    // First poll is immediate: the link may already be clicked by the time the
    // "check your inbox" screen renders (fast users, same-device open).
    void pollOnce();
  }

  // Returns the poll key to send with the magic-link request, or undefined when
  // not an installed PWA. Reuses the stored key for a resend of the same email
  // so clicking any of the resent links arms the one claim the PWA polls.
  function prepareKey(email: string): string | undefined {
    if (!isStandalone()) return undefined;
    const stored = readStored();
    activeKey =
      stored && stored.email === email && stored.deadline > Date.now()
        ? stored.key
        : mintKey();
    activeEmail = email;
    deadline = Date.now() + MAGIC_LINK_TTL_MS;
    writeStored({ key: activeKey, email: activeEmail, deadline });
    return activeKey;
  }

  // Cold-start resume: on a fresh mount (iOS evicted the PWA while the user was
  // in Mail), re-attach to a still-valid persisted poll so the armed claim is
  // collected instead of silently showing the empty login form. Returns the
  // bound email so the caller can restore the "check your inbox" state.
  function resume(): { email: string } | null {
    if (!import.meta.client) return null;
    const stored = readStored();
    if (!stored) return null;
    if (stored.deadline <= Date.now()) {
      removeStored();
      return null;
    }
    activeKey = stored.key;
    activeEmail = stored.email;
    deadline = stored.deadline;
    beginPolling();
    return { email: stored.email };
  }

  onScopeDispose(stopPolling);

  return { prepareKey, beginPolling, resume, stopPolling, clear };
};
