// Landing copy is baked into the prerendered HTML per locale (/, /fr, /uk) —
// a plain data module, deliberately outside the i18n runtime so the landing
// ships zero client-side translation JS (see ADR-0006).

import type { LandingLocale } from '~/shared/landing-locales';

export type { LandingLocale };

export interface LandingCopy {
  // The locale travels on the copy object (not as a separate prop) so a
  // copy/locale mismatch is unrepresentable in a page wrapper.
  locale: LandingLocale;
  seo: {
    title: string;
    description: string;
    ogTitle: string;
    ogDescription: string;
  };
  nav: {
    homeAria: string;
    why: string;
    langAria: string;
    themeAria: string;
    themeLight: string;
    themeSystem: string;
    themeDark: string;
  };
  hero: {
    eyebrow: string;
    titleTop: string;
    titleAccentPre: string;
    titleAccent: string;
    titleAccentPost: string;
    sub: string;
    emailPlaceholder: string;
    emailAria: string;
    submit: string;
    note: string;
  };
  sent: {
    title: string;
    body: string;
    again: string;
  };
  reasons: {
    overline: string;
    title: string;
    bodyPre: string;
    bodyEm: string;
    bodyPost: string;
    cards: [
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
    ];
  };
  how: {
    overline: string;
    title: string;
    steps: { title: string; body: string }[];
  };
  closer: {
    overline: string;
    titlePre: string;
    titleScript: string;
    titlePost: string;
    body: string;
    start: string;
    signIn: string;
  };
  footer: {
    tag: string;
    why: string;
  };
}

export const landingCopyEn: LandingCopy = {
  locale: 'en',
  seo: {
    title: 'Vocabu — keep the way they actually talk',
    description:
      'A personal dictionary of how the people you love talk — their words, ' +
      'in their voice, before they slip away. Never lose your sweet moments.',
    ogTitle: 'Vocabu — keep the way they actually talk',
    ogDescription:
      'Keep the words of the people you love — in their voice — before they ' +
      'quietly slip away.',
  },
  nav: {
    homeAria: 'Vocabu home',
    why: 'why vocabu',
    langAria: 'Language',
    themeAria: 'Theme',
    themeLight: 'Light theme',
    themeSystem: 'System theme',
    themeDark: 'Dark theme',
  },
  hero: {
    eyebrow: 'a dictionary of the people you love',
    titleTop: 'Keep the way',
    titleAccentPre: 'they ',
    titleAccent: 'actually',
    titleAccentPost: ' talk.',
    sub:
      "Your daughter's first mispronounced words. Your dad's worn-out " +
      "advice. A friend's ridiculous phrase. Vocabu keeps them — in their " +
      'voice — before they quietly slip away.',
    emailPlaceholder: 'you@email.com',
    emailAria: 'your email',
    submit: 'get my login link',
    note: "no password — we'll email you a link. free to start.",
  },
  sent: {
    title: 'Check your inbox',
    body: 'We sent a sign-in link to',
    again: 'Use a different email',
  },
  reasons: {
    overline: 'why vocabu',
    title: 'A keepsake, not a feed.',
    bodyPre: 'Photos catch how a moment looked. Vocabu catches how it ',
    bodyEm: 'sounded',
    bodyPost:
      ' — the exact words, the wrong pronunciations, the sayings ' +
      "you'll want back one day.",
    cards: [
      {
        title: 'In their real voice',
        body:
          'Attach a clip and hear them say it. The waveform plays right ' +
          'inside the entry — the moment stays exactly as it sounded.',
      },
      {
        title: 'Built for keeping',
        body:
          'No followers to chase, no streaks, no numbers shouting at you. ' +
          'Quiet by design — yours, and the few you choose to share with.',
      },
      {
        title: 'On this day',
        body:
          "A year later, a phrase you'd half-forgotten resurfaces — " +
          'gently, right when it lands hardest.',
      },
    ],
  },
  how: {
    overline: 'how it works',
    title: 'Two taps to keep a word.',
    steps: [
      {
        title: 'Catch it',
        body:
          "Heard something you don't want to lose? Type the word and who " +
          "said it. That's a keep.",
      },
      {
        title: 'Add their voice',
        body:
          'Upload a clip, a meaning, the little story behind it — ' +
          'whenever you have a moment.',
      },
      {
        title: 'Keep it forever',
        body:
          "It's filed in your dictionary, ready to resurface and make " +
          'you smile years from now.',
      },
    ],
  },
  closer: {
    overline: 'never lose your sweet moments',
    titlePre: 'Start before you ',
    titleScript: 'forget',
    titlePost: '.',
    body:
      'The sweetest things they say are the easiest to lose. Keep the ' +
      'first one today — it takes about thirty seconds.',
    start: 'start your dictionary',
    signIn: 'sign in',
  },
  footer: {
    tag: 'never lose your sweet moments.',
    why: 'why vocabu',
  },
};
