/* global React, Icon, Avatar, IconButton, TopBar, WordText, AudioSample, SocialRow, window */
// Vocabu — word detail: full entry, unfoldable meaning & story, tender replies.

const { useState: useD } = React;

function Reply({ r }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0" }}>
      <Avatar name={r.name} tone={r.tone} size={36} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{r.name}</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)" }}>{r.time}</span>
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15.5, lineHeight: 1.5, color: "var(--ink)", margin: "3px 0 0" }}>{r.text}</p>
      </div>
    </div>
  );
}

function DetailScreen({ m, onBack }) {
  const [liked, setLiked] = useD(m.liked);
  const [likes, setLikes] = useD(m.likes);
  const [saved, setSaved] = useD(m.saved);
  const [pop, setPop] = useD(false);
  const [open, setOpen] = useD(true);
  const replies = (window.VOCABU_REPLIES && window.VOCABU_REPLIES[m.id]) || [];

  const toggleLike = () => setLiked((v) => {
    const nv = !v; setLikes((c) => c + (nv ? 1 : -1));
    if (nv) { setPop(true); setTimeout(() => setPop(false), 280); }
    return nv;
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <TopBar title="word" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 120px" }}>
        {/* the entry */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0 8px", textAlign: "center" }}>
          <Avatar name={m.speaker} tone={m.tone} size={52} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.3, marginTop: -4, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{m.speaker}</span>
            {m.rel && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {m.rel}</span>}
          </div>
          <WordText word={m.word} />
          {m.gloss && <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontStyle: "italic", color: "var(--ink-2)", marginTop: -6 }}>{m.gloss}</div>}
          {m.audio && <div style={{ width: "100%", marginTop: 6 }}><AudioSample audio={m.audio} big /></div>}
        </div>

        {/* unfoldable meaning & story — blue toggle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 14 }}>
          <button onClick={() => setOpen((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent",
              cursor: "pointer", padding: "8px 4px", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              color: "var(--link)", minHeight: 44, whiteSpace: "nowrap",
            }}>
            <Icon name="chevron-down" size={16} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform var(--dur-base) var(--ease-out)" }} />
            {open ? "hide meaning & story" : "meaning & story"}
          </button>
          {open && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.6, color: "var(--ink)", margin: "6px 0 0", maxWidth: 330, textAlign: "center" }}>{m.desc}</p>
          )}
        </div>

        {/* collection tag */}
        {m.collection && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)",
              fontSize: 13, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-sunk)",
              padding: "7px 13px", borderRadius: "var(--r-sm)",
            }}>
              <Icon name="bookmark" size={14} /> {m.collection}
            </span>
          </div>
        )}

        {/* social row */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
          <SocialRow m={m} liked={liked} likes={likes} saved={saved} pop={pop}
            onLike={toggleLike} onSave={() => setSaved((v) => !v)} onReply={() => {}} />
        </div>

        {/* replies */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            {replies.length > 0 ? "replies" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
            {replies.map((r, i) => (
              <React.Fragment key={r.id}>
                {i > 0 && <div style={{ height: 1, background: "var(--hairline)" }} />}
                <Reply r={r} />
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* reply composer */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px calc(12px + var(--safe-bottom))", background: "var(--bar-bg)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--hairline)",
      }}>
        <Avatar name="Sam" tone="rose" size={34} />
        <div style={{ flex: 1, background: "var(--surface-sunk)", borderRadius: "var(--r-pill)", padding: "11px 16px", fontFamily: "var(--font-sans)", fontSize: 14.5, color: "var(--ink-3)" }}>add a reply…</div>
        <IconButton name="send" color="var(--primary-hover)" />
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen });
