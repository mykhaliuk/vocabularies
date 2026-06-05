/* global React, ReactDOM, FeedScreen, DiscoverScreen, SavedScreen, ProfileScreen, DetailScreen, Compose, BottomNav */
// Vocabu UI kit — app shell

function App() {
  const [tab, setTab] = React.useState("feed");
  const [detail, setDetail] = React.useState(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [entries, setEntries] = React.useState(window.VOCABU_ENTRIES);

  const open = (m) => setDetail(m);

  const post = ({ word, speaker, gloss, story, collection, audio }) => {
    const m = {
      id: "n" + Date.now(), speaker: speaker || "You", tone: "rose", rel: "just now", time: "now",
      word, gloss, desc: story, audio: audio ? { dur: "0:03", wave: [.3,.6,.5,.8,.6,.9,.7,1,.6,.5,.7,.4,.8,.6,.3,.7,.5,.9,.5,.6] } : null,
      collection, likes: 0, liked: false, replies: 0, saved: false,
    };
    setEntries((arr) => [m, ...arr]);
    setComposeOpen(false);
    setTab("feed");
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--paper)", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "feed" && <FeedScreen entries={entries} onOpen={open} />}
        {tab === "discover" && <DiscoverScreen />}
        {tab === "saved" && <SavedScreen collections={window.VOCABU_COLLECTIONS} entries={entries} onOpen={open} />}
        {tab === "profile" && <ProfileScreen entries={entries} onOpen={open} />}
      </div>

      <BottomNav active={tab} onNav={setTab} onCompose={() => setComposeOpen(true)} />

      {detail && <DetailScreen m={detail} onBack={() => setDetail(null)} />}
      <Compose open={composeOpen} onClose={() => setComposeOpen(false)} onPost={post} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
