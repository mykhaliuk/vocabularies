// The age rule (VKB-97, speaker-spec.html): the age shown on a word is the
// age the speaker was on the day it was said — measured birthday → saidAt,
// never against today. Returns data, not copy: "newborn" / "7 mo" / "3 y"
// are locale strings the caller renders through i18n.
//
// Shared because both the feed (frozen age against an entry's saidAt) and
// the people surfaces (age today) derive from the same rule, and the unit
// tests pin the spec's own worked example against it.

export type SpeakerAge =
  | { kind: 'newborn' }
  | { kind: 'months'; n: number }
  | { kind: 'years'; n: number };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar day, not merely a parseable string: V8 normalises a day
// overflow in ISO strings ('2026-02-30' parses as March 2nd) instead of
// rejecting it, so the parse must round-trip back to the same YYYY-MM-DD.
export const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
};

// Both arguments are plain YYYY-MM-DD strings (Postgres `date` columns come
// through the API as exactly that). Calendar months, rounded down; a
// birthday after the anchor derives nothing, silently — data can be messy.
export const speakerAgeAt = (
  birthday: string | null,
  saidAt: string,
): SpeakerAge | null => {
  if (!birthday) return null;
  if (!isValidIsoDate(birthday) || !isValidIsoDate(saidAt)) return null;
  const born = new Date(birthday + 'T00:00:00Z');
  const anchor = new Date(saidAt + 'T00:00:00Z');
  if (born > anchor) return null;

  let months =
    (anchor.getUTCFullYear() - born.getUTCFullYear()) * 12 +
    (anchor.getUTCMonth() - born.getUTCMonth());
  if (anchor.getUTCDate() < born.getUTCDate()) months -= 1;

  if (months < 0) return null;
  if (months < 1) return { kind: 'newborn' };
  if (months < 24) return { kind: 'months', n: months };
  return { kind: 'years', n: Math.floor(months / 12) };
};
