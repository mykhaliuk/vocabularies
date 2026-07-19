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
