// The headword shrinks as the phrase grows, so a long saying never overflows
// the centred column it sits in. The ladder is the prototype's (feed.jsx
// WordText, pinned again by word-detail-spec.html §Anatomy step 2):
// 40 / 33 / 27 / 22 / 19px at <= 13, <= 20, <= 30, <= 44 and longer.
//
// Those steps are PRE-scale. Vocabu renders headwords in Caveat, whose
// x-height is far smaller than the sans it sits next to, so every step is
// scaled up before it reaches the page. HAND_SCALE mirrors the prototype's
// --word-scale (app.jsx) by hand; no check binds them.
//
// Shared because the feed card and the word detail screen must shrink in
// lockstep: two copies of a ladder drift on the first tweak.

const HAND_SCALE = 1.39;

const STEPS = [
  { maxLength: 13, sizePx: 40 },
  { maxLength: 20, sizePx: 33 },
  { maxLength: 30, sizePx: 27 },
  { maxLength: 44, sizePx: 22 },
] as const;

const LONGEST_SIZE_PX = 19;

export const headwordSizePx = (word: string): number => {
  const { length } = word;
  for (const step of STEPS) {
    if (length <= step.maxLength) return Math.round(step.sizePx * HAND_SCALE);
  }
  return Math.round(LONGEST_SIZE_PX * HAND_SCALE);
};
