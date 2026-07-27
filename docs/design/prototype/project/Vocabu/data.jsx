/* global window */
// Vocabu — seed content from the brief.
// A personal dictionary of how the people you love talk. Warm + specific.

// Fine, spaced waveform shapes (bar heights 0–1).
const WAVE_A = [.22,.4,.3,.55,.42,.7,.5,.85,.62,1,.7,.5,.78,.4,.6,.34,.72,.5,.9,.46,.6,.32,.52,.4,.74,.5,.3,.62,.44,.8,.5,.28];
const WAVE_B = [.3,.5,.7,.45,.9,.6,1,.55,.4,.7,.5,.85,.6,.35,.7,.48,.62,.9,.5,.7,.4,.6,.33,.55,.46,.78,.5,.3,.66,.42,.58,.36];

window.VOCABU_USER = { name: "Sam", handle: "you" };

// Speakers are first-class: an entry points at one by `sid`.
// Name is required; relation and birthday are optional. Age is derived, never stored.
window.VOCABU_SPEAKERS = [
  { id: "mira", name: "Mira", rel: "my daughter", birthday: "2024-09-14", tone: "rose", words: 12 },
  { id: "dad", name: "Dad", rel: "my dad", birthday: null, tone: "blue", words: 9 },
  { id: "theo", name: "Theo", rel: "best friend", birthday: null, tone: "ink", words: 17 },
  { id: "nonna", name: "Grandma", rel: "“nonna”", birthday: null, tone: "rose", words: 23 },
];

// the day the words were said. Always present: set to created_at when the entry is made,
// and correctable on the word screen. Never inferred from clip metadata — a confidently
// wrong date is worse than a slightly late one.
window.vocabuSpokenAt = function (m) {
  return (m && m.saidAt) || null;
};
window.vocabuDate = function (iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.getDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()] + " " + d.getFullYear();
};
// months while they're tiny, years after two — the way people actually say it.
// `at` is the day we're measuring on: for an entry that's the day it was said, so the
// age freezes with the word. Omit it for someone's age today.
window.vocabuAge = function (birthday, at) {
  if (!birthday) return null;
  const b = new Date(birthday + "T00:00:00");
  const n = at ? new Date(at + "T00:00:00") : new Date();
  if (isNaN(b.getTime()) || isNaN(n.getTime()) || b > n) return null;
  let mo = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) mo -= 1;
  if (mo < 0) return null;
  if (mo < 1) return "newborn";
  return mo < 24 ? mo + " mo" : Math.floor(mo / 12) + " y";
};
window.vocabuSpeaker = function (m) {
  return (m && m.sid && (window.VOCABU_SPEAKERS || []).find((s) => s.id === m.sid)) || null;
};
// the "my daughter · 22 mo" line. Relation resolves live; the age is the age they were
// on the day the word was said — that's the memory.
window.vocabuRel = function (m) {
  const sp = window.vocabuSpeaker(m);
  if (!sp) return (m && m.rel) || null;
  return [sp.rel, window.vocabuAge(sp.birthday, window.vocabuSpokenAt(m))].filter(Boolean).join(" · ") || null;
};

// note: `band:true` renders woven into the feed as the "on this day" strip.
window.VOCABU_ENTRIES = [
  {
    id: "w1", sid: "mira", speaker: "Mira", tone: "rose", saidAt: "2026-07-20",
    word: "nana-lella", gloss: "watermelon",
    desc: "Points at every round fruit and says it twice, fast. Apples, oranges, a beach ball once. The whole world is nana-lella until proven otherwise.",
    audio: { dur: "0:04", wave: WAVE_A }, collection: "Mira's words",
    likes: 14, liked: true, replies: 2, saved: false,
  },
  {
    id: "otd", band: true, sid: "dad", speaker: "Dad", tone: "blue", saidAt: "2025-07-26",
    word: "don't trust a quiet dog.", gloss: null,
    desc: "His rule for hiring — the people who don't talk in meetings are the ones watching everything. He was right about my last boss.",
    audio: null, collection: "Dad's wisdom",
    otdLine: "you saved your dad's saying.",
    likes: 31, liked: false, replies: 4, saved: true,
  },
  {
    id: "w6", sid: "mira", speaker: "Mira", tone: "rose", saidAt: "2026-05-10",
    word: "bapple", gloss: "apple, probably",
    desc: "Holds it up like evidence before every bite. The video is eleven seconds of her explaining it to the cat.",
    audio: null, video: { dur: "0:11", orientation: "portrait" }, collection: "Mira's words",
    likes: 17, liked: false, replies: 3, saved: false,
  },
  {
    id: "w2", sid: "theo", speaker: "Theo", tone: "ink", saidAt: "2026-06-18",
    word: "emotionally damp", gloss: null,
    desc: "Not depressed — just a bit moist about the feelings. Describes him most Sundays, and the entire month of January.",
    audio: null, collection: "Theo-isms",
    likes: 22, liked: true, replies: 6, saved: false,
  },
  {
    id: "w3", sid: "mira", speaker: "Mira", tone: "rose", saidAt: "2025-09-20",
    word: "pasketti", gloss: "spaghetti",
    desc: "Requested every single dinner, sauce to the elbows. We have stopped offering alternatives.",
    // filed six weeks after she said it — corrected by hand on the word screen.
    audio: { dur: "0:03", wave: WAVE_B }, collection: "Mira's words",
    likes: 9, liked: false, replies: 1, saved: false,
  },
  {
    id: "w4", sid: "dad", speaker: "Dad", tone: "blue", saidAt: "2026-04-03",
    word: "measure twice, cut once.", gloss: null,
    desc: "Every single time — taxes, paint, the time I almost quit. I hear it in his voice now before I do anything I'd regret.",
    audio: { dur: "0:05", wave: WAVE_A }, collection: "Dad's wisdom",
    likes: 38, liked: true, replies: 5, saved: true,
  },
  {
    id: "w5", sid: "nonna", speaker: "Grandma", tone: "rose", saidAt: "2026-02-11",
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
