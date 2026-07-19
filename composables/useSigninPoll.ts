import { MAGIC_LINK_TTL_MS, POLL_KEY_PATTERN } from '~/shared/magic-link';

// Cross-jar sign-in poll/claim client (VKB-70). An installed standalone PWA
// has its own cookie/storage jar, so the emailed magic link — which opens in
// Safari — can never set the session cookie in the PWA. Instead the PWA mints
// a high-entropy poll key, sends its hash to bind the pending sign-in, then
// polls /api/auth/poll: once the link click arms the claim, the poll issues
// the session cookie into the PWA's own jar. The key is a bearer secret; it
// lives only in this jar's localStorage and is cleared on success or expiry.

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
    if (typeof parsed?.key !== 'string' || !POLL_KEY_PATTERN.test(parsed.key)) {
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
    console.error('[signin-poll] persist failed', error);
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = POLL_START_MS;
  let deadline = 0;
  let listening = false;

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
    removeStored();
  }

  function scheduleNext(): void {
    if (Date.now() >= deadline) {
      clear();
      return;
    }
    timer = setTimeout(pollOnce, backoffMs);
    backoffMs = Math.min(Math.round(backoffMs * POLL_FACTOR), POLL_MAX_MS);
  }

  async function pollOnce(): Promise<void> {
    timer = null;
    const stored = readStored();
    if (!stored) {
      stopPolling();
      return;
    }
    if (Date.now() >= deadline) {
      clear();
      return;
    }
    try {
      const res = await $fetch<PollResponse>('/api/auth/poll', {
        method: 'POST',
        body: { pollKey: stored.key },
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
    }
    scheduleNext();
  }

  function onVisible(): void {
    if (document.visibilityState !== 'visible') return;
    // The user just returned to the PWA — the link was likely clicked while we
    // were backgrounded. Poll immediately and reset the backoff.
    clearTimer();
    backoffMs = POLL_START_MS;
    void pollOnce();
  }

  function beginPolling(deadlineMs: number): void {
    if (!import.meta.client) return;
    deadline = deadlineMs;
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
    if (stored && stored.email === email && stored.deadline > Date.now()) {
      return stored.key;
    }
    const key = mintKey();
    writeStored({ key, email, deadline: Date.now() + MAGIC_LINK_TTL_MS });
    return key;
  }

  onScopeDispose(stopPolling);

  return { prepareKey, beginPolling, stopPolling, clear };
};
