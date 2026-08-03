import { speakerAgeAt } from '~/shared/speaker-age';
import type { EntrySpeakerView } from '~/server/utils/entry-view';

// One place where a speaker becomes the strings an entry surface renders:
// the bold lead ("Mira", or "You" when the word is the user's own) and the
// faint " · relation · age" tail. The feed card and the word detail screen
// must read identically — the detail is the card opened up, not a second
// opinion about who said it.
//
// The age itself is never computed here: shared/speaker-age.ts owns the
// rule (birthday measured against saidAt, never against today) and returns
// data, so all this adds is the locale copy around it.
export const useSpeakerLine = () => {
  const { t } = useI18n();

  const formatAgeLabel = (
    speaker: EntrySpeakerView | null,
    saidAt: string,
  ): string | null => {
    if (!speaker) return null;
    const age = speakerAgeAt(speaker.birthday, saidAt);
    if (!age) return null;
    if (age.kind === 'newborn') return t('app.feed.age.newborn');
    if (age.kind === 'months') return t('app.feed.age.months', { n: age.n });
    return t('app.feed.age.years', { n: age.n });
  };

  const formatSpeakerLead = (speaker: EntrySpeakerView | null): string =>
    speaker?.name ?? t('app.feed.you');

  // Null when there is nothing to append — an unattributed word, or a
  // speaker with neither relation nor birthday. Attribution never blocks a
  // word, so it never pads one out either.
  const formatSpeakerTail = (
    speaker: EntrySpeakerView | null,
    saidAt: string,
  ): string | null => {
    if (!speaker) return null;
    // Relation before age — the spec's own metaline, "Theo · my son · 3"
    // (word-detail-spec.html §Thin entries).
    const parts = [speaker.rel, formatAgeLabel(speaker, saidAt)].filter(
      Boolean,
    );
    return parts.length > 0 ? ' · ' + parts.join(' · ') : null;
  };

  return { formatAgeLabel, formatSpeakerLead, formatSpeakerTail };
};
