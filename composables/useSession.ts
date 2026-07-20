// Client-side session probe (VKB-70 follow-up). The session cookie is
// httpOnly, so the client cannot read it — ask the server instead. This is used
// ONLY to choose a destination (app vs sign-in screen), never to gate access or
// to authorize anything: the server remains the sole authority on every
// request.
//
// The result is deliberately THREE-valued. "Signed out" and "could not tell"
// are different answers: a 401 is the server saying no, while a timeout,
// offline radio, DNS failure or 5xx says nothing at all. Collapsing them cost a
// signed-in user their session — the caller suppressed a later retry on what it
// took to be a definite negative. Callers needing a plain yes/no use
// hasSession(), where anything short of a confirmed session is false.

const PROBE_TIMEOUT_MS = 3000;

export type ProbeResult = 'session' | 'none' | 'unknown';

// Exactly one probe may be in flight; concurrent callers share it. Cleared on
// settle, so this collapses overlapping probes without ever caching a resolved
// value — a cached value could go stale across a real session change.
let inFlight: Promise<ProbeResult> | null = null;

// Single-use hint from the standalone landing to the /login guard, set ONLY on
// a definite `none`, so /login does not re-probe an endpoint that just answered
// 401. An `unknown` must never set it: suppressing that retry is exactly what
// strands a signed-in user on the sign-in form.
let signedOutHandoff = false;

// The bound must hold on every engine. ofetch implements `timeout` with its own
// AbortController + setTimeout, so it works where AbortSignal.timeout does not
// exist (iOS <= 15) — but it applies the timeout ONLY when no `signal` is given,
// so passing a signal here would silently disable it. `retry: false` matters
// just as much: ofetch retries a GET once by default and does not classify a
// TimeoutError as an abort, so leaving retry on would make the worst case two
// full timeouts instead of one.
const runProbe = async (): Promise<ProbeResult> => {
  try {
    await $fetch('/api/me', {
      credentials: 'include',
      timeout: PROBE_TIMEOUT_MS,
      retry: false,
    });
    return 'session';
  } catch (error) {
    // ofetch reads `status` off the response; a transport failure (timeout,
    // offline, DNS) has no response at all, so it is undefined — unknown, not a
    // rejection.
    const status = (error as { status?: number })?.status;
    return status === 401 ? 'none' : 'unknown';
  }
};

export const probeSession = (): Promise<ProbeResult> => {
  if (!import.meta.client) return Promise.resolve('unknown');
  if (!inFlight) {
    inFlight = runProbe();
    void inFlight.finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

export const hasSession = async (): Promise<boolean> =>
  (await probeSession()) === 'session';

export const markSignedOutHandoff = (): void => {
  signedOutHandoff = true;
};

export const takeSignedOutHandoff = (): boolean => {
  const handed = signedOutHandoff;
  signedOutHandoff = false;
  return handed;
};
