/* global React, Avatar, Icon, IconButton */
// Vocabu UI kit — the core feed unit: a dictionary entry for a little one's word

/* ---------- Audio sample player (cosmetic) ---------- */
function AudioSample({ audio }) {
  const [playing, setPlaying] = React.useState(false);
  const secs = (() => { const [m, s] = audio.dur.split(":").map(Number); return m * 60 + s; })();
  const toggle = (e) => {
    e.stopPropagation();
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    clearTimeout(window.__vocabuAudioT);
    window.__vocabuAudioT = setTimeout(() => setPlaying(false), secs * 1000);
  };
  return (
    <div
      onClick={toggle}
      style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, cursor: "pointer" }}
    >
      <button
        aria-label={playing ? "Pause" : "Play"}
        style={{
          width: 32, height: 32, borderRadius: "50%", flex: "0 0 auto",
          border: "1.5px solid var(--blue-300)", background: playing ? "var(--blue-50)" : "transparent",
          color: "var(--blue-600)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        <Icon name={playing ? "pause" : "play"} size={13} fill="currentColor" stroke={0} />
      </button>
      {/* waveform */}
      <div style={{ position: "relative", flex: 1, height: 20, overflow: "hidden" }}>
        <Bars wave={audio.wave} color="var(--blue-200)" />
        <div style={{
          position: "absolute", inset: 0, overflow: "hidden",
          width: playing ? "100%" : "0%",
          transition: playing ? `width ${secs}s linear` : "width 200ms var(--ease-out)",
        }}>
          <Bars wave={audio.wave} color="var(--blue-500)" />
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>{audio.dur}</span>
    </div>
  );
}
function Bars({ wave, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: "100%", width: "100%" }}>
      {wave.map((h, i) => (
        <span key={i} style={{ flex: 1, height: `${20 + h * 80}%`, background: color, borderRadius: 2, minWidth: 1.5 }} />
      ))}
    </div>
  );
}

/* ---------- Social action ---------- */
function ActionPill({ icon, count, active, fill, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent",
        cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
        color: active ? (color || "var(--like)") : "var(--ink-2)", padding: 0,
      }}
    >
      <Icon name={icon} size={18} fill={active && fill ? "currentColor" : "none"} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

/* ---------- Word entry card ---------- */
function WordCard({ m, onOpen, compact, expanded: forceExpanded }) {
  const [liked, setLiked] = React.useState(m.liked);
  const [likes, setLikes] = React.useState(m.likes);
  const [saved, setSaved] = React.useState(m.saved);
  const [pop, setPop] = React.useState(false);
  const [open, setOpen] = React.useState(!!forceExpanded);

  const toggleLike = (e) => {
    e.stopPropagation();
    setLiked((v) => {
      const nv = !v;
      setLikes((c) => c + (nv ? 1 : -1));
      if (nv) { setPop(true); setTimeout(() => setPop(false), 260); }
      return nv;
    });
  };

  return (
    <article
      onClick={() => onOpen && onOpen(m)}
      style={{
        background: "var(--surface)", border: "1px solid var(--hairline)",
        borderRadius: "var(--r-card)", padding: "14px 16px", boxShadow: "var(--shadow-sm)",
        cursor: onOpen ? "pointer" : "default",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar name={m.speaker} tone={m.tone} size={38} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{m.speaker}</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-2)" }}>{m.rel} · {m.time}</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <IconButton name="more-horizontal" size={32} />
        </div>
      </header>

      {/* The word / phrase + its meaning */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-hand)", fontSize: m.word.length > 26 ? 28 : m.word.length > 13 ? 33 : 40, fontWeight: 700, letterSpacing: "0", color: "var(--ink)", lineHeight: 1.05 }}>{m.word}</span>
        {m.gloss && <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 400, color: "var(--ink-2)" }}>{m.gloss}</span>}
      </div>

      {m.audio && !compact && <AudioSample audio={m.audio} />}

      {/* Unfold meaning & story */}
      {!compact && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "transparent",
              cursor: "pointer", padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600,
              color: "var(--blue-600)",
            }}
          >
            <Icon name="chevron-down" size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform var(--dur-base) var(--ease-out)" }} />
            {open ? "Hide meaning" : "Meaning & story"}
          </button>
          {open && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.55, color: "var(--ink)", margin: "8px 0 0" }}>{m.desc}</p>
          )}
        </div>
      )}

      {m.collection && (
        <div style={{ marginTop: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-sans)",
            fontSize: 12, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-sunk)",
            padding: "4px 9px", borderRadius: "var(--r-sm)",
          }}>
            <Icon name="bookmark" size={12} /> {m.collection}
          </span>
        </div>
      )}

      <footer style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 14 }}>
        <span style={{ transform: pop ? "scale(1.25)" : "scale(1)", transition: "transform var(--dur-base) var(--ease-out)", display: "inline-flex" }}>
          <ActionPill icon="heart" count={likes} active={liked} fill onClick={toggleLike} />
        </span>
        <ActionPill icon="message-circle" count={m.replies} onClick={(e) => { e.stopPropagation(); onOpen && onOpen(m); }} />
        <div style={{ marginLeft: "auto" }}>
          <ActionPill icon={saved ? "bookmark-check" : "bookmark"} active={saved} color="var(--blue-600)"
            onClick={(e) => { e.stopPropagation(); setSaved((v) => !v); }} />
        </div>
      </footer>
    </article>
  );
}

Object.assign(window, { WordCard });
