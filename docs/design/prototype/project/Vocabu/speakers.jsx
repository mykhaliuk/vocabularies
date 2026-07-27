/* global React, Icon, Avatar, Button, Chip, window */
// Vocabu — speakers as first-class people.
// Created inline in compose (same select/＋add mechanic as collections), managed under "my dictionary".

const { useState: useSp, useEffect: useSpE, useRef: useSpR } = React;

const REL_SUGGESTIONS = ["my daughter", "my son", "my dad", "my mum", "best friend", "my partner", "grandma"];
const SPEAKER_TONES = ["rose", "blue", "ink"];

const spInput = {
  border: "1.5px solid var(--hairline-2)", outline: 0, background: "var(--surface)",
  borderRadius: "var(--r-sm)", padding: "12px 13px", fontFamily: "var(--font-sans)",
  fontSize: 16, color: "var(--ink)", width: "100%", boxSizing: "border-box", colorScheme: "light dark",
};
const spLabel = { fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)" };
const spHint = { fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.4 };

function blankSpeaker(count) {
  return { name: "", rel: "", birthday: "", tone: SPEAKER_TONES[count % SPEAKER_TONES.length] };
}

/* ---------- the shared form: name required, relation + birthday optional ---------- */
function SpeakerForm({ draft, onChange, autoFocus }) {
  const set = (k, v) => onChange({ ...draft, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={spLabel}>Name</label>
        <input autoFocus={autoFocus} value={draft.name} onChange={(e) => set("name", e.target.value)}
          placeholder="Mira" style={spInput} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={spLabel}>Relation <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-3)" }}>— optional</span></label>
        <input value={draft.rel} onChange={(e) => set("rel", e.target.value)} placeholder="my daughter" style={spInput} />
        {!draft.rel && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
            {REL_SUGGESTIONS.slice(0, 5).map((r) => (
              <Chip key={r} onClick={() => set("rel", r)}>{r}</Chip>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={spLabel}>Birthday <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-3)" }}>— optional</span></label>
        <input type="date" value={draft.birthday || ""} onChange={(e) => set("birthday", e.target.value)} style={spInput} />
        <div style={spHint}>{draft.birthday
          ? <>they're <b style={{ color: "var(--ink-2)", fontWeight: 600 }}>{window.vocabuAge(draft.birthday) || "—"}</b> today. every word remembers the age they were when you kept it.</>
          : "add it and each word remembers how old they were."}</div>
      </div>
    </div>
  );
}

/* ---------- compose: chip row of people + inline ＋new ---------- */
function SpeakerPicker({ speakers, value, onChange, onCreate }) {
  const [creating, setCreating] = useSp(false);
  const [draft, setDraft] = useSp(() => blankSpeaker(speakers.length));

  const start = () => { setDraft(blankSpeaker(speakers.length)); setCreating(true); };
  const add = () => {
    const name = draft.name.trim();
    if (!name) return;
    const sp = { id: "s" + Date.now(), name, rel: draft.rel.trim() || null, birthday: draft.birthday || null, tone: draft.tone };
    onCreate(sp); onChange(sp.id); setCreating(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {speakers.map((s) => (
          <Chip key={s.id} active={value === s.id} icon={value === s.id ? "check" : null}
            onClick={() => onChange(value === s.id ? null : s.id)}>{s.name}</Chip>
        ))}
        {!creating && <Chip icon="plus" onClick={start}>someone new</Chip>}
      </div>
      {creating && (
        <div style={{ border: "1.5px solid var(--primary-soft-border)", background: "var(--primary-soft)", borderRadius: "var(--r-md)", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <SpeakerForm draft={draft} onChange={setDraft} autoFocus />
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" variant="primary" disabled={!draft.name.trim()} onClick={add}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- edit sheet ---------- */
function SpeakerSheet({ speaker, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useSp(() => ({ name: speaker.name, rel: speaker.rel || "", birthday: speaker.birthday || "", tone: speaker.tone }));
  const [confirm, setConfirm] = useSp(false);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 90 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "var(--scrim)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)",
        borderTopLeftRadius: "var(--r-xl)", borderTopRightRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)",
        padding: "10px 18px calc(16px + var(--safe-bottom))", maxHeight: "92%", overflowY: "auto",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--hairline-2)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Avatar name={draft.name || speaker.name} tone={speaker.tone} size={44} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            {speaker.name}
          </div>
        </div>
        <SpeakerForm draft={draft} onChange={setDraft} />
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Button full variant="primary" disabled={!draft.name.trim()}
            onClick={() => onSave({ ...speaker, name: draft.name.trim(), rel: draft.rel.trim() || null, birthday: draft.birthday || null })}>Save</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
        {onDelete && (
          <button onClick={() => (confirm ? onDelete(speaker) : setConfirm(true))} style={{ width: "100%", marginTop: 14, border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: confirm ? 600 : 400, color: confirm ? "var(--danger)" : "var(--ink-3)", padding: 10 }}>
            {confirm ? "yes, remove" : "remove from your people"}
          </button>
        )}
        {confirm && <div style={{ ...spHint, textAlign: "center", marginTop: -4 }}>their words stay — they just lose the relation and age.</div>}
      </div>
    </div>
  );
}

/* ---------- People screen — the manager, under "my dictionary" ---------- */
function PeopleScreen({ speakers, entries, onBack, onSave, onCreate, onDelete }) {
  const [editing, setEditing] = useSp(null);
  const [adding, setAdding] = useSp(false);
  const [draft, setDraft] = useSp(() => blankSpeaker(speakers.length));

  // seeded speakers carry their archive count; anything kept this session adds to it.
  const count = (s) => {
    const fresh = entries.filter((e) => e.sid === s.id && !e.band && String(e.id).charAt(0) === "n").length;
    return s.words != null ? s.words + fresh : entries.filter((e) => e.sid === s.id && !e.band).length;
  };
  const startAdd = () => { setDraft(blankSpeaker(speakers.length)); setAdding(true); };
  const commitAdd = () => {
    const name = draft.name.trim();
    if (!name) return;
    onCreate({ id: "s" + Date.now(), name, rel: draft.rel.trim() || null, birthday: draft.birthday || null, tone: draft.tone });
    setAdding(false);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, background: "var(--paper)", overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", background: "var(--bar-bg)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hairline)" }}>
        <button onClick={onBack} style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="chevron-left" size={22} />
        </button>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>your people</h1>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ padding: "14px 16px calc(var(--bottom-nav-h) + 40px)" }}>
        <p style={{ ...spHint, margin: "0 0 16px", maxWidth: 300 }}>
          everyone whose words you keep. add a birthday and every word remembers how old they were.
        </p>

        <div style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", background: "var(--surface)", overflow: "hidden" }}>
          {speakers.map((s, i) => {
            const age = window.vocabuAge(s.birthday);
            return (
              <React.Fragment key={s.id}>
                {i > 0 && <div style={{ height: 1, background: "var(--hairline)", marginLeft: 62 }} />}
                <button onClick={() => setEditing(s)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: 0, background: "transparent", cursor: "pointer", textAlign: "left", minHeight: 44 }}>
                  <Avatar name={s.name} tone={s.tone} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[s.rel, age].filter(Boolean).join(" · ") || "no relation yet"}
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{count(s)} {count(s) === 1 ? "word" : "words"}</span>
                  <Icon name="chevron-right" size={17} color="var(--ink-3)" />
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {!adding ? (
          <div style={{ marginTop: 16 }}>
            <Button full variant="ghost" icon="plus" onClick={startAdd}>Add someone</Button>
          </div>
        ) : (
          <div style={{ marginTop: 16, border: "1.5px solid var(--primary-soft-border)", background: "var(--primary-soft)", borderRadius: "var(--r-md)", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <SpeakerForm draft={draft} onChange={setDraft} autoFocus />
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" variant="primary" disabled={!draft.name.trim()} onClick={commitAdd}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <SpeakerSheet speaker={editing} onClose={() => setEditing(null)}
          onSave={(sp) => { onSave(sp); setEditing(null); }}
          onDelete={onDelete && ((sp) => { onDelete(sp); setEditing(null); })} />
      )}
    </div>
  );
}

Object.assign(window, { SpeakerPicker, SpeakerForm, SpeakerSheet, PeopleScreen });
