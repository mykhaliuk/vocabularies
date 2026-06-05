/* global React */
// Vocabu UI kit — sample data.
// A personal dictionary of how the people you love talk: a kid's first words,
// a friend's catchphrase, a grandparent's saying. Each entry = a word/phrase,
// an optional short meaning (gloss), a story, and an optional audio sample.

window.VOCABU_USER = { name: "Sam", handle: "you", tone: "rose" };

// A static waveform shape (bar heights 0–1) reused for audio samples
const WAVE = [.3,.6,.45,.8,.55,.9,.7,1,.65,.5,.75,.4,.85,.6,.3,.7,.5,.9,.45,.6,.35,.55,.4,.8,.5];

window.VOCABU_ENTRIES = [
  {
    id: "w1", speaker: "Mira", tone: "rose", rel: "my daughter · 22 mo", time: "2d",
    word: "Appo", gloss: "apple",
    desc: "Points at the fruit bowl every morning and says it twice, fast — appo-appo. The 'l' disappears completely.",
    audio: { dur: "0:03", wave: WAVE }, collection: "Mira's words",
    likes: 14, liked: true, replies: 3, saved: false,
  },
  {
    id: "w2", speaker: "Dad", tone: "blue", rel: "my dad", time: "5h",
    word: "Measure twice, cut once.", gloss: null,
    desc: "He says it for everything now — taxes, breakups, picking paint. I've started hearing it in his voice before I do anything dumb.",
    audio: { dur: "0:04", wave: WAVE }, collection: "Dad's wisdom",
    likes: 38, liked: false, replies: 6, saved: true,
  },
  {
    id: "w3", speaker: "Theo", tone: "amber", rel: "best friend", time: "1d",
    word: "It's giving… Tuesday.", gloss: null,
    desc: "His verdict on anything underwhelming. A flat coffee, a bad date, a mediocre film. Devastating every time.",
    audio: null, collection: "Theo-isms",
    likes: 21, liked: true, replies: 9, saved: false,
  },
  {
    id: "w4", speaker: "Nonna", tone: "sage", rel: "my grandmother", time: "3d",
    word: "Mangia!", gloss: "eat — you're far too thin",
    desc: "Deployed within thirty seconds of you entering her house, regardless of when you last ate. There is no correct response.",
    audio: { dur: "0:02", wave: WAVE }, collection: "Family",
    likes: 31, liked: true, replies: 8, saved: true,
  },
  {
    id: "w5", speaker: "Sol", tone: "blue", rel: "Priya's son · 20 mo", time: "4d",
    word: "Tato", gloss: "potato / tomato",
    desc: "Refuses to distinguish between the two. Honestly, fair.",
    audio: null, collection: "Funny mix-ups",
    likes: 6, liked: false, replies: 0, saved: false,
  },
];

window.VOCABU_COLLECTIONS = [
  { name: "Mira's words", count: 12, tone: "rose" },
  { name: "Dad's wisdom", count: 9, tone: "blue" },
  { name: "Theo-isms", count: 17, tone: "amber" },
  { name: "Family", count: 23, tone: "sage" },
];
