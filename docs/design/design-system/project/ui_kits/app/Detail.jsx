/* global React, Icon, Avatar, IconButton, TopBar, WordCard */
// Vocabu UI kit — word detail (full entry + replies)

const SAMPLE_REPLIES = [
  { id: "r1", name: "Theo", tone: "blue", time: "2h", text: "Mine says 'bork' for every fruit. Solidarity." },
  { id: "r2", name: "Nonna", tone: "sage", time: "1h", text: "Keep it written down. You forget the sweetest ones." },
];

function Reply({ r }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}>
      <Avatar name={r.name} tone={r.tone} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{r.name}</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)" }}>{r.time}</span>
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: "var(--ink)", margin: "2px 0 0" }}>{r.text}</p>
      </div>
    </div>
  );
}

function DetailScreen({ m, onBack }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <TopBar title="Word" onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 90px" }}>
        <WordCard m={m} expanded />
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-2)", margin: "20px 0 2px" }}>Replies</div>
        {SAMPLE_REPLIES.map((r) => <Reply key={r.id} r={r} />)}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px calc(10px + var(--safe-bottom))", background: "var(--bar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid var(--hairline)" }}>
        <Avatar name="Sam" tone="rose" size={32} />
        <div style={{ flex: 1, background: "var(--surface-sunk)", borderRadius: "var(--r-pill)", padding: "9px 14px", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-3)" }}>Add a reply…</div>
        <IconButton name="send" color="var(--rose-600)" />
      </div>
    </div>
  );
}

Object.assign(window, { DetailScreen });
