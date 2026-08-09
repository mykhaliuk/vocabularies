/* @ds-bundle: {"format":4,"namespace":"VocabuDesignSystem_fc456a","components":[{"name":"WordCard","sourcePath":"components/WordCard.jsx"}],"sourceHashes":{"components/WordCard.jsx":"b082688104cf","ui_kits/app/app.jsx":"94450d4447d0","ui_kits/app/chrome.jsx":"a3ac2fa42788","ui_kits/app/compose.jsx":"6a2ff5723934","ui_kits/app/data.jsx":"fd520cffd876","ui_kits/app/detail.jsx":"127d5d825040","ui_kits/app/primitives.jsx":"c92a8f48c6ac","ui_kits/app/screens.jsx":"48daa4dd1295","ui_kits/app/word-card.jsx":"d8c57ed2e1f7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.VocabuDesignSystem_fc456a = window.VocabuDesignSystem_fc456a || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/WordCard.jsx
try { (() => {
// Vocabu — WordCard: the core feed unit, a dictionary entry for a captured word.
// Self-contained: inline icons + avatar, tokens from colors_and_type.css.
const _wcPaths = {
  heart: /*#__PURE__*/React.createElement("path", {
    d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
  }),
  "message-circle": /*#__PURE__*/React.createElement("path", {
    d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
  }),
  bookmark: /*#__PURE__*/React.createElement("path", {
    d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
  }),
  "bookmark-check": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 10 2 2 4-4"
  })),
  "chevron-down": /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }),
  "more-horizontal": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "12",
    r: "1"
  })),
  play: /*#__PURE__*/React.createElement("path", {
    d: "m6 3 14 9-14 9V3z"
  }),
  pause: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "4",
    width: "4",
    height: "16",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "4",
    width: "4",
    height: "16",
    rx: "1"
  }))
};
function WcIcon({
  name,
  size = 18,
  fill = "none",
  stroke = 2,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: fill,
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    "aria-hidden": "true"
  }, _wcPaths[name]);
}
function WcAvatar({
  name,
  tone = "rose",
  size = 38
}) {
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "var(--r-pill)",
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: `var(--${tone}-200)`,
      color: `var(--${tone}-700)`,
      fontFamily: "var(--font-sans)",
      fontSize: size * 0.37,
      fontWeight: 700
    }
  }, initials);
}
function WcAudio({
  audio
}) {
  const [playing, setPlaying] = React.useState(false);
  const tRef = React.useRef();
  const secs = (() => {
    const [m, s] = audio.dur.split(":").map(Number);
    return m * 60 + s;
  })();
  const toggle = e => {
    e.stopPropagation();
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setPlaying(false), secs * 1000);
  };
  const bars = color => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      height: "100%",
      width: "100%"
    }
  }, audio.wave.map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      height: `${20 + h * 80}%`,
      background: color,
      borderRadius: 2,
      minWidth: 1.5
    }
  })));
  return /*#__PURE__*/React.createElement("div", {
    onClick: toggle,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": playing ? "Pause" : "Play",
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      flex: "0 0 auto",
      border: "1.5px solid var(--blue-300)",
      background: playing ? "var(--blue-50)" : "transparent",
      color: "var(--blue-600)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(WcIcon, {
    name: playing ? "pause" : "play",
    size: 13,
    fill: "currentColor",
    stroke: 0
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      height: 20,
      overflow: "hidden"
    }
  }, bars("var(--blue-200)"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      width: playing ? "100%" : "0%",
      transition: playing ? `width ${secs}s linear` : "width 200ms var(--ease-out)"
    }
  }, bars("var(--blue-500)"))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 500,
      color: "var(--ink-3)",
      fontVariantNumeric: "tabular-nums",
      flex: "0 0 auto"
    }
  }, audio.dur));
}
function WcAction({
  icon,
  count,
  active,
  fill,
  onClick,
  color
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: active ? color || "var(--like)" : "var(--ink-2)",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(WcIcon, {
    name: icon,
    size: 18,
    fill: active && fill ? "currentColor" : "none"
  }), count > 0 && /*#__PURE__*/React.createElement("span", null, count));
}
function WordCard({
  m,
  onOpen,
  compact,
  expanded: forceExpanded
}) {
  const [liked, setLiked] = React.useState(!!m.liked);
  const [likes, setLikes] = React.useState(m.likes || 0);
  const [saved, setSaved] = React.useState(!!m.saved);
  const [pop, setPop] = React.useState(false);
  const [open, setOpen] = React.useState(!!forceExpanded);
  const toggleLike = e => {
    e.stopPropagation();
    setLiked(v => {
      const nv = !v;
      setLikes(c => c + (nv ? 1 : -1));
      if (nv) {
        setPop(true);
        setTimeout(() => setPop(false), 260);
      }
      return nv;
    });
  };
  return /*#__PURE__*/React.createElement("article", {
    onClick: () => onOpen && onOpen(m),
    style: {
      background: "var(--surface)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r-card)",
      padding: "14px 16px",
      boxShadow: "var(--shadow-sm)",
      cursor: onOpen ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(WcAvatar, {
    name: m.speaker,
    tone: m.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.25,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, m.speaker), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      color: "var(--ink-2)"
    }
  }, m.rel, " \xB7 ", m.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto",
      color: "var(--ink-2)",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(WcIcon, {
    name: "more-horizontal",
    size: 20
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-hand)",
      fontSize: m.word.length > 26 ? 28 : m.word.length > 13 ? 33 : 40,
      fontWeight: 700,
      letterSpacing: "0",
      color: "var(--ink)",
      lineHeight: 1.05
    }
  }, m.word), m.gloss && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 400,
      color: "var(--ink-2)"
    }
  }, m.gloss)), m.audio && !compact && /*#__PURE__*/React.createElement(WcAudio, {
    audio: m.audio
  }), !compact && m.desc && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      setOpen(v => !v);
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      fontWeight: 600,
      color: "var(--blue-600)"
    }
  }, /*#__PURE__*/React.createElement(WcIcon, {
    name: "chevron-down",
    size: 15,
    style: {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform var(--dur-base) var(--ease-out)"
    }
  }), open ? "Hide meaning" : "Meaning & story"), open && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      lineHeight: 1.55,
      color: "var(--ink)",
      margin: "8px 0 0"
    }
  }, m.desc)), m.collection && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--ink-2)",
      background: "var(--surface-sunk)",
      padding: "4px 9px",
      borderRadius: "var(--r-sm)"
    }
  }, /*#__PURE__*/React.createElement(WcIcon, {
    name: "bookmark",
    size: 12
  }), " ", m.collection)), /*#__PURE__*/React.createElement("footer", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 26,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      transform: pop ? "scale(1.25)" : "scale(1)",
      transition: "transform var(--dur-base) var(--ease-out)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(WcAction, {
    icon: "heart",
    count: likes,
    active: liked,
    fill: true,
    onClick: toggleLike
  })), /*#__PURE__*/React.createElement(WcAction, {
    icon: "message-circle",
    count: m.replies || 0,
    onClick: e => {
      e.stopPropagation();
      onOpen && onOpen(m);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(WcAction, {
    icon: saved ? "bookmark-check" : "bookmark",
    active: saved,
    color: "var(--blue-600)",
    onClick: e => {
      e.stopPropagation();
      setSaved(v => !v);
    }
  }))));
}
Object.assign(__ds_scope, { WordCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/WordCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/app.jsx
try { (() => {
/* global React, ReactDOM, FeedScreen, DiscoverScreen, SavedScreen, ProfileScreen, DetailScreen, Compose, BottomNav */
// Vocabu UI kit — app shell

function App() {
  const [tab, setTab] = React.useState("feed");
  const [detail, setDetail] = React.useState(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [entries, setEntries] = React.useState(window.VOCABU_ENTRIES);
  const open = m => setDetail(m);
  const post = ({
    word,
    speaker,
    gloss,
    story,
    collection,
    audio
  }) => {
    const m = {
      id: "n" + Date.now(),
      speaker: speaker || "You",
      tone: "rose",
      rel: "just now",
      time: "now",
      word,
      gloss,
      desc: story,
      audio: audio ? {
        dur: "0:03",
        wave: [.3, .6, .5, .8, .6, .9, .7, 1, .6, .5, .7, .4, .8, .6, .3, .7, .5, .9, .5, .6]
      } : null,
      collection,
      likes: 0,
      liked: false,
      replies: 0,
      saved: false
    };
    setEntries(arr => [m, ...arr]);
    setComposeOpen(false);
    setTab("feed");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      background: "var(--paper)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, tab === "feed" && /*#__PURE__*/React.createElement(FeedScreen, {
    entries: entries,
    onOpen: open
  }), tab === "discover" && /*#__PURE__*/React.createElement(DiscoverScreen, null), tab === "saved" && /*#__PURE__*/React.createElement(SavedScreen, {
    collections: window.VOCABU_COLLECTIONS,
    entries: entries,
    onOpen: open
  }), tab === "profile" && /*#__PURE__*/React.createElement(ProfileScreen, {
    entries: entries,
    onOpen: open
  })), /*#__PURE__*/React.createElement(BottomNav, {
    active: tab,
    onNav: setTab,
    onCompose: () => setComposeOpen(true)
  }), detail && /*#__PURE__*/React.createElement(DetailScreen, {
    m: detail,
    onBack: () => setDetail(null)
  }), /*#__PURE__*/React.createElement(Compose, {
    open: composeOpen,
    onClose: () => setComposeOpen(false),
    onPost: post
  }));
}
const vocabuMount = document.getElementById("vocabu-app");
if (vocabuMount) ReactDOM.createRoot(vocabuMount).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/chrome.jsx
try { (() => {
/* global React, Icon, IconButton */
// Vocabu UI kit — app chrome (top bar + bottom tab nav)

function TopBar({
  title,
  onBack,
  action,
  serif
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      height: 52,
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      background: "var(--bar-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--hairline)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      display: "flex",
      justifyContent: "flex-start"
    }
  }, onBack && /*#__PURE__*/React.createElement(IconButton, {
    name: "arrow-left",
    onClick: onBack,
    color: "var(--ink)"
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      flex: 1,
      textAlign: "center",
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 17,
      fontWeight: 700,
      color: "var(--ink)",
      letterSpacing: "-0.01em"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      display: "flex",
      justifyContent: "flex-end"
    }
  }, action));
}
function FeedTopBar() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      position: "relative",
      background: "var(--bar-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--hairline)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.svg",
    alt: "",
    width: "24",
    height: "24",
    style: {
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 21,
      fontWeight: 600,
      letterSpacing: "-0.025em",
      color: "var(--ink)"
    }
  }, "Vocabu"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: 4,
      top: "50%",
      transform: "translateY(-50%)"
    }
  }, /*#__PURE__*/React.createElement(ThemeToggle, null)));
}
const TABS = [{
  id: "feed",
  icon: "home",
  label: "Feed"
}, {
  id: "discover",
  icon: "search",
  label: "Discover"
}, {
  id: "compose",
  icon: "feather",
  label: "",
  fab: true
}, {
  id: "saved",
  icon: "bookmark",
  label: "Saved"
}, {
  id: "profile",
  icon: "user",
  label: "You"
}];
function BottomNav({
  active,
  onNav,
  onCompose
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      padding: "6px 6px calc(6px + var(--safe-bottom))",
      height: "var(--bottom-nav-h)",
      background: "var(--bar-bg)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderTop: "1px solid var(--hairline)"
    }
  }, TABS.map(t => t.fab ? /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: onCompose,
    style: {
      width: 52,
      height: 52,
      marginTop: -8,
      borderRadius: "50%",
      border: 0,
      cursor: "pointer",
      background: "var(--rose-500)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "var(--shadow-float)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "feather",
    size: 23
  })) : /*#__PURE__*/React.createElement("button", {
    key: t.id,
    onClick: () => onNav(t.id),
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      background: "transparent",
      border: 0,
      cursor: "pointer",
      width: 56,
      height: 46,
      justifyContent: "center",
      color: active === t.id ? "var(--rose-600)" : "var(--ink-3)",
      fontFamily: "var(--font-sans)",
      fontSize: 10,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: t.icon,
    size: 23,
    fill: active === t.id && t.id !== "search" ? "none" : "none"
  }), t.label)));
}
Object.assign(window, {
  TopBar,
  FeedTopBar,
  BottomNav
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/compose.jsx
try { (() => {
/* global React, Icon, Avatar, Button, IconButton, Chip */
// Vocabu UI kit — Compose: capture a word or phrase someone said

function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-2)"
    }
  }, label), children);
}
const inputStyle = {
  border: "1.5px solid var(--hairline-2)",
  outline: 0,
  background: "var(--surface)",
  borderRadius: "var(--r-sm)",
  padding: "7px 10px",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--ink)",
  width: "100%",
  boxSizing: "border-box"
};
function Compose({
  open,
  onClose,
  onPost
}) {
  const [word, setWord] = React.useState("");
  const [speaker, setSpeaker] = React.useState("");
  const [gloss, setGloss] = React.useState("");
  const [story, setStory] = React.useState("");
  const [collection, setCollection] = React.useState(null);
  const [recorded, setRecorded] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setWord("");
      setSpeaker("");
      setGloss("");
      setStory("");
      setCollection(null);
      setRecorded(false);
      setTimeout(() => ref.current && ref.current.focus(), 240);
    }
  }, [open]);
  const collections = ["Mira's words", "Dad's wisdom", "Theo-isms", "Family"];
  const canPost = word.trim() && speaker.trim();
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": !open,
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 60,
      pointerEvents: open ? "auto" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--scrim)",
      opacity: open ? 1 : 0,
      transition: "opacity var(--dur-base) var(--ease-out)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      background: "var(--surface)",
      borderTopLeftRadius: "var(--r-xl)",
      borderTopRightRadius: "var(--r-xl)",
      boxShadow: "var(--shadow-lg)",
      padding: "10px 16px calc(16px + var(--safe-bottom))",
      transform: open ? "translateY(0)" : "translateY(110%)",
      transition: "transform var(--dur-slow) var(--ease-out)",
      maxHeight: "92%",
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 4,
      borderRadius: 2,
      background: "var(--hairline-2)",
      margin: "0 auto 12px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      border: 0,
      background: "transparent",
      color: "var(--ink-2)",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontSize: 15,
      color: "var(--ink)"
    }
  }, "New word"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: canPost ? "primary" : "secondary",
    onClick: () => {
      if (canPost) onPost({
        word: word.trim(),
        speaker: speaker.trim(),
        gloss: gloss.trim() || null,
        story: story.trim(),
        collection,
        audio: recorded
      });
    },
    style: canPost ? {} : {
      boxShadow: "none",
      opacity: 0.6
    }
  }, "Keep")), /*#__PURE__*/React.createElement(Field, {
    label: "The word or phrase"
  }, /*#__PURE__*/React.createElement("input", {
    ref: ref,
    value: word,
    onChange: e => setWord(e.target.value),
    placeholder: "e.g. Appo \u2014 or a whole saying",
    style: {
      ...inputStyle,
      fontSize: 18,
      fontWeight: 600,
      padding: "9px 12px"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Who said it"
  }, /*#__PURE__*/React.createElement("input", {
    value: speaker,
    onChange: e => setSpeaker(e.target.value),
    placeholder: "Mira, Dad, Theo\u2026",
    style: inputStyle
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Meaning (optional)"
  }, /*#__PURE__*/React.createElement("input", {
    value: gloss,
    onChange: e => setGloss(e.target.value),
    placeholder: "apple",
    style: inputStyle
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "The story (optional)"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: story,
    onChange: e => setStory(e.target.value),
    rows: 2,
    placeholder: "When do they say it? Why does it matter?",
    style: {
      ...inputStyle,
      resize: "none",
      lineHeight: 1.5
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRecorded(v => !v),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      cursor: "pointer",
      border: `1.5px solid ${recorded ? "var(--blue-200)" : "var(--hairline-2)"}`,
      background: recorded ? "var(--blue-50)" : "var(--surface)",
      borderRadius: "var(--r-sm)",
      padding: "9px 12px",
      marginBottom: 12,
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      background: "var(--blue-500)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: recorded ? "check" : "mic",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: recorded ? "var(--on-secondary-soft)" : "var(--ink)"
    }
  }, recorded ? "Audio sample added · 0:03" : "Record their voice")), /*#__PURE__*/React.createElement("label", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--ink-2)"
    }
  }, "Add to a collection"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      margin: "6px 0 8px"
    }
  }, collections.map(c => /*#__PURE__*/React.createElement(Chip, {
    key: c,
    active: collection === c,
    icon: "bookmark",
    onClick: () => setCollection(collection === c ? null : c)
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      borderTop: "1px solid var(--hairline)",
      paddingTop: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 13,
    color: "var(--ink-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--ink-3)"
    }
  }, "Only you, unless you share this dictionary"))));
}
Object.assign(window, {
  Compose
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/compose.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/data.jsx
try { (() => {
/* global React */
// Vocabu UI kit — sample data.
// A personal dictionary of how the people you love talk: a kid's first words,
// a friend's catchphrase, a grandparent's saying. Each entry = a word/phrase,
// an optional short meaning (gloss), a story, and an optional audio sample.

window.VOCABU_USER = {
  name: "Sam",
  handle: "you",
  tone: "rose"
};

// A static waveform shape (bar heights 0–1) reused for audio samples
const WAVE = [.3, .6, .45, .8, .55, .9, .7, 1, .65, .5, .75, .4, .85, .6, .3, .7, .5, .9, .45, .6, .35, .55, .4, .8, .5];
window.VOCABU_ENTRIES = [{
  id: "w1",
  speaker: "Mira",
  tone: "rose",
  rel: "my daughter · 22 mo",
  time: "2d",
  word: "Appo",
  gloss: "apple",
  desc: "Points at the fruit bowl every morning and says it twice, fast — appo-appo. The 'l' disappears completely.",
  audio: {
    dur: "0:03",
    wave: WAVE
  },
  collection: "Mira's words",
  likes: 14,
  liked: true,
  replies: 3,
  saved: false
}, {
  id: "w2",
  speaker: "Dad",
  tone: "blue",
  rel: "my dad",
  time: "5h",
  word: "Measure twice, cut once.",
  gloss: null,
  desc: "He says it for everything now — taxes, breakups, picking paint. I've started hearing it in his voice before I do anything dumb.",
  audio: {
    dur: "0:04",
    wave: WAVE
  },
  collection: "Dad's wisdom",
  likes: 38,
  liked: false,
  replies: 6,
  saved: true
}, {
  id: "w3",
  speaker: "Theo",
  tone: "amber",
  rel: "best friend",
  time: "1d",
  word: "It's giving… Tuesday.",
  gloss: null,
  desc: "His verdict on anything underwhelming. A flat coffee, a bad date, a mediocre film. Devastating every time.",
  audio: null,
  collection: "Theo-isms",
  likes: 21,
  liked: true,
  replies: 9,
  saved: false
}, {
  id: "w4",
  speaker: "Nonna",
  tone: "sage",
  rel: "my grandmother",
  time: "3d",
  word: "Mangia!",
  gloss: "eat — you're far too thin",
  desc: "Deployed within thirty seconds of you entering her house, regardless of when you last ate. There is no correct response.",
  audio: {
    dur: "0:02",
    wave: WAVE
  },
  collection: "Family",
  likes: 31,
  liked: true,
  replies: 8,
  saved: true
}, {
  id: "w5",
  speaker: "Sol",
  tone: "blue",
  rel: "Priya's son · 20 mo",
  time: "4d",
  word: "Tato",
  gloss: "potato / tomato",
  desc: "Refuses to distinguish between the two. Honestly, fair.",
  audio: null,
  collection: "Funny mix-ups",
  likes: 6,
  liked: false,
  replies: 0,
  saved: false
}];
window.VOCABU_COLLECTIONS = [{
  name: "Mira's words",
  count: 12,
  tone: "rose"
}, {
  name: "Dad's wisdom",
  count: 9,
  tone: "blue"
}, {
  name: "Theo-isms",
  count: 17,
  tone: "amber"
}, {
  name: "Family",
  count: 23,
  tone: "sage"
}];
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/detail.jsx
try { (() => {
/* global React, Icon, Avatar, IconButton, TopBar, WordCard */
// Vocabu UI kit — word detail (full entry + replies)

const SAMPLE_REPLIES = [{
  id: "r1",
  name: "Theo",
  tone: "blue",
  time: "2h",
  text: "Mine says 'bork' for every fruit. Solidarity."
}, {
  id: "r2",
  name: "Nonna",
  tone: "sage",
  time: "1h",
  text: "Keep it written down. You forget the sweetest ones."
}];
function Reply({
  r
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      padding: "12px 0",
      borderBottom: "1px solid var(--hairline)"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: r.name,
    tone: r.tone,
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, r.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--ink-3)"
    }
  }, r.time)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      lineHeight: 1.5,
      color: "var(--ink)",
      margin: "2px 0 0"
    }
  }, r.text)));
}
function DetailScreen({
  m,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 50,
      background: "var(--paper)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "Word",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "12px 16px 90px"
    }
  }, /*#__PURE__*/React.createElement(WordCard, {
    m: m,
    expanded: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--ink-2)",
      margin: "20px 0 2px"
    }
  }, "Replies"), SAMPLE_REPLIES.map(r => /*#__PURE__*/React.createElement(Reply, {
    key: r.id,
    r: r
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 16px calc(10px + var(--safe-bottom))",
      background: "var(--bar-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderTop: "1px solid var(--hairline)"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Sam",
    tone: "rose",
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "var(--surface-sunk)",
      borderRadius: "var(--r-pill)",
      padding: "9px 14px",
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink-3)"
    }
  }, "Add a reply\u2026"), /*#__PURE__*/React.createElement(IconButton, {
    name: "send",
    color: "var(--rose-600)"
  })));
}
Object.assign(window, {
  DetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/detail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/primitives.jsx
try { (() => {
/* global React */
// Vocabu UI kit — shared primitives
const {
  useState,
  useRef,
  useEffect,
  useCallback
} = React;

/* ---------- Icon (Lucide, built from icon-node data) ---------- */
function lucideSvg(name, {
  size = 18,
  stroke = 2,
  fill = "none"
} = {}) {
  const pascal = name.split("-").map(p => p[0].toUpperCase() + p.slice(1)).join("");
  const node = window.lucide && window.lucide.icons && window.lucide.icons[pascal];
  if (!node) return "";
  const children = node[2] || [];
  const inner = children.map(([t, a]) => "<" + t + " " + Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ") + "/>").join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function Icon({
  name,
  size = 18,
  stroke = 2,
  fill = "none",
  color,
  style,
  className
}) {
  const html = lucideSvg(name, {
    size,
    stroke,
    fill
  });
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      color,
      lineHeight: 0,
      flex: "0 0 auto",
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: html
    }
  });
}

/* ---------- Avatar ---------- */
const AV_COLORS = {
  rose: ["var(--rose-200)", "var(--rose-700)"],
  blue: ["var(--blue-200)", "var(--blue-700)"],
  sage: ["#D8E4D6", "#3f5a40"],
  amber: ["#F0E2C4", "#7a5e22"],
  ink: ["var(--ink-2)", "#fff"]
};
function Avatar({
  name = "?",
  tone = "blue",
  size = 40,
  ring = false
}) {
  const [bg, fg] = AV_COLORS[tone] || AV_COLORS.blue;
  const inner = /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: bg,
      color: fg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: size * 0.4,
      fontFamily: "var(--font-sans)",
      flex: "0 0 auto"
    }
  }, name[0].toUpperCase());
  if (!ring) return inner;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 2,
      borderRadius: "50%",
      background: "linear-gradient(135deg,var(--rose-400),var(--blue-400))",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 2,
      background: "var(--paper)",
      borderRadius: "50%"
    }
  }, inner));
}

/* ---------- Button (with press scale) ---------- */
function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  onClick,
  style,
  full
}) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: "var(--font-sans)",
    fontWeight: 600,
    border: 0,
    cursor: "pointer",
    borderRadius: "var(--r-btn)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    whiteSpace: "nowrap",
    transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), filter var(--dur-fast)",
    transform: pressed ? "scale(0.97)" : "scale(1)",
    width: full ? "100%" : undefined,
    fontSize: size === "sm" ? 14 : 14.5,
    padding: size === "sm" ? "7px 13px" : "9px 16px",
    minHeight: size === "sm" ? 34 : 40
  };
  const dark = pressed ? "brightness(0.9)" : hover ? "brightness(0.94)" : "none";
  const variants = {
    primary: {
      background: "var(--primary-action)",
      color: "var(--text-on-accent)",
      boxShadow: "var(--shadow-float)",
      filter: dark
    },
    blue: {
      background: "var(--secondary-action)",
      color: "var(--text-on-accent)",
      filter: dark
    },
    secondary: {
      background: hover ? "var(--surface-sunk)" : "var(--surface)",
      color: "var(--ink)",
      border: `1.5px solid ${hover ? "var(--ink-3)" : "var(--hairline-2)"}`
    },
    ghost: {
      background: hover ? "var(--rose-50)" : "transparent",
      color: "var(--rose-600)"
    },
    danger: {
      background: hover ? "var(--danger-bg)" : "transparent",
      color: "var(--danger)"
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    style: {
      ...base,
      ...variants[variant],
      ...style
    },
    onClick: onClick,
    onPointerEnter: () => setHover(true),
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => {
      setPressed(false);
      setHover(false);
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: size === "sm" ? 16 : 17
  }), children);
}

/* ---------- Round icon button ---------- */
function IconButton({
  name,
  onClick,
  active,
  size = 40,
  fill = "none",
  color,
  title
}) {
  const [pressed, setPressed] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    title: title,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      border: 0,
      cursor: "pointer",
      background: "transparent",
      color: color || (active ? "var(--rose-600)" : "var(--ink-2)"),
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transform: pressed ? "scale(0.9)" : "scale(1)",
      transition: "transform var(--dur-fast) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: name,
    size: 20,
    fill: fill
  }));
}

/* ---------- Chip ---------- */
function Chip({
  children,
  active,
  tone = "rose",
  icon,
  onClick
}) {
  const tones = {
    rose: {
      background: "var(--rose-50)",
      border: "var(--rose-200)",
      color: "var(--on-primary-soft)"
    },
    blue: {
      background: "var(--blue-50)",
      border: "var(--blue-200)",
      color: "var(--on-secondary-soft)"
    }
  };
  const on = active ? tones[tone] : {
    background: "var(--surface)",
    border: "var(--hairline-2)",
    color: "var(--ink-2)"
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      fontWeight: 600,
      padding: "5px 10px",
      borderRadius: "var(--r-sm)",
      background: on.background,
      border: `1.5px solid ${on.border}`,
      color: on.color,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "all var(--dur-fast)"
    }
  }, icon && /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 14
  }), children);
}
Object.assign(window, {
  Icon,
  Avatar,
  Button,
  IconButton,
  Chip,
  lucideSvg
});

/* ---------- Theme toggle (light ↔ dark) ---------- */
function setTheme(next) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("vocabu-theme", next);
  } catch (e) {}
}
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setDark(!dark);
  };
  return /*#__PURE__*/React.createElement(IconButton, {
    name: dark ? "sun" : "moon",
    onClick: toggle,
    color: "var(--ink-2)",
    title: dark ? "Switch to light" : "Switch to dark"
  });
}
Object.assign(window, {
  ThemeToggle,
  setTheme
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/screens.jsx
try { (() => {
/* global React, Icon, Avatar, Chip, Button, WordCard, FeedTopBar */
// Vocabu UI kit — Feed, Discover, Saved, Profile

const scrollArea = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "12px 16px calc(var(--bottom-nav-h) + 20px)"
};
const barBg = {
  background: "var(--bar-bg)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--hairline)"
};
const eyebrow = {
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-2)"
};

/* ---------------- FEED ---------------- */
function OnThisDay() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--blue-50)",
      border: "1px solid var(--blue-100)",
      borderRadius: "var(--r-card)",
      padding: "12px 14px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: "var(--blue-100)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--on-secondary-soft)",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "history",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: eyebrow
  }, "On this day"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14.5,
      color: "var(--ink)",
      marginTop: 2
    }
  }, "A year ago you saved your dad's ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600
    }
  }, "\u201CDon't trust a quiet dog.\u201D"))));
}
function FeedScreen({
  entries,
  onOpen
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FeedTopBar, null), /*#__PURE__*/React.createElement("div", {
    style: scrollArea
  }, /*#__PURE__*/React.createElement(OnThisDay, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, entries.map(m => /*#__PURE__*/React.createElement(WordCard, {
    key: m.id,
    m: m,
    onOpen: onOpen
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      color: "var(--ink-3)",
      fontSize: 14,
      marginTop: 24
    }
  }, "That's every new word for now.")));
}

/* ---------------- DISCOVER ---------------- */
function PersonRow({
  name,
  age,
  tone,
  bio
}) {
  const [following, setFollowing] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: name,
    tone: tone,
    size: 42
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ink-3)",
      fontWeight: 400,
      fontSize: 13
    }
  }, "\xB7 ", age)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      color: "var(--ink-2)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, bio)), /*#__PURE__*/React.createElement(Button, {
    variant: following ? "secondary" : "blue",
    size: "sm",
    onClick: () => setFollowing(v => !v)
  }, following ? "Following" : "Follow"));
}
function DiscoverScreen() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 16px 4px",
      background: "var(--paper)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      background: "var(--surface)",
      border: "1.5px solid var(--hairline-2)",
      borderRadius: "var(--r-sm)",
      padding: "7px 10px"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 16,
    color: "var(--ink-3)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink-3)"
    }
  }, "Search words & little ones"))), /*#__PURE__*/React.createElement("div", {
    style: scrollArea
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      margin: "4px 0 8px"
    }
  }, "Explore by theme"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    active: true
  }, "First words"), /*#__PURE__*/React.createElement(Chip, {
    tone: "blue",
    active: true
  }, "Family wisdom"), /*#__PURE__*/React.createElement(Chip, null, "Funny phrases"), /*#__PURE__*/React.createElement(Chip, null, "Inside jokes"), /*#__PURE__*/React.createElement(Chip, {
    tone: "blue",
    active: true
  }, "Sayings")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      margin: "0 0 4px"
    }
  }, "Dictionaries to follow"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r-card)",
      padding: "4px 16px",
      boxShadow: "var(--shadow-sm)"
    }
  }, /*#__PURE__*/React.createElement(PersonRow, {
    name: "Lena",
    age: "her gran's sayings",
    tone: "sage",
    bio: "Sicilian proverbs, mostly threats"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--hairline)"
    }
  }), /*#__PURE__*/React.createElement(PersonRow, {
    name: "Marcus",
    age: "his twins' words",
    tone: "blue",
    bio: "Two toddlers, zero consensus"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--hairline)"
    }
  }), /*#__PURE__*/React.createElement(PersonRow, {
    name: "Priya",
    age: "office one-liners",
    tone: "amber",
    bio: "Things her boss really said"
  }))));
}

/* ---------------- SAVED ---------------- */
function CollectionTile({
  c
}) {
  const tones = {
    rose: "linear-gradient(135deg,var(--rose-300),var(--rose-500))",
    blue: "linear-gradient(135deg,var(--blue-300),var(--blue-500))",
    amber: "linear-gradient(135deg,#E3C98C,var(--warn))",
    sage: "linear-gradient(135deg,#A9C4A6,var(--positive))"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: "var(--r-card)",
      overflow: "hidden",
      border: "1px solid var(--hairline)",
      boxShadow: "var(--shadow-sm)",
      cursor: "pointer",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 78,
      background: tones[c.tone]
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "9px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--ink-2)",
      marginTop: 1
    }
  }, c.count, " words")));
}
function SavedScreen({
  collections,
  entries,
  onOpen
}) {
  const saved = entries.filter(m => m.saved);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      height: 52,
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      ...barBg
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 17,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, "Saved")), /*#__PURE__*/React.createElement("div", {
    style: scrollArea
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      margin: "0 0 10px"
    }
  }, "Collections"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginBottom: 24
    }
  }, collections.map(c => /*#__PURE__*/React.createElement(CollectionTile, {
    key: c.name,
    c: c
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...eyebrow,
      margin: "0 0 10px"
    }
  }, "Recently kept"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, saved.map(m => /*#__PURE__*/React.createElement(WordCard, {
    key: m.id,
    m: m,
    onOpen: onOpen,
    compact: true
  })))));
}

/* ---------------- PROFILE (a child's dictionary) ---------------- */
function Stat({
  n,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 18,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      color: "var(--ink-2)"
    }
  }, label));
}
function ProfileScreen({
  entries,
  onOpen
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 8px",
      ...barBg
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      width: 44,
      height: 44,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      color: "var(--ink-2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 20
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 17,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, "My dictionary"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 44,
      height: 44,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      color: "var(--ink-2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "share",
    size: 19
  }))), /*#__PURE__*/React.createElement("div", {
    style: scrollArea
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "8px 0 18px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Sam",
    tone: "rose",
    size: 74
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 25,
      fontWeight: 600,
      letterSpacing: "-0.02em",
      color: "var(--ink)",
      marginTop: 10
    }
  }, "Sam"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      color: "var(--ink-2)"
    }
  }, "@you"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      color: "var(--ink)",
      maxWidth: 290,
      margin: "10px 0 16px",
      lineHeight: 1.5
    }
  }, "Collecting the way the people I love actually talk."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 30
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    n: "61",
    label: "words"
  }), /*#__PURE__*/React.createElement(Stat, {
    n: "9",
    label: "voices"
  }), /*#__PURE__*/React.createElement(Stat, {
    n: "54",
    label: "followers"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: "pencil",
    size: "sm"
  }, "Edit profile"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--hairline)",
      margin: "0 0 16px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, entries.map(m => /*#__PURE__*/React.createElement(WordCard, {
    key: m.id,
    m: m,
    onOpen: onOpen
  })))));
}
Object.assign(window, {
  FeedScreen,
  DiscoverScreen,
  SavedScreen,
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/word-card.jsx
try { (() => {
/* global React, Avatar, Icon, IconButton */
// Vocabu UI kit — the core feed unit: a dictionary entry for a little one's word

/* ---------- Audio sample player (cosmetic) ---------- */
function AudioSample({
  audio
}) {
  const [playing, setPlaying] = React.useState(false);
  const secs = (() => {
    const [m, s] = audio.dur.split(":").map(Number);
    return m * 60 + s;
  })();
  const toggle = e => {
    e.stopPropagation();
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    clearTimeout(window.__vocabuAudioT);
    window.__vocabuAudioT = setTimeout(() => setPlaying(false), secs * 1000);
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: toggle,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("button", {
    "aria-label": playing ? "Pause" : "Play",
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      flex: "0 0 auto",
      border: "1.5px solid var(--blue-300)",
      background: playing ? "var(--blue-50)" : "transparent",
      color: "var(--blue-600)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: playing ? "pause" : "play",
    size: 13,
    fill: "currentColor",
    stroke: 0
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      height: 20,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(Bars, {
    wave: audio.wave,
    color: "var(--blue-200)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      width: playing ? "100%" : "0%",
      transition: playing ? `width ${secs}s linear` : "width 200ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement(Bars, {
    wave: audio.wave,
    color: "var(--blue-500)"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 500,
      color: "var(--ink-3)",
      fontVariantNumeric: "tabular-nums",
      flex: "0 0 auto"
    }
  }, audio.dur));
}
function Bars({
  wave,
  color
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 3,
      height: "100%",
      width: "100%"
    }
  }, wave.map((h, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      height: `${20 + h * 80}%`,
      background: color,
      borderRadius: 2,
      minWidth: 1.5
    }
  })));
}

/* ---------- Social action ---------- */
function ActionPill({
  icon,
  count,
  active,
  fill,
  onClick,
  color
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      fontFamily: "var(--font-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: active ? color || "var(--like)" : "var(--ink-2)",
      padding: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18,
    fill: active && fill ? "currentColor" : "none"
  }), count > 0 && /*#__PURE__*/React.createElement("span", null, count));
}

/* ---------- Word entry card ---------- */
function WordCard({
  m,
  onOpen,
  compact,
  expanded: forceExpanded
}) {
  const [liked, setLiked] = React.useState(m.liked);
  const [likes, setLikes] = React.useState(m.likes);
  const [saved, setSaved] = React.useState(m.saved);
  const [pop, setPop] = React.useState(false);
  const [open, setOpen] = React.useState(!!forceExpanded);
  const toggleLike = e => {
    e.stopPropagation();
    setLiked(v => {
      const nv = !v;
      setLikes(c => c + (nv ? 1 : -1));
      if (nv) {
        setPop(true);
        setTimeout(() => setPop(false), 260);
      }
      return nv;
    });
  };
  return /*#__PURE__*/React.createElement("article", {
    onClick: () => onOpen && onOpen(m),
    style: {
      background: "var(--surface)",
      border: "1px solid var(--hairline)",
      borderRadius: "var(--r-card)",
      padding: "14px 16px",
      boxShadow: "var(--shadow-sm)",
      cursor: onOpen ? "pointer" : "default"
    }
  }, /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.speaker,
    tone: m.tone,
    size: 38
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.25,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 14,
      fontWeight: 600,
      color: "var(--ink)"
    }
  }, m.speaker), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      color: "var(--ink-2)"
    }
  }, m.rel, " \xB7 ", m.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    name: "more-horizontal",
    size: 32
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 14,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-hand)",
      fontSize: m.word.length > 26 ? 28 : m.word.length > 13 ? 33 : 40,
      fontWeight: 700,
      letterSpacing: "0",
      color: "var(--ink)",
      lineHeight: 1.05
    }
  }, m.word), m.gloss && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      fontWeight: 400,
      color: "var(--ink-2)"
    }
  }, m.gloss)), m.audio && !compact && /*#__PURE__*/React.createElement(AudioSample, {
    audio: m.audio
  }), !compact && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      setOpen(v => !v);
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      border: 0,
      background: "transparent",
      cursor: "pointer",
      padding: 0,
      fontFamily: "var(--font-sans)",
      fontSize: 12.5,
      fontWeight: 600,
      color: "var(--blue-600)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 15,
    style: {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform var(--dur-base) var(--ease-out)"
    }
  }), open ? "Hide meaning" : "Meaning & story"), open && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: 15,
      lineHeight: 1.55,
      color: "var(--ink)",
      margin: "8px 0 0"
    }
  }, m.desc)), m.collection && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontFamily: "var(--font-sans)",
      fontSize: 12,
      fontWeight: 600,
      color: "var(--ink-2)",
      background: "var(--surface-sunk)",
      padding: "4px 9px",
      borderRadius: "var(--r-sm)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bookmark",
    size: 12
  }), " ", m.collection)), /*#__PURE__*/React.createElement("footer", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 26,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      transform: pop ? "scale(1.25)" : "scale(1)",
      transition: "transform var(--dur-base) var(--ease-out)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(ActionPill, {
    icon: "heart",
    count: likes,
    active: liked,
    fill: true,
    onClick: toggleLike
  })), /*#__PURE__*/React.createElement(ActionPill, {
    icon: "message-circle",
    count: m.replies,
    onClick: e => {
      e.stopPropagation();
      onOpen && onOpen(m);
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(ActionPill, {
    icon: saved ? "bookmark-check" : "bookmark",
    active: saved,
    color: "var(--blue-600)",
    onClick: e => {
      e.stopPropagation();
      setSaved(v => !v);
    }
  }))));
}
Object.assign(window, {
  WordCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/word-card.jsx", error: String((e && e.message) || e) }); }

__ds_ns.WordCard = __ds_scope.WordCard;

})();
