// Magic-link + poll/claim constants shared by the server (token and claim TTL,
// pollKey validation) and the client (poll deadline, pollKey generation). One
// source so the client's polling window can never drift from the server's
// claim TTL, and both ends validate the pollKey against the same shape.

export const MAGIC_LINK_TTL_MINUTES = 15;
export const MAGIC_LINK_TTL_MS = 1000 * 60 * MAGIC_LINK_TTL_MINUTES;

// A poll key is 32 random bytes as base64url without padding = exactly 43
// chars. The range accepts 43-64 so the bound is not brittle; the charset is
// the base64url alphabet only, so padded ('=') or standard-base64 keys are
// intentionally rejected.
export const POLL_KEY_PATTERN = /^[A-Za-z0-9_-]{43,64}$/;

// Device-flow confirmation (VKB-70). To close the session-fixation hole — an
// attacker-chosen poll key armed by an unrelated victim's click — the click
// page reveals a short confirmation code that must be typed on the initiating
// device before the session is minted. 4 digits + a 3-attempt cap + a 5-min
// window bound brute force to at most 3/10000 within the window.
export const CONFIRM_CODE_LENGTH = 4;
export const CONFIRM_CODE_PATTERN = /^\d{4}$/;
export const CONFIRM_MAX_ATTEMPTS = 3;
export const CONFIRM_TTL_MINUTES = 5;
export const CONFIRM_TTL_MS = 1000 * 60 * CONFIRM_TTL_MINUTES;
