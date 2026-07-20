// Client-side session probe (VKB-70 follow-up). The session cookie is
// httpOnly, so the client cannot read it — ask the server instead. This is used
// ONLY to choose a destination (app vs sign-in screen), never to gate access or
// to authorize anything: the server remains the sole authority on every
// request. Any failure — 401, offline, server error, timeout — resolves to
// "no session", so a dead probe degrades to the sign-in screen instead of
// stranding the launch on a spinner.

const PROBE_TIMEOUT_MS = 3000;

// Exactly one probe may be in flight; concurrent callers share it. Cleared on
// settle, so this collapses overlapping probes without ever caching a resolved
// value — a cached value could go stale across a real session change.
let inFlight: Promise<boolean> | null = null;

// Single-use hint from the standalone landing to the /login guard: the landing
// just probed and found no session, so /login must not probe the same endpoint
// again moments later — on a black-holed connection that would make one cold
// launch pay the timeout twice. Negative only: it can skip a redundant
// "signed out" re-check, never assert a session, so the worst case if it ever
// leaked is one missed redirect to /me, never granted access.
let signedOutHandoff = false;

// The bound must hold on every engine. ofetch implements `timeout` with its own
// AbortController + setTimeout, so it works where AbortSignal.timeout does not
// exist (iOS <= 15) — but it applies the timeout ONLY when no `signal` is given,
// so passing a signal here would silently disable it. `retry: false` matters
// just as much: ofetch retries a GET once by default and does not classify a
// TimeoutError as an abort, so leaving retry on would make the worst case two
// full timeouts instead of one.
const probe = async (): Promise<boolean> => {
  try {
    await $fetch('/api/me', {
      credentials: 'include',
      timeout: PROBE_TIMEOUT_MS,
      retry: false,
    });
    return true;
  } catch {
    return false;
  }
};

export const hasSession = (): Promise<boolean> => {
  if (!import.meta.client) return Promise.resolve(false);
  if (!inFlight) {
    inFlight = probe();
    void inFlight.finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

export const markSignedOutHandoff = (): void => {
  signedOutHandoff = true;
};

export const takeSignedOutHandoff = (): boolean => {
  const handed = signedOutHandoff;
  signedOutHandoff = false;
  return handed;
};
