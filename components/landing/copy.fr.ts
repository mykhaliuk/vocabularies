import type { LandingCopy } from './copy.en';

export const landingCopyFr: LandingCopy = {
  locale: 'fr',
  seo: {
    title: 'Vocabu — gardez leur vraie façon de parler',
    description:
      'Un dictionnaire personnel des mots de ceux que vous aimez — leurs ' +
      "mots, avec leur voix, avant qu'ils ne s'effacent. Ne perdez jamais " +
      'vos instants les plus doux.',
    ogTitle: 'Vocabu — gardez leur vraie façon de parler',
    ogDescription:
      'Gardez les mots de ceux que vous aimez — avec leur voix — avant ' +
      "qu'ils ne s'effacent doucement.",
  },
  nav: {
    homeAria: 'Accueil Vocabu',
    why: 'pourquoi vocabu',
    langAria: 'Langue',
    themeAria: 'Thème',
    themeLight: 'Thème clair',
    themeSystem: 'Thème système',
    themeDark: 'Thème sombre',
  },
  hero: {
    eyebrow: 'un dictionnaire des gens que vous aimez',
    titleTop: 'Gardez leur',
    titleAccentPre: '',
    titleAccent: 'vraie',
    titleAccentPost: ' façon de parler.',
    sub:
      'Les premiers mots écorchés de votre fille. Les conseils cent fois ' +
      "répétés de votre père. La phrase absurde d'un ami. Vocabu les " +
      "garde — avec leur voix — avant qu'ils ne s'effacent doucement.",
    emailPlaceholder: 'vous@email.com',
    emailAria: 'votre e-mail',
    submit: 'recevoir mon lien de connexion',
    note:
      'pas de mot de passe — on vous envoie un lien par e-mail. ' +
      'gratuit pour commencer.',
  },
  sent: {
    title: 'Vérifiez votre boîte mail',
    body: 'Nous avons envoyé un lien de connexion à',
    again: 'Utiliser une autre adresse',
  },
  reasons: {
    overline: 'pourquoi vocabu',
    title: "Un souvenir, pas un fil d'actualité.",
    bodyPre: "Les photos gardent l'image d'un moment. Vocabu en garde le ",
    bodyEm: 'son',
    bodyPost:
      ' — les mots exacts, les prononciations de travers, les ' +
      'expressions que vous voudrez retrouver un jour.',
    cards: [
      {
        title: 'Avec leur vraie voix',
        body:
          'Ajoutez un extrait et écoutez-les le dire. Le son se joue ' +
          "directement dans l'entrée — le moment reste exactement tel " +
          "qu'il a sonné.",
      },
      {
        title: 'Fait pour garder',
        body:
          "Pas d'abonnés à courtiser, pas de séries, pas de chiffres qui " +
          'vous crient dessus. Silencieux par choix — à vous, et aux ' +
          'quelques proches que vous choisissez.',
      },
      {
        title: 'Ce jour-là',
        body:
          'Un an plus tard, une phrase à moitié oubliée refait surface — ' +
          'doucement, juste au moment où elle touche le plus.',
      },
    ],
  },
  how: {
    overline: 'comment ça marche',
    title: 'Deux gestes pour garder un mot.',
    steps: [
      {
        title: 'Attrapez-le',
        body:
          'Vous avez entendu quelque chose à ne pas perdre ? Écrivez le ' +
          "mot et qui l'a dit. C'est gardé.",
      },
      {
        title: 'Ajoutez leur voix',
        body:
          'Un extrait audio, un sens, la petite histoire derrière — ' +
          'quand vous avez un moment.',
      },
      {
        title: 'Gardez-le pour toujours',
        body:
          'Il rejoint votre dictionnaire, prêt à refaire surface et à ' +
          'vous faire sourire dans des années.',
      },
    ],
  },
  closer: {
    overline: 'ne perdez jamais vos instants les plus doux',
    titlePre: "Commencez avant d'",
    titleScript: 'oublier',
    titlePost: '.',
    body:
      "Les plus jolies choses qu'ils disent sont les plus faciles à " +
      "perdre. Gardez la première aujourd'hui — une trentaine de secondes " +
      'suffit.',
    start: 'créer mon dictionnaire',
    signIn: 'se connecter',
  },
  footer: {
    tag: 'ne perdez jamais vos instants les plus doux.',
    why: 'pourquoi vocabu',
  },
  phone: {
    chipVoice: 'leur vraie voix',
    chipKept: 'gardé pour toujours',
    entry: {
      name: 'Léa',
      meta: '· ma fille · 22 mois',
      word: 'pestacle',
      gloss: 'spectacle',
    },
    onThisDay: {
      overline: 'ce jour-là · il y a un an',
      quote: "méfie-toi d'un chien calme.",
    },
    peek: {
      name: 'Théo',
      meta: '· meilleur ami',
      word: 'moralement froissé',
    },
  },
};
