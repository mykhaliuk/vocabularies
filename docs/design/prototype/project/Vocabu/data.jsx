/* global window */
// Vocabu — seed content from the brief.
// A personal dictionary of how the people you love talk. Warm + specific.

// Fine, spaced waveform shapes (bar heights 0–1).
const WAVE_A = [.22,.4,.3,.55,.42,.7,.5,.85,.62,1,.7,.5,.78,.4,.6,.34,.72,.5,.9,.46,.6,.32,.52,.4,.74,.5,.3,.62,.44,.8,.5,.28];
const WAVE_B = [.3,.5,.7,.45,.9,.6,1,.55,.4,.7,.5,.85,.6,.35,.7,.48,.62,.9,.5,.7,.4,.6,.33,.55,.46,.78,.5,.3,.66,.42,.58,.36];

window.VOCABU_USER = { name: "Sam", handle: "you" };

// note: `band:true` renders woven into the feed as the "on this day" strip.
window.VOCABU_ENTRIES = [
  {
    id: "w1", speaker: "Mira", tone: "rose", rel: "my daughter · 22 mo",
    word: "nana-lella", gloss: "watermelon",
    desc: "Points at every round fruit and says it twice, fast. Apples, oranges, a beach ball once. The whole world is nana-lella until proven otherwise.",
    audio: { dur: "0:04", wave: WAVE_A }, collection: "Mira's words",
    likes: 14, liked: true, replies: 2, saved: false,
  },
  {
    id: "otd", band: true, speaker: "Dad", tone: "blue", rel: "my dad",
    word: "don't trust a quiet dog.", gloss: null,
    desc: "His rule for hiring — the people who don't talk in meetings are the ones watching everything. He was right about my last boss.",
    audio: null, collection: "Dad's wisdom",
    otdLine: "you saved your dad's saying.",
    likes: 31, liked: false, replies: 4, saved: true,
  },
  {
    id: "w2", speaker: "Theo", tone: "ink", rel: "best friend",
    word: "emotionally damp", gloss: null,
    desc: "Not depressed — just a bit moist about the feelings. Describes him most Sundays, and the entire month of January.",
    audio: null, collection: "Theo-isms",
    likes: 22, liked: true, replies: 6, saved: false,
  },
  {
    id: "w3", speaker: "Mira", tone: "rose", rel: "my daughter · 22 mo",
    word: "pasketti", gloss: "spaghetti",
    desc: "Requested every single dinner, sauce to the elbows. We have stopped offering alternatives.",
    audio: { dur: "0:03", wave: WAVE_B }, collection: "Mira's words",
    likes: 9, liked: false, replies: 1, saved: false,
  },
  {
    id: "w4", speaker: "Dad", tone: "blue", rel: "my dad",
    word: "measure twice, cut once.", gloss: null,
    desc: "Every single time — taxes, paint, the time I almost quit. I hear it in his voice now before I do anything I'd regret.",
    audio: { dur: "0:05", wave: WAVE_A }, collection: "Dad's wisdom",
    likes: 38, liked: true, replies: 5, saved: true,
  },
  {
    id: "w5", speaker: "Grandma", tone: "rose", rel: "“nonna”",
    word: "go with God, but keep your hand on your purse.", gloss: null,
    desc: "Her entire theology in one sentence. Faith, sure — but she's not paying for anyone's parking.",
    audio: { dur: "0:06", wave: WAVE_B }, collection: "Nonna's sayings",
    likes: 27, liked: true, replies: 3, saved: false,
  },
];

window.VOCABU_COLLECTIONS = [
  { name: "Mira's words", count: 12, tone: "rose", voices: "Mira" },
  { name: "Dad's wisdom", count: 9, tone: "blue", voices: "Dad" },
  { name: "Theo-isms", count: 17, tone: "ink", voices: "Theo" },
  { name: "Nonna's sayings", count: 23, tone: "rose", voices: "Grandma" },
];

// Replies keyed by entry id.
window.VOCABU_REPLIES = {
  w1: [
    { id: "r1", name: "Theo", tone: "ink", time: "2h", text: "mine calls every animal a “doggie”, including pigeons. solidarity." },
    { id: "r2", name: "Grandma", tone: "rose", time: "1h", text: "write them all down. you forget the sweetest ones, I promise you." },
  ],
  otd: [
    { id: "r3", name: "Theo", tone: "ink", time: "1y", text: "your dad should write a book. or at least a fortune cookie line." },
  ],
};

// Discover: dictionaries you could follow.
window.VOCABU_FOLLOW = [
  { name: "Lena", tone: "rose", bio: "her gran's Sicilian proverbs — mostly gentle threats", sub: "Nonna's sayings · 1 voice" },
  { name: "Marcus", tone: "blue", bio: "twins learning to talk, zero consensus between them", sub: "first words · 2 voices" },
  { name: "Priya", tone: "ink", bio: "things her toddler insists are true", sub: "toddler logic · 1 voice" },
];

window.VOCABU_THEMES = ["first words", "family wisdom", "funny mix-ups", "inside jokes", "old sayings", "love notes"];
