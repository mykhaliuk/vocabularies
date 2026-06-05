/* global React, Icon, Avatar, Chip, Button, WordCard, FeedTopBar */
// Vocabu UI kit — Feed, Discover, Saved, Profile

const scrollArea = {
  flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
  padding: "12px 16px calc(var(--bottom-nav-h) + 20px)",
};
const barBg = {
  background: "var(--bar-bg)", backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hairline)",
};
const eyebrow = {
  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--ink-2)",
};

/* ---------------- FEED ---------------- */
function OnThisDay() {
  return (
    <div style={{
      background: "var(--blue-50)", border: "1px solid var(--blue-100)", borderRadius: "var(--r-card)",
      padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "var(--blue-100)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-secondary-soft)", flex: "0 0 auto",
      }}>
        <Icon name="history" size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={eyebrow}>On this day</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--ink)", marginTop: 2 }}>
          A year ago you saved your dad's <b style={{ fontWeight: 600 }}>“Don't trust a quiet dog.”</b>
        </div>
      </div>
    </div>
  );
}

function FeedScreen({ entries, onOpen }) {
  return (
    <>
      <FeedTopBar />
      <div style={scrollArea}>
        <OnThisDay />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((m) => <WordCard key={m.id} m={m} onOpen={onOpen} />)}
        </div>
        <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, marginTop: 24 }}>
          That's every new word for now.
        </p>
      </div>
    </>
  );
}

/* ---------------- DISCOVER ---------------- */
function PersonRow({ name, age, tone, bio }) {
  const [following, setFollowing] = React.useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <Avatar name={name} tone={tone} size={42} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{name} <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 13 }}>· {age}</span></div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bio}</div>
      </div>
      <Button variant={following ? "secondary" : "blue"} size="sm" onClick={() => setFollowing((v) => !v)}>
        {following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}

function DiscoverScreen() {
  return (
    <>
      <div style={{ padding: "12px 16px 4px", background: "var(--paper)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1.5px solid var(--hairline-2)", borderRadius: "var(--r-sm)", padding: "7px 10px" }}>
          <Icon name="search" size={16} color="var(--ink-3)" />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-3)" }}>Search words &amp; little ones</span>
        </div>
      </div>
      <div style={scrollArea}>
        <div style={{ ...eyebrow, margin: "4px 0 8px" }}>Explore by theme</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <Chip active>First words</Chip>
          <Chip tone="blue" active>Family wisdom</Chip>
          <Chip>Funny phrases</Chip>
          <Chip>Inside jokes</Chip>
          <Chip tone="blue" active>Sayings</Chip>
        </div>
        <div style={{ ...eyebrow, margin: "0 0 4px" }}>Dictionaries to follow</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-card)", padding: "4px 16px", boxShadow: "var(--shadow-sm)" }}>
          <PersonRow name="Lena" age="her gran's sayings" tone="sage" bio="Sicilian proverbs, mostly threats" />
          <div style={{ height: 1, background: "var(--hairline)" }} />
          <PersonRow name="Marcus" age="his twins' words" tone="blue" bio="Two toddlers, zero consensus" />
          <div style={{ height: 1, background: "var(--hairline)" }} />
          <PersonRow name="Priya" age="office one-liners" tone="amber" bio="Things her boss really said" />
        </div>
      </div>
    </>
  );
}

/* ---------------- SAVED ---------------- */
function CollectionTile({ c }) {
  const tones = {
    rose: "linear-gradient(135deg,var(--rose-300),var(--rose-500))",
    blue: "linear-gradient(135deg,var(--blue-300),var(--blue-500))",
    amber: "linear-gradient(135deg,#E3C98C,var(--warn))",
    sage: "linear-gradient(135deg,#A9C4A6,var(--positive))",
  };
  return (
    <div style={{ borderRadius: "var(--r-card)", overflow: "hidden", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-sm)", cursor: "pointer", background: "var(--surface)" }}>
      <div style={{ height: 78, background: tones[c.tone] }} />
      <div style={{ padding: "9px 12px" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", marginTop: 1 }}>{c.count} words</div>
      </div>
    </div>
  );
}

function SavedScreen({ collections, entries, onOpen }) {
  const saved = entries.filter((m) => m.saved);
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 20, height: 52, display: "flex", alignItems: "center", padding: "0 16px", ...barBg }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Saved</h1>
      </div>
      <div style={scrollArea}>
        <div style={{ ...eyebrow, margin: "0 0 10px" }}>Collections</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {collections.map((c) => <CollectionTile key={c.name} c={c} />)}
        </div>
        <div style={{ ...eyebrow, margin: "0 0 10px" }}>Recently kept</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {saved.map((m) => <WordCard key={m.id} m={m} onOpen={onOpen} compact />)}
        </div>
      </div>
    </>
  );
}

/* ---------------- PROFILE (a child's dictionary) ---------------- */
function Stat({ n, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{n}</div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)" }}>{label}</div>
    </div>
  );
}

function ProfileScreen({ entries, onOpen }) {
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 20, height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", ...barBg }}>
        <button style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="settings" size={20} /></button>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>My dictionary</h1>
        <button style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="share" size={19} /></button>
      </div>
      <div style={scrollArea}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "8px 0 18px" }}>
          <Avatar name="Sam" tone="rose" size={74} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 25, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", marginTop: 10 }}>Sam</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-2)" }}>@you</div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink)", maxWidth: 290, margin: "10px 0 16px", lineHeight: 1.5 }}>Collecting the way the people I love actually talk.</p>
          <div style={{ display: "flex", gap: 30 }}>
            <Stat n="61" label="words" />
            <Stat n="9" label="voices" />
            <Stat n="54" label="followers" />
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="secondary" icon="pencil" size="sm">Edit profile</Button>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--hairline)", margin: "0 0 16px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((m) => <WordCard key={m.id} m={m} onOpen={onOpen} />)}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { FeedScreen, DiscoverScreen, SavedScreen, ProfileScreen });
