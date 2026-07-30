/* global React, Icon, Button, Chip, MediaChips, MediaAttach, UpgradeSheet, SpeakerPicker, window */
// Vocabu — Compose: a bottom sheet that rises over the blurred feed.
// Word/phrase first, then who said it; meaning / story / voice / collection as add-chips.

const { useState: useC, useEffect: useCE, useRef: useCR } = React;

const PREVIEW_WAVE = [.3,.55,.4,.7,.5,.85,.6,1,.7,.5,.8,.45,.65,.38,.72,.5,.9,.46,.6,.34,.55,.42,.78,.5,.3,.6,.44,.8];

const COMPOSE_COLLECTIONS = ["Mira's words", "Dad's wisdom", "Theo-isms", "Nonna's sayings"];

function ComposeField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 18 }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</label>
      {children}
    </div>
  );
}
const composeInput = {
  border: "1.5px solid var(--hairline-2)", outline: 0, background: "var(--surface)",
  borderRadius: "var(--r-sm)", padding: "13px 14px", fontFamily: "var(--font-sans)",
  fontSize: 16, color: "var(--ink)", width: "100%", boxSizing: "border-box",
};

function Compose({ open, onClose, onPost, plan = "free", picker = "by plan", speakers = [], onAddSpeaker, editing = null }) {
  // free → two affordances (voice + locked video); premium → one combined control.
  const mode = picker === "by plan" ? (plan === "premium" ? "combined" : "separate") : picker;
  const [word, setWord] = useC("");
  const [speakerId, setSpeakerId] = useC(null);
  const [gloss, setGloss] = useC("");
  const [story, setStory] = useC("");
  const [collection, setCollection] = useC(null);
  const [show, setShow] = useC({ meaning: false, story: false, collection: false });
  const [attach, setAttach] = useC(null); // null | "audio" | "video" | "media"
  const [media, setMedia] = useC(null);   // { kind, audio? , video? }
  const [upsell, setUpsell] = useC(false);
  const [wordFocus, setWordFocus] = useC(false);
  const [customColls, setCustomColls] = useC([]);
  const [creatingColl, setCreatingColl] = useC(false);
  const [newCollName, setNewCollName] = useC("");
  const ref = useCR(null);

  useCE(() => {
    if (open) {
      if (editing) {
        const st = editing.desc && editing.desc !== "you kept this just now." ? editing.desc : "";
        const med = editing.audio ? { kind: "audio", audio: editing.audio } : editing.video ? { kind: "video", video: editing.video } : null;
        setWord(editing.word); setSpeakerId(editing.sid || null); setGloss(editing.gloss || ""); setStory(st); setCollection(editing.collection || null);
        setShow({ meaning: !!editing.gloss, story: !!st, collection: !!editing.collection });
        setMedia(med); setAttach(med ? (mode === "combined" ? "media" : med.kind) : null); setUpsell(false);
      } else {
        setWord(""); setSpeakerId(null); setGloss(""); setStory(""); setCollection(null);
        setShow({ meaning: false, story: false, collection: false });
        setAttach(null); setMedia(null); setUpsell(false);
      }
      setCustomColls([]); setCreatingColl(false); setNewCollName("");
      setTimeout(() => ref.current && ref.current.focus(), 280);
    }
  }, [open]);

  const reveal = (k) => setShow((s) => ({ ...s, [k]: true }));
  const addCollection = () => {
    const n = newCollName.trim();
    if (!n) { setCreatingColl(false); return; }
    if (![...COMPOSE_COLLECTIONS, ...customColls].includes(n)) setCustomColls((a) => [...a, n]);
    setCollection(n); setNewCollName(""); setCreatingColl(false);
  };
  const canPost = word.trim().length > 0;

  return (
    <div aria-hidden={!open} style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: open ? "auto" : "none" }}>
      {/* blurred scrim over the feed */}
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "var(--scrim)",
        backdropFilter: open ? "blur(5px)" : "blur(0px)", WebkitBackdropFilter: open ? "blur(5px)" : "blur(0px)",
        opacity: open ? 1 : 0, transition: "opacity var(--dur-base) var(--ease-out), backdrop-filter var(--dur-base)",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column",
        background: "var(--surface)", borderTopLeftRadius: "var(--r-xl)", borderTopRightRadius: "var(--r-xl)",
        boxShadow: "var(--shadow-lg)", maxHeight: "94%",
        transform: open ? "translateY(0)" : "translateY(110%)", transition: "transform var(--dur-slow) var(--ease-out)",
      }}>
        {/* header */}
        <div style={{ flex: "0 0 auto", padding: "10px 18px 14px", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--hairline-2)", margin: "0 auto 14px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={onClose} style={{ border: 0, background: "transparent", color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, cursor: "pointer", padding: "8px 4px" }}>cancel</button>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--ink)", whiteSpace: "nowrap" }}>{editing ? "Edit word" : "New word"}</span>
            <span style={{ width: 52 }} />
          </div>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px 16px" }}>
          {/* the word / phrase — first, big, rose underline */}
          <input ref={ref} value={word} onChange={(e) => setWord(e.target.value)}
            onFocus={() => setWordFocus(true)} onBlur={() => setWordFocus(false)}
            placeholder="the word or phrase"
            style={{
              width: "100%", boxSizing: "border-box", border: 0, outline: 0, background: "transparent",
              borderBottom: `2px solid ${wordFocus || word ? "var(--primary)" : "var(--hairline-2)"}`,
              padding: "6px 2px 12px", fontFamily: "var(--font-sans)", fontSize: 30, fontWeight: 700,
              letterSpacing: "-0.02em", color: "var(--ink)", transition: "border-color var(--dur-fast)",
            }} />

          <ComposeField label="Who said it">
            <SpeakerPicker speakers={speakers} value={speakerId} onChange={setSpeakerId} onCreate={onAddSpeaker} />
          </ComposeField>

          {/* revealed optional fields */}
          {show.meaning && (
            <ComposeField label="Meaning">
              <input value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder="watermelon" style={composeInput} autoFocus />
            </ComposeField>
          )}
          {show.story && (
            <ComposeField label="Story">
              <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={3} placeholder="when do they say it? why does it matter?"
                style={{ ...composeInput, resize: "none", lineHeight: 1.5 }} autoFocus />
            </ComposeField>
          )}
          {attach && (
            <MediaAttach accept={attach} plan={plan} media={media}
              onDone={(m) => setMedia(m)} onRemove={() => setMedia(null)} onUpsell={() => setUpsell(true)} />
          )}
          {show.collection && (
            <ComposeField label="Collection">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {[...COMPOSE_COLLECTIONS, ...customColls].map((c) => (
                  <Chip key={c} active={collection === c} icon="bookmark" onClick={() => setCollection(collection === c ? null : c)}>{c}</Chip>
                ))}
                {!creatingColl && (
                  <Chip icon="plus" onClick={() => setCreatingColl(true)}>new</Chip>
                )}
                {creatingColl && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input autoFocus value={newCollName}
                      onChange={(e) => setNewCollName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCollection(); } if (e.key === "Escape") { setCreatingColl(false); setNewCollName(""); } }}
                      placeholder="name it…"
                      style={{
                        border: "1.5px solid var(--primary)", outline: 0, background: "var(--surface)",
                        borderRadius: "var(--r-sm)", padding: "8px 12px", fontFamily: "var(--font-sans)",
                        fontSize: 14, fontWeight: 600, color: "var(--ink)", width: 150, boxSizing: "border-box", minHeight: 38,
                      }} />
                    <button onClick={addCollection}
                      style={{
                        border: 0, background: newCollName.trim() ? "var(--primary)" : "var(--surface-sunk)",
                        color: newCollName.trim() ? "var(--text-on-accent)" : "var(--ink-3)",
                        borderRadius: "var(--r-sm)", padding: "8px 12px", fontFamily: "var(--font-sans)",
                        fontSize: 13.5, fontWeight: 600, cursor: "pointer", minHeight: 38,
                        transition: "background var(--dur-fast), color var(--dur-fast)",
                      }}>add</button>
                  </div>
                )}
              </div>
            </ComposeField>
          )}

          {/* add-chips */}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--ink-3)", marginBottom: 10 }}>add the rest whenever you like —</div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {!show.meaning && <Chip icon="plus" onClick={() => reveal("meaning")}>meaning</Chip>}
              {!show.story && <Chip icon="plus" onClick={() => reveal("story")}>story</Chip>}
              <MediaChips mode={mode} plan={plan} attach={attach} media={media}
                onOpen={(m) => setAttach(m)} onClose={() => setAttach(null)} onLocked={() => setUpsell(true)} />
              {!show.collection && <Chip icon="plus" onClick={() => reveal("collection")}>collection</Chip>}
            </div>
          </div>
        </div>

        {/* keep it */}
        <div style={{ flex: "0 0 auto", padding: "12px 18px calc(14px + var(--safe-bottom))", borderTop: "1px solid var(--hairline)", background: "var(--surface)" }}>
          <Button full size="lg" disabled={!canPost}
            onClick={() => {
              if (!canPost) return;
              onPost({
                word: word.trim(), speakerId,
                gloss: gloss.trim() || null, story: story.trim(), collection,
                audio: media && media.kind === "audio" ? media.audio : null,
                video: media && media.kind === "video" ? media.video : null,
              });
            }}>
            {editing ? "Save changes" : "Keep it"}
          </Button>
        </div>
      </div>
      <UpgradeSheet open={upsell} onClose={() => setUpsell(false)} />
    </div>
  );
}

Object.assign(window, { Compose });
