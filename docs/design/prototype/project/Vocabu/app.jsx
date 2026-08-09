/* global React, ReactDOM, FeedScreen, DiscoverScreen, SavedScreen, ProfileScreen, PeopleScreen, DetailScreen, SettingsScreen, Compose, LoginScreen, OfflineScreen, TopBar, BottomNav, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, window */
// Vocabu — app shell + Tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "system",
  "accent": "soft",
  "wordWeight": "500",
  "wordStyle": "handwritten",
  "backdrop": true,
  "density": "airy",
  "previewOffline": false,
  "emptyFeed": false,
  "entryActions": "menu",
  "plan": "free",
  "picker": "by plan",
  "videoState": "ready",
  "videoOrientation": "portrait"
}/*EDITMODE-END*/;

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
  const [editing, setEditing] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [peopleOpen, setPeopleOpen] = React.useState(false);
  const [speakers, setSpeakersState] = React.useState(window.VOCABU_SPEAKERS);
  const [entries, setEntries] = React.useState(window.VOCABU_ENTRIES);

  // keep the global in step so the feed/detail can resolve a speaker without prop-drilling.
  const setSpeakers = (next) => { window.VOCABU_SPEAKERS = next; setSpeakersState(next); };
  const addSpeaker = (sp) => setSpeakers([...speakers, sp]);
  const saveSpeaker = (sp) => setSpeakers(speakers.map((s) => (s.id === sp.id ? sp : s)));
  const deleteSpeaker = (sp) => setSpeakers(speakers.filter((s) => s.id !== sp.id));
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

  const post = ({ word, speakerId, gloss, story, collection, audio, video }) => {
    const sp = speakers.find((s) => s.id === speakerId);
    if (editing) {
      const upd = {
        ...editing, sid: sp ? sp.id : null,
        speaker: sp ? sp.name : editing.speaker, tone: sp ? sp.tone : editing.tone, rel: sp ? null : editing.rel,
        word, gloss, desc: story || editing.desc, collection,
        audio: audio || null, video: video || null,
      };
      setEntries((arr) => arr.map((e) => (e.id === editing.id ? upd : e)));
      setDetail((d) => (d && d.id === editing.id ? upd : d));
      setEditing(null); setComposeOpen(false);
      return;
    }
    setTweak("emptyFeed", false);
    // most recently used floats to the front of the chip row — but only after the sheet closes.
    if (sp) setSpeakers([sp, ...speakers.filter((s) => s.id !== sp.id)]);
    const m = {
      id: "n" + Date.now(), sid: sp ? sp.id : null, saidAt: new Date().toISOString().slice(0, 10),
      speaker: sp ? sp.name : "You", tone: sp ? sp.tone : "rose", rel: sp ? null : "just now",
      word, gloss, desc: story || "you kept this just now.",
      audio: audio && audio.wave ? audio : null,
      video: video || null,
      collection, likes: 0, liked: false, replies: 0, saved: false,
    };
    setEntries((arr) => [m, ...arr]);
    setComposeOpen(false);
    setTab("feed");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const openEdit = (m) => { setEditing(m); setComposeOpen(true); };
  const deleteEntry = (m) => { setEntries((arr) => arr.filter((e) => e.id !== m.id)); setDetail(null); };

  const setSaidAt = (m, date) => {
    setEntries((arr) => arr.map((e) => (e.id === m.id ? { ...e, saidAt: date } : e)));
    setDetail((d) => (d && d.id === m.id ? { ...d, saidAt: date } : d));
  };

  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab]);

  const ac = ACCENTS[t.accent] || ACCENTS.standard;
  const mediaTweaks = { state: t.videoState, orientation: t.videoOrientation };  const hand = t.wordStyle === "handwritten";
  const dark = t.theme === "dark" || (t.theme === "system" && prefersDark);

  // Drive the official DS dark theme by toggling [data-theme] on <html>.
  // useLayoutEffect runs before paint, so there's no flash on toggle.
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const rootVars = {
    "--primary": ac.p, "--primary-hover": ac.ph, "--primary-press": ac.pp,
    "--secondary": ac.s, "--secondary-hover": ac.sh, "--like": ac.p, "--link": ac.link,
    "--word-weight": t.wordWeight,
    "--word-font": hand ? "var(--font-hand)" : "var(--font-sans)",
    "--word-scale": hand ? "1.39" : "1",
    "--word-tracking": hand ? "0em" : "-0.025em",
    "--word-leading": hand ? "1.2" : "1.16",
    "--word-pad-b": hand ? "0.14em" : "0px",
    "--entry-pad-y": t.density === "compact" ? "16px" : "28px",
  };
  const gA = dark ? ac.a + 0.06 : ac.a;
  const backdrop = t.backdrop
    ? `radial-gradient(118% 70% at 12% -4%, color-mix(in oklch, var(--rose-500) ${((gA + 0.01) * 100).toFixed(1)}%, transparent), transparent 52%),
       radial-gradient(120% 72% at 92% 104%, color-mix(in oklch, var(--blue-500) ${(gA * 100).toFixed(1)}%, transparent), transparent 54%),
       var(--paper)`
    : "var(--paper)";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: backdrop, ...rootVars }}>
      {/* scroll surface */}
      <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {tab === "feed" && (
          <>
            <TopBar brand />
            <FeedScreen entries={t.emptyFeed ? [] : entries} onOpen={open} media={mediaTweaks} />
            {!t.emptyFeed && <div style={{ height: "calc(var(--bottom-nav-h) + 40px)" }} />}
          </>
        )}
        {tab === "discover" && <DiscoverScreen />}
        {tab === "saved" && <SavedScreen collections={window.VOCABU_COLLECTIONS} entries={entries} onOpen={open} />}
        {tab === "profile" && <ProfileScreen entries={entries} speakers={speakers} onOpen={open} onSettings={() => setSettingsOpen(true)} onPeople={() => setPeopleOpen(true)} />}
      </div>

      <BottomNav active={tab} onNav={setTab} onCompose={() => setComposeOpen(true)} />

      {detail && <DetailScreen m={detail} onBack={() => setDetail(null)} media={mediaTweaks} onSaidAt={setSaidAt} onEdit={openEdit} onDelete={deleteEntry} actions={t.entryActions} />}
      {peopleOpen && <PeopleScreen speakers={speakers} entries={entries} onBack={() => setPeopleOpen(false)} onSave={saveSpeaker} onCreate={addSpeaker} onDelete={deleteSpeaker} />}
      {settingsOpen && <SettingsScreen theme={t.theme} onTheme={(v) => setTweak("theme", v)} onBack={() => setSettingsOpen(false)} onSignOut={signOut} />}
      <Compose open={composeOpen} onClose={() => { setComposeOpen(false); setEditing(null); }} onPost={post} plan={t.plan} picker={t.picker} speakers={speakers} onAddSpeaker={addSpeaker} editing={editing} />

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
        <TweakSection label="Media (VKB-66 / 67)" />
        <TweakRadio label="Plan" value={t.plan} options={["free", "premium"]} onChange={(v) => setTweak("plan", v)} />
        <TweakRadio label="Compose picker" value={t.picker} options={["by plan", "separate", "combined"]} onChange={(v) => setTweak("picker", v)} />
        <TweakRadio label="Feed video" value={t.videoState} options={["ready", "processing", "failed"]} onChange={(v) => setTweak("videoState", v)} />
        <TweakRadio label="Orientation" value={t.videoOrientation} options={["portrait", "landscape"]} onChange={(v) => setTweak("videoOrientation", v)} />
        <TweakSection label="Entry actions (edit/delete)" />
        <TweakRadio label="On detail" value={t.entryActions} options={["menu", "icons"]} onChange={(v) => setTweak("entryActions", v)} />
        <TweakSection label="States" />
        <TweakToggle label="Empty feed" value={t.emptyFeed} onChange={(v) => setTweak("emptyFeed", v)} />
        <TweakToggle label="Preview offline" value={t.previewOffline} onChange={(v) => setTweak("previewOffline", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
