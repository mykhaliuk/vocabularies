/* global React, Icon, Avatar, window */
// Vocabu — the feed: "one big word per entry", edge-to-edge, hairline dividers.

const { useState } = React;

/* ---------- the large word, auto-shrinks for longer phrases ---------- */
function WordText({ word, size }) {
  const len = word.length;
  const fs = size != null ? size
    : len <= 13 ? 40
    : len <= 20 ? 33
    : len <= 30 ? 27
    : len <= 44 ? 22
    : 19;
  return (
    <div style={{ alignSelf: "stretch" }}>
      <h2 style={{
        margin: 0, textAlign: "center",
        fontFamily: "var(--word-font, var(--font-sans))", fontWeight: "var(--word-weight, 600)",
        fontSize: `calc(${fs}px * var(--word-scale, 1))`, lineHeight: "var(--word-leading, 1.16)",
        letterSpacing: "var(--word-tracking, -0.025em)", color: "var(--ink)",
        paddingBottom: "var(--word-pad-b, 0px)",
        overflowWrap: "break-word", hyphens: "manual",
      }}>
        <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>“</span>{word}<span style={{ color: "var(--ink-3)", fontWeight: 400 }}>”</span>
      </h2>
    </div>
  );
}

/* ---------- airy, elegant audio sample (cosmetic playback) ---------- */
function AudioSample({ audio, big }) {
  const [playing, setPlaying] = useState(false);
  const secs = (() => { const [m, s] = audio.dur.split(":").map(Number); return m * 60 + s; })();
  const toggle = (e) => {
    e.stopPropagation();
    if (playing) { setPlaying(false); return; }
    setPlaying(true);
    clearTimeout(window.__vocabuAudioT);
    window.__vocabuAudioT = setTimeout(() => setPlaying(false), secs * 1000);
  };
  const playBtn = big ? 44 : 36;
  return (
    <div onClick={toggle}
      style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", width: "100%", maxWidth: big ? 360 : 320, margin: "0 auto" }}>
      <button aria-label={playing ? "pause" : "play"}
        style={{
          width: playBtn, height: playBtn, borderRadius: "var(--r-sm)", flex: "0 0 auto",
          border: "1.5px solid var(--blue-300)", background: playing ? "var(--secondary-soft)" : "transparent",
          color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          transition: "background var(--dur-fast)",
        }}>
        <Icon name={playing ? "pause" : "play"} size={big ? 17 : 14} fill="currentColor" stroke={0} />
      </button>
      <div style={{ position: "relative", flex: 1, height: big ? 30 : 24, overflow: "hidden" }}>
        <Bars wave={audio.wave} color="var(--blue-200)" />
        <div style={{
          position: "absolute", inset: 0, overflow: "hidden",
          width: playing ? "100%" : "0%",
          transition: playing ? `width ${secs}s linear` : "width 220ms var(--ease-out)",
        }}>
          <Bars wave={audio.wave} color="var(--secondary)" />
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>{audio.dur}</span>
    </div>
  );
}
function Bars({ wave, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: "100%", width: "100%" }}>
      {wave.map((h, i) => (
        <span key={i} style={{ flex: 1, height: `${16 + h * 84}%`, background: color, borderRadius: 3, minWidth: 1.5 }} />
      ))}
    </div>
  );
}

/* ---------- social row ---------- */
function SocialRow({ m, liked, likes, saved, onLike, onSave, onReply, pop }) {
  const item = (icon, count, { active, fill, color, onClick, scale } = {}) => (
    <button onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, border: 0, background: "transparent",
        cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, padding: "6px 4px",
        color: active ? (color || "var(--like)") : "var(--ink-2)", minHeight: 44,
        transform: scale ? "scale(1.22)" : "scale(1)", transition: "transform var(--dur-base) var(--ease-out), color var(--dur-fast)",
      }}>
      <Icon name={icon} size={19} fill={active && fill ? "currentColor" : "none"} />
      {count > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 30 }}>
      {item("heart", likes, { active: liked, fill: true, onClick: onLike, scale: pop })}
      {item("message-circle", m.replies, { onClick: onReply })}
      {item(saved ? "bookmark-check" : "bookmark", 0, { active: saved, color: "var(--secondary)", onClick: onSave })}
    </div>
  );
}

/* ---------- a feed entry ---------- */
function Entry({ m, onOpen }) {
  const [liked, setLiked] = useState(m.liked);
  const [likes, setLikes] = useState(m.likes);
  const [saved, setSaved] = useState(m.saved);
  const [pop, setPop] = useState(false);

  const toggleLike = (e) => {
    e.stopPropagation();
    setLiked((v) => {
      const nv = !v;
      setLikes((c) => c + (nv ? 1 : -1));
      if (nv) { setPop(true); setTimeout(() => setPop(false), 280); }
      return nv;
    });
  };

  return (
    <article onClick={() => onOpen && onOpen(m)}
      style={{
        padding: "var(--entry-pad-y, 26px) 20px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 14, cursor: onOpen ? "pointer" : "default", textAlign: "center",
      }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.3, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{m.speaker}</span>
        {m.rel && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {m.rel}</span>}
      </div>

      <WordText word={m.word} />

      {m.gloss && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontStyle: "italic", color: "var(--ink-2)", marginTop: -4 }}>
          {m.gloss}
        </div>
      )}

      {m.audio && <div style={{ width: "100%", marginTop: 2 }}><AudioSample audio={m.audio} /></div>}

      <div style={{ marginTop: 2 }}>
        <SocialRow m={m} liked={liked} likes={likes} saved={saved} pop={pop}
          onLike={toggleLike}
          onSave={(e) => { e.stopPropagation(); setSaved((v) => !v); }}
          onReply={(e) => { e.stopPropagation(); onOpen && onOpen(m); }} />
      </div>
    </article>
  );
}

/* ---------- on this day — a gentle blue band woven into the feed ---------- */
function OnThisDayBand({ m, onOpen, onKeep }) {
  const [kept, setKept] = useState(false);
  return (
    <section
      style={{
        background: "var(--secondary-soft)", padding: "22px 24px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
        cursor: "pointer",
      }}
      onClick={() => onOpen && onOpen(m)}>
      <div style={{
        fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase", color: "var(--on-secondary-soft)", whiteSpace: "nowrap",
      }}>
        On this day · a year ago
      </div>
      <WordText word={m.word} size={m.word.length > 22 ? 26 : 32} />
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontStyle: "italic", color: "var(--ink-2)" }}>
        {m.otdLine}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setKept(true); onKeep && onKeep(); }}
        style={{
          marginTop: 2, display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent",
          cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
          color: "var(--link)", padding: "8px 4px", minHeight: 44, whiteSpace: "nowrap",
        }}>
        {kept ? "kept again" : "keep it again"}
        <Icon name={kept ? "check" : "arrow-right"} size={16} />
      </button>
    </section>
  );
}

/* ---------- virgin feed — no words yet ---------- */
function EmptyFeed() {
  return (
    <div style={{
      minHeight: "calc(100% - 54px)", position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "40px 40px 0",
    }}>
      <div style={{
        width: 78, height: 78, borderRadius: "50%", background: "var(--primary-soft)",
        border: "1px solid var(--primary-soft-border)", color: "var(--primary)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22, flex: "0 0 auto",
      }}>
        <Icon name="feather" size={32} />
      </div>
      <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", whiteSpace: "nowrap" }}>
        no words yet.
      </h2>
      <p style={{ margin: "10px 0 0", maxWidth: 270, fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
        keep the first thing someone says that makes you smile.
      </p>

      {/* arrow guiding the eye down to the compose button */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 100,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none",
      }}>
        <span style={{ fontFamily: "'Caveat', var(--font-sans)", fontSize: 23, fontWeight: 600, color: "var(--primary)", transform: "rotate(-4deg)" }}>
          tap to keep your first one
        </span>
        <svg width="46" height="68" viewBox="0 0 46 70" fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: "vbob 2.2s var(--ease-in-out) infinite" }}>
          <path d="M28 5 C 36 24, 35 44, 23 62" />
          <path d="M13 52 L 23 64 L 34 54" />
        </svg>
      </div>
    </div>
  );
}

/* ---------- the feed ---------- */
function FeedScreen({ entries, onOpen, onKeep }) {
  if (!entries.length) return <EmptyFeed />;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {entries.map((m, i) => (
        <React.Fragment key={m.id}>
          {i > 0 && <div style={{ height: 1, background: "var(--hairline)" }} />}
          {m.band
            ? <OnThisDayBand m={m} onOpen={onOpen} onKeep={onKeep} />
            : <Entry m={m} onOpen={onOpen} />}
        </React.Fragment>
      ))}
      <div style={{ height: 1, background: "var(--hairline)" }} />
      <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", color: "var(--ink-3)", fontSize: 14, padding: "26px 20px 10px" }}>
        that's every word for now.
      </p>
    </div>
  );
}

Object.assign(window, { FeedScreen, EmptyFeed, Entry, AudioSample, WordText, SocialRow });
