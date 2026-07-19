import {
  CONFIRM_TTL_MS,
  MAGIC_LINK_TTL_MS,
  POLL_KEY_PATTERN,
} from '~/shared/magic-link';

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
  status: 'pending' | 'confirm';
}

interface ConfirmResponse {
  status: 'ready' | 'invalid' | 'expired';
}

// `not-armed`: the code was submitted before the link was clicked, so the
// server's guarded UPDATE matched no row (claim still unarmed) and returned
// `expired` — but nothing died, no attempt was consumed. The caller shows a
// gentle "open the link first" hint and keeps polling, instead of the
// request-a-new-link message reserved for a genuine post-arm expiry/lock.
export type ConfirmResult =
  | 'ready'
  | 'invalid'
  | 'not-armed'
  | 'expired'
  | 'error';

// Only installed PWAs need the poll/claim path — a plain browser opens the link
// in the same jar and the callback cookie just works. isStandalone (shared,
// composables/usePwa) gates key minting here, so the desktop/browser flow stays
// byte-identical: no poll key, no claim row.

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
  // Reactive: flips true once the poll OBSERVES the claim armed. Note this is
  // "observed", not "was ever armed" — iOS suspends the poll timer while the
  // PWA is backgrounded in Mail, so a perfectly normal cross-jar sign-in can
  // miss the arm entirely. Anything that must know whether the claim was EVER
  // armed uses wasEverArmed() below, not this flag alone.
  const awaitingCode = ref(false);
  // Independent proof the claim was armed: the server only answers `invalid`
  // for a live, armed claim. Survives a missed poll observation, so burning the
  // attempt cap is still classified as a real expiry rather than "not armed".
  let sawInvalidResponse = false;

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
    awaitingCode.value = false;
    sawInvalidResponse = false;
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
      if (res.status === 'confirm') {
        // The link was clicked and the claim is armed. Stop polling and hand
        // off to the code input; the session is minted by submitCode, never by
        // the poll — that is what closes the session-fixation hole (ADR-0008).
        awaitingCode.value = true;
        stopPolling();
        return;
      }
    } catch (error) {
      // Transient (429 / 5xx / network): only a confirm response ends the loop;
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

  // Could this claim have been armed already? Three independent signals, any of
  // which rules out the "link not clicked yet" reading of a server `expired`:
  //  1. the poll observed the arm;
  //  2. the server once answered `invalid`, which only a live armed claim does;
  //  3. more than a confirm window has passed since the link was sent — a
  //     post-arm expiry is impossible before then (the window opens at the
  //     click, which is never earlier than the send), so past that point a
  //     missed-arm expiry is the likelier reading.
  // Signal 3 is the safety net for the normal iOS path, where the PWA is
  // suspended in the background and the poll never sees the arm at all.
  const wasEverArmed = (): boolean => {
    if (awaitingCode.value || sawInvalidResponse) return true;
    const sentAt = deadline - MAGIC_LINK_TTL_MS;
    return Date.now() - sentAt > CONFIRM_TTL_MS;
  };

  // Submit the confirmation code typed on this (the initiating) device. On a
  // match the server mints the session into THIS jar and we navigate signed-in;
  // `invalid` keeps the input for a retry. A server `expired` splits two ways:
  // when the claim provably cannot have been armed yet (see wasEverArmed), the
  // guarded UPDATE simply matched no live-armed row — nothing died, no attempt
  // was spent — so return `not-armed`, keep the key and the poll alive, and let
  // the caller nudge the user to open the link. Otherwise it is a dead claim
  // (window closed / locked / claimed): drop it and let the caller prompt for a
  // new link. Getting this split wrong in the `not-armed` direction is the
  // dangerous one — it tells the user to open a link whose token was already
  // consumed, an impossible instruction with no way forward — so the evidence
  // is read BEFORE the request (a poll tick arming mid-flight must not relabel
  // a premature submit) and every ambiguous case resolves to `expired`.
  async function submitCode(code: string): Promise<ConfirmResult> {
    const key = activeKey;
    if (!key) return 'expired';
    const armedEvidence = wasEverArmed();
    try {
      const res = await $fetch<ConfirmResponse>('/api/auth/confirm', {
        method: 'POST',
        body: { pollKey: key, code },
      });
      if (res.status === 'ready') {
        clear();
        await navigateTo('/me');
        return 'ready';
      }
      if (res.status === 'invalid') {
        sawInvalidResponse = true;
        return 'invalid';
      }
      if (!armedEvidence) return 'not-armed';
      clear();
      return 'expired';
    } catch (error) {
      console.error('[signin-poll] confirm failed', error);
      return 'error';
    }
  }

  onScopeDispose(stopPolling);

  return {
    prepareKey,
    beginPolling,
    resume,
    submitCode,
    awaitingCode,
    stopPolling,
    clear,
  };
};
