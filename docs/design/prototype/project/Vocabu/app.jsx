/* global React, ReactDOM, FeedScreen, DiscoverScreen, SavedScreen, ProfileScreen, DetailScreen, SettingsScreen, Compose, LoginScreen, OfflineScreen, TopBar, BottomNav, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, window */
// Vocabu — app shell + Tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "system",
  "accent": "soft",
  "wordWeight": "500",
  "wordStyle": "handwritten",
  "backdrop": true,
  "density": "airy",
  "previewOffline": false
}/*EDITMODE-END*/;

// Dark theme — derived in the DS spirit: near-black surfaces (never pure black),
// near-white text (never pure white), rose + blue accents preserved.
const DARK = {
  "--paper": "#15171A",
  "--surface": "#1E2125",
  "--surface-sunk": "#282C31",
  "--ink": "#ECEEF0",
  "--ink-2": "#9AA0A6",
  "--ink-3": "#6B7177",
  "--hairline": "#2B2F34",
  "--hairline-2": "#3A4046",
  "--rose-50": "rgba(237,83,121,0.16)",
  "--rose-100": "rgba(237,83,121,0.22)",
  "--rose-200": "rgba(237,83,121,0.38)",
  "--rose-700": "#F687A3",
  "--blue-50": "rgba(31,158,219,0.15)",
  "--blue-100": "rgba(31,158,219,0.22)",
  "--blue-200": "rgba(31,158,219,0.34)",
  "--blue-700": "#7CCBEF",
  "--primary-soft": "rgba(237,83,121,0.18)",
  "--primary-soft-border": "rgba(237,83,121,0.36)",
  "--secondary-soft": "rgba(31,158,219,0.15)",
  "--glass-bar": "rgba(20,22,25,0.72)",
  "--glass-nav": "rgba(30,33,37,0.74)",
  "--glass-border": "rgba(255,255,255,0.08)",
  "--shadow-sm": "0 1px 3px rgba(0,0,0,0.4)",
  "--shadow-lg": "0 12px 32px rgba(0,0,0,0.55)",
};

const ACCENTS = {
  soft:     { p: "var(--rose-400)", ph: "var(--rose-500)", pp: "var(--rose-600)", s: "var(--blue-400)", sh: "var(--blue-500)", link: "var(--blue-500)", a: 0.035 },
  standard: { p: "var(--rose-500)", ph: "var(--rose-600)", pp: "var(--rose-700)", s: "var(--blue-500)", sh: "var(--blue-600)", link: "var(--blue-600)", a: 0.05 },
  vivid:    { p: "var(--rose-600)", ph: "var(--rose-700)", pp: "var(--rose-700)", s: "var(--blue-600)", sh: "var(--blue-700)", link: "var(--blue-700)", a: 0.085 },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = React.useState("feed");
  const [detail, setDetail] = React.useState(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [entries, setEntries] = React.useState(window.VOCABU_ENTRIES);
  const [authed, setAuthed] = React.useState(() => { try { return localStorage.getItem("vocabu_authed") === "1"; } catch (e) { return false; } });
  const [offline, setOffline] = React.useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const scrollRef = React.useRef(null);

  const signIn = () => { try { localStorage.setItem("vocabu_authed", "1"); } catch (e) {} setAuthed(true); };
  const signOut = () => { try { localStorage.removeItem("vocabu_authed"); } catch (e) {} setSettingsOpen(false); setTab("feed"); setAuthed(false); };

  React.useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Follow the device theme when set to "system".
  const [prefersDark, setPrefersDark] = React.useState(
    () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e) => setPrefersDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn); };
  }, []);

  const open = (m) => m && setDetail(m);

  const post = ({ word, speaker, rel, gloss, story, collection, audio }) => {
    const m = {
      id: "n" + Date.now(), speaker, tone: "rose", rel: rel || "just now",
      word, gloss, desc: story || "you kept this just now.",
      audio: audio && audio.wave ? audio : null,
      collection, likes: 0, liked: false, replies: 0, saved: false,
    };
    setEntries((arr) => [m, ...arr]);
    setComposeOpen(false);
    setTab("feed");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);

  const ac = ACCENTS[t.accent] || ACCENTS.standard;
  const hand = t.wordStyle === "handwritten";
  const dark = t.theme === "dark" || (t.theme === "system" && prefersDark);
  const rootVars = {
    "--primary": ac.p, "--primary-hover": ac.ph, "--primary-press": ac.pp,
    "--secondary": ac.s, "--secondary-hover": ac.sh, "--like": ac.p, "--link": ac.link,
    "--word-weight": t.wordWeight,
    "--word-font": hand ? "'Caveat', var(--font-sans)" : "var(--font-sans)",
    "--word-scale": hand ? "1.32" : "1",
    "--word-tracking": hand ? "0em" : "-0.025em",
    "--word-leading": hand ? "1.2" : "1.16",
    "--word-pad-b": hand ? "0.14em" : "0px",
    "--entry-pad-y": t.density === "compact" ? "16px" : "28px",
    // glass (light defaults; DARK overrides below)
    "--glass-bar": "rgba(251,254,255,0.72)",
    "--glass-nav": "rgba(255,255,255,0.66)",
    "--glass-border": "rgba(255,255,255,0.7)",
    ...(dark ? DARK : {}),
  };
  const gA = dark ? ac.a + 0.06 : ac.a;
  const backdrop = t.backdrop
    ? `radial-gradient(118% 70% at 12% -4%, rgba(237,83,121,${gA + 0.01}), transparent 52%),
       radial-gradient(120% 72% at 92% 104%, rgba(31,158,219,${gA}), transparent 54%),
       var(--paper)`
    : "var(--paper)";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: backdrop, ...rootVars }}>
      {/* scroll surface */}
      <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {tab === "feed" && (
          <>
            <TopBar brand />
            <FeedScreen entries={entries} onOpen={open} />
            <div style={{ height: "calc(var(--bottom-nav-h) + 40px)" }} />
          </>
        )}
        {tab === "discover" && <DiscoverScreen />}
        {tab === "saved" && <SavedScreen collections={window.VOCABU_COLLECTIONS} entries={entries} onOpen={open} />}
        {tab === "profile" && <ProfileScreen entries={entries} onOpen={open} onSettings={() => setSettingsOpen(true)} />}
      </div>

      <BottomNav active={tab} onNav={setTab} onCompose={() => setComposeOpen(true)} />

      {detail && <DetailScreen m={detail} onBack={() => setDetail(null)} />}
      {settingsOpen && <SettingsScreen theme={t.theme} onTheme={(v) => setTweak("theme", v)} onBack={() => setSettingsOpen(false)} onSignOut={signOut} />}
      <Compose open={composeOpen} onClose={() => setComposeOpen(false)} onPost={post} />

      {!authed && <LoginScreen onSignedIn={signIn} />}
      {(offline || t.previewOffline) && <OfflineScreen onRetry={() => setOffline(typeof navigator !== "undefined" && navigator.onLine === false)} />}

      <TweaksPanel>
        <TweakSection label="Accent" />
        <TweakRadio label="Intensity" value={t.accent} options={["soft", "standard", "vivid"]} onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="The word" />
        <TweakRadio label="Style" value={t.wordStyle} options={["handwritten", "clean"]} onChange={(v) => setTweak("wordStyle", v)} />
        <TweakRadio label="Weight" value={t.wordWeight} options={["500", "600", "700"]} onChange={(v) => setTweak("wordWeight", v)} />
        <TweakSection label="Feed" />
        <TweakToggle label="Backdrop gradient" value={t.backdrop} onChange={(v) => setTweak("backdrop", v)} />
        <TweakRadio label="Density" value={t.density} options={["airy", "compact"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="States" />
        <TweakToggle label="Preview offline" value={t.previewOffline} onChange={(v) => setTweak("previewOffline", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
