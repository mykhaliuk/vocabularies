/* global React, Icon, Avatar, Chip, Button, window */
// Vocabu — Discover, Saved, Profile.

const { useState: useS } = React;

const sBarBg = {
  background: "var(--bar-bg)", backdropFilter: "blur(16px) saturate(1.4)",
  WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderBottom: "1px solid var(--hairline)",
};
const sEyebrow = {
  fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
  textTransform: "uppercase", color: "var(--ink-3)",
};

/* compact word row (saved / collections) */
function WordRow({ m, onOpen }) {
  return (
    <button onClick={() => onOpen && onOpen(m)}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        background: "transparent", border: 0, cursor: "pointer", padding: "13px 0",
      }}>
      <Avatar name={m.speaker} tone={m.tone} size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          “{m.word}”
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", marginTop: 1 }}>
          {m.speaker}{m.gloss ? ` · ${m.gloss}` : ""}
        </div>
      </div>
      {m.audio && <Icon name="volume-2" size={16} color="var(--blue-400)" />}
    </button>
  );
}

/* ---------------- DISCOVER ---------------- */
function FollowRow({ p }) {
  const [following, setFollowing] = useS(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
      <Avatar name={p.name} tone={p.tone} size={44} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.35, marginTop: 1 }}>{p.bio}</div>
        <div style={{ ...sEyebrow, fontSize: 10.5, marginTop: 4, color: "var(--ink-3)" }}>{p.sub}</div>
      </div>
      <Button variant={following ? "secondary" : "blue"} size="sm" onClick={() => setFollowing((v) => !v)}>
        {following ? "following" : "follow"}
      </Button>
    </div>
  );
}

function DiscoverScreen() {
  const themes = window.VOCABU_THEMES || [];
  const follow = window.VOCABU_FOLLOW || [];
  const [active, setActive] = useS("first words");
  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "10px 16px 12px", ...sBarBg }}>
        <h1 style={{ margin: "2px 0 12px", fontFamily: "var(--font-sans)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>discover</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-sunk)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
          <Icon name="search" size={18} color="var(--ink-3)" />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink-3)" }}>search words & the people who say them</span>
        </div>
      </div>
      <div style={{ padding: "18px 16px calc(var(--bottom-nav-h) + 40px)" }}>
        <div style={sEyebrow}>browse by theme</div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", margin: "12px 0 26px" }}>
          {themes.map((t, i) => (
            <Chip key={t} tone={i % 2 ? "blue" : "rose"} active={active === t} onClick={() => setActive(t)}>{t}</Chip>
          ))}
        </div>
        <div style={sEyebrow}>dictionaries to follow</div>
        <div style={{ marginTop: 6 }}>
          {follow.map((p, i) => (
            <React.Fragment key={p.name}>
              {i > 0 && <div style={{ height: 1, background: "var(--hairline)" }} />}
              <FollowRow p={p} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SAVED ---------------- */
function CollectionTile({ c, onOpen }) {
  const tint = {
    rose: { bg: "var(--primary-soft)", fg: "var(--on-primary-soft)", line: "var(--rose-200)" },
    blue: { bg: "var(--secondary-soft)", fg: "var(--on-secondary-soft)", line: "var(--blue-200)" },
    ink:  { bg: "var(--surface-sunk)", fg: "var(--ink-2)", line: "var(--hairline-2)" },
  }[c.tone] || { bg: "var(--surface-sunk)", fg: "var(--ink-2)", line: "var(--hairline-2)" };
  return (
    <button onClick={onOpen}
      style={{
        textAlign: "left", border: `1px solid ${tint.line}`, background: tint.bg, cursor: "pointer",
        borderRadius: "var(--r-card)", padding: "16px 16px 14px", display: "flex", flexDirection: "column",
        gap: 10, minHeight: 110,
      }}>
      <Icon name="bookmark" size={20} color={tint.fg} fill="currentColor" />
      <div style={{ marginTop: "auto" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>{c.name}</div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{c.count} words · {c.voices}</div>
      </div>
    </button>
  );
}

function SavedScreen({ collections, entries, onOpen }) {
  const saved = entries.filter((m) => m.saved);
  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 20, height: 54, display: "flex", alignItems: "center", padding: "0 16px", ...sBarBg }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>saved</h1>
      </div>
      <div style={{ padding: "18px 16px calc(var(--bottom-nav-h) + 40px)" }}>
        <div style={{ ...sEyebrow, marginBottom: 12 }}>collections</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          {collections.map((c) => <CollectionTile key={c.name} c={c} onOpen={() => onOpen && onOpen(entries.find((e) => e.collection === c.name))} />)}
        </div>
        <div style={{ ...sEyebrow, marginBottom: 4 }}>recently kept</div>
        <div>
          {saved.map((m, i) => (
            <React.Fragment key={m.id}>
              {i > 0 && <div style={{ height: 1, background: "var(--hairline)" }} />}
              <WordRow m={m} onOpen={onOpen} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROFILE — my dictionary ---------------- */
function ProfileScreen({ entries, onOpen, onSettings }) {
  return (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 20, height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", ...sBarBg }}>
        <button onClick={onSettings} style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="settings" size={21} />
        </button>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>my dictionary</h1>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ padding: "8px 16px calc(var(--bottom-nav-h) + 40px)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "16px 0 22px" }}>
          <Avatar name="Sam" tone="rose" size={78} ring />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", marginTop: 12 }}>Sam</div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 15.5, color: "var(--ink-2)", maxWidth: 280, margin: "8px 0 16px", lineHeight: 1.5 }}>
            keeping the way the people I love actually talk.
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14 }}>
            <span><b style={{ color: "var(--ink)", fontWeight: 700 }}>61</b> words</span>
            <span>·</span>
            <span><b style={{ color: "var(--ink)", fontWeight: 700 }}>5</b> voices</span>
          </div>
        </div>

        <div style={{ ...sEyebrow, marginBottom: 12 }}>your collections</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 26 }}>
          {(window.VOCABU_COLLECTIONS || []).map((c) => (
            <CollectionTile key={c.name} c={c} onOpen={() => onOpen && onOpen(entries.find((e) => e.collection === c.name))} />
          ))}
        </div>

        <div style={{ ...sEyebrow, marginBottom: 4 }}>lately</div>
        <div>
          {entries.filter((m) => !m.band).slice(0, 4).map((m, i) => (
            <React.Fragment key={m.id}>
              {i > 0 && <div style={{ height: 1, background: "var(--hairline)" }} />}
              <WordRow m={m} onOpen={onOpen} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SETTINGS ---------------- */
function SettingsScreen({ theme, onTheme, onBack, onSignOut }) {
  const opts = ["system", "light", "dark"];
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 55, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <TopBar title="settings" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 40px" }}>
        <div style={{ ...sEyebrow, margin: "8px 2px 10px" }}>appearance</div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 15.5, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>theme</div>
          <div style={{ display: "flex", background: "var(--surface-sunk)", borderRadius: "var(--r-sm)", padding: 3, gap: 3 }}>
            {opts.map((o) => {
              const on = theme === o;
              return (
                <button key={o} onClick={() => onTheme(o)}
                  style={{
                    flex: 1, padding: "10px 6px", borderRadius: 8, border: 0, cursor: "pointer",
                    fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, minHeight: 44,
                    background: on ? "var(--surface)" : "transparent",
                    color: on ? "var(--ink)" : "var(--ink-2)",
                    boxShadow: on ? "var(--shadow-sm)" : "none",
                    transition: "background var(--dur-fast), color var(--dur-fast)",
                  }}>{o}</button>
              );
            })}
          </div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", margin: "12px 2px 0", lineHeight: 1.4 }}>
            system follows your device.
          </p>
        </div>

        <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", marginTop: 32, lineHeight: 1.5 }}>
          Vocabu · never lose your sweet moments.
        </p>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button onClick={onSignOut}
            style={{
              border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)",
              fontSize: 14.5, fontWeight: 600, color: "var(--danger)", display: "inline-flex",
              alignItems: "center", gap: 7, padding: "10px 16px", minHeight: 44, whiteSpace: "nowrap",
            }}>
            <Icon name="log-out" size={17} /> sign out
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DiscoverScreen, SavedScreen, ProfileScreen, WordRow, SettingsScreen });
