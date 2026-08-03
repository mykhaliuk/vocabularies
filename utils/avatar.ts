// The two pure parts of the speaker disc (components/VAvatar.vue): the
// initial it prints, and the token pair it wears. Out here because bun test
// cannot mount an SFC, and both are exactly the kind of thing that regresses
// without a mark on the page — a surrogate pair sliced in half, or every
// disc quietly falling back to ink.

export type AvatarTone = 'rose' | 'blue' | 'ink';

export type AvatarToneVars = {
  '--v-avatar-bg': string;
  '--v-avatar-fg': string;
};

// The soft pairs, NOT the --rose-200 / --blue-200 the spec mock draws: those
// steps are deliberately left at their light values in theme-dark.css, so a
// dark-theme viewer would get a bright pink disc on a near-black page — and
// ds:check would pass, because they are perfectly legal tokens. Every pair
// below is re-themed for dark.
const TONE_VARS: Readonly<Record<AvatarTone, AvatarToneVars>> = Object.freeze({
  rose: Object.freeze({
    '--v-avatar-bg': 'var(--primary-soft)',
    '--v-avatar-fg': 'var(--on-primary-soft)',
  }),
  blue: Object.freeze({
    '--v-avatar-bg': 'var(--secondary-soft)',
    '--v-avatar-fg': 'var(--on-secondary-soft)',
  }),
  ink: Object.freeze({
    '--v-avatar-bg': 'var(--surface-sunk)',
    '--v-avatar-fg': 'var(--ink-2)',
  }),
});

// No tone (a word kept before tones existed, or the user's own) reads ink —
// the quiet neutral, never a colour picked at random.
export const avatarToneVars = (tone: AvatarTone | null): AvatarToneVars =>
  TONE_VARS[tone ?? 'ink'];

export const avatarInitial = (name: string): string => {
  // Spread, not charAt: an emoji or any astral character is a surrogate pair
  // and indexing would render half of it.
  const characters = [...name.trim()];
  const first = characters[0];
  return first === undefined ? '' : first.toUpperCase();
};
