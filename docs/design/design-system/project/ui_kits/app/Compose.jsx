/* global React, Icon, Avatar, Button, IconButton, Chip */
// Vocabu UI kit — Compose: capture a word or phrase someone said

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-2)" }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = {
  border: "1.5px solid var(--hairline-2)", outline: 0, background: "var(--surface)",
  borderRadius: "var(--r-sm)", padding: "7px 10px", fontFamily: "var(--font-sans)",
  fontSize: 14, color: "var(--ink)", width: "100%", boxSizing: "border-box",
};

function Compose({ open, onClose, onPost }) {
  const [word, setWord] = React.useState("");
  const [speaker, setSpeaker] = React.useState("");
  const [gloss, setGloss] = React.useState("");
  const [story, setStory] = React.useState("");
  const [collection, setCollection] = React.useState(null);
  const [recorded, setRecorded] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      setWord(""); setSpeaker(""); setGloss(""); setStory(""); setCollection(null); setRecorded(false);
      setTimeout(() => ref.current && ref.current.focus(), 240);
    }
  }, [open]);

  const collections = ["Mira's words", "Dad's wisdom", "Theo-isms", "Family"];
  const canPost = word.trim() && speaker.trim();

  return (
    <div aria-hidden={!open} style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: open ? "auto" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "var(--scrim)", opacity: open ? 1 : 0, transition: "opacity var(--dur-base) var(--ease-out)" }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "var(--surface)", borderTopLeftRadius: "var(--r-xl)", borderTopRightRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)", padding: "10px 16px calc(16px + var(--safe-bottom))",
        transform: open ? "translateY(0)" : "translateY(110%)", transition: "transform var(--dur-slow) var(--ease-out)",
        maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: "var(--hairline-2)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onClose} style={{ border: 0, background: "transparent", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>New word</span>
          <Button size="sm" variant={canPost ? "primary" : "secondary"} onClick={() => { if (canPost) onPost({ word: word.trim(), speaker: speaker.trim(), gloss: gloss.trim() || null, story: story.trim(), collection, audio: recorded }); }} style={canPost ? {} : { boxShadow: "none", opacity: 0.6 }}>Keep</Button>
        </div>

        <Field label="The word or phrase">
          <input ref={ref} value={word} onChange={(e) => setWord(e.target.value)} placeholder="e.g. Appo — or a whole saying"
            style={{ ...inputStyle, fontSize: 18, fontWeight: 600, padding: "9px 12px" }} />
        </Field>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="Who said it"><input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Mira, Dad, Theo…" style={inputStyle} /></Field></div>
          <div style={{ flex: 1 }}><Field label="Meaning (optional)"><input value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder="apple" style={inputStyle} /></Field></div>
        </div>

        <Field label="The story (optional)">
          <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={2} placeholder="When do they say it? Why does it matter?"
            style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }} />
        </Field>

        {/* record audio */}
        <button
          onClick={() => setRecorded((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", cursor: "pointer",
            border: `1.5px solid ${recorded ? "var(--blue-200)" : "var(--hairline-2)"}`,
            background: recorded ? "var(--blue-50)" : "var(--surface)", borderRadius: "var(--r-sm)",
            padding: "9px 12px", marginBottom: 12, fontFamily: "var(--font-sans)",
          }}
        >
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--blue-500)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <Icon name={recorded ? "check" : "mic"} size={15} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: recorded ? "var(--on-secondary-soft)" : "var(--ink)" }}>{recorded ? "Audio sample added · 0:03" : "Record their voice"}</span>
        </button>

        <label style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--ink-2)" }}>Add to a collection</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "6px 0 8px" }}>
          {collections.map((c) => (
            <Chip key={c} active={collection === c} icon="bookmark" onClick={() => setCollection(collection === c ? null : c)}>{c}</Chip>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid var(--hairline)", paddingTop: 10, marginTop: 4 }}>
          <Icon name="lock" size={13} color="var(--ink-3)" />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-3)" }}>Only you, unless you share this dictionary</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Compose });
