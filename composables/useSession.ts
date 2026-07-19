// Client-side session probe (VKB-70 follow-up). The session cookie is
// httpOnly, so the client cannot read it — ask the server instead. This is used
// ONLY to choose a destination (app vs sign-in screen), never to gate rendering
// or to authorize anything: the server is still the sole authority on every
// request. Any failure — 401, offline, server error, timeout — resolves to
// "no session", so a dead probe degrades to the sign-in screen instead of
// stranding the launch on a spinner.

const PROBE_TIMEOUT_MS = 3000;

// AbortSignal.timeout is iOS 16+. Where it is missing, probe untimed rather
// than throwing — a thrown TypeError would be caught below and misreport a
// signed-in launch as signed-out.
const probeSignal = (): AbortSignal | undefined => {
  const supported =
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function';
  return supported ? AbortSignal.timeout(PROBE_TIMEOUT_MS) : undefined;
};

export const hasSession = async (): Promise<boolean> => {
  if (!import.meta.client) return false;
  try {
    await $fetch('/api/me', {
      credentials: 'include',
      signal: probeSignal(),
    });
    return true;
  } catch {
    return false;
  }
};
