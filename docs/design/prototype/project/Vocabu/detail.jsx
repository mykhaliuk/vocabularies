/* global React, Icon, Avatar, IconButton, Button, TopBar, WordText, AudioSample, VideoSample, SocialRow, window */
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

/* when it was said. Defaults to the day it was kept; correctable here, because a wrong
   date silently mis-ages the memory and this is the only place to notice it. */
function SaidAt({ m, onChange }) {
  const [editing, setEditing] = useD(false);
  const at = window.vocabuSpokenAt(m);
  const sp = window.vocabuSpeaker(m);
  const age = sp && window.vocabuAge(sp.birthday, at);
  if (!at) return null;
  const row = { display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 16 }}>
      {!editing ? (
        <button onClick={() => onChange && setEditing(true)} style={{ ...row, border: 0, background: "transparent", cursor: onChange ? "pointer" : "default", padding: "8px 6px", minHeight: 40 }}>
          <Icon name="calendar" size={13} />
          said {window.vocabuDate(at)}{age ? " · " + age : ""}
          {onChange && <span style={{ color: "var(--link)", fontWeight: 600 }}>edit</span>}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <input type="date" defaultValue={at} onChange={(e) => e.target.value && onChange(m, e.target.value)}
            style={{ border: "1.5px solid var(--primary)", outline: 0, background: "var(--surface)", borderRadius: "var(--r-sm)", padding: "10px 12px", fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink)", colorScheme: "light dark", minHeight: 44 }} />
          <div style={{ ...row, maxWidth: 260, textAlign: "center", lineHeight: 1.4, display: "block" }}>
            {age ? <>they were <b style={{ color: "var(--ink-2)", fontWeight: 600 }}>{age}</b>. this is what the word will always say.</> : "the day they said it, not the day you filed it."}
          </div>
          <button onClick={() => setEditing(false)} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--link)", padding: "8px 12px", minHeight: 40 }}>done</button>
        </div>
      )}
    </div>
  );
}

/* overflow menu — edit/delete live here because they're rare; the bar stays quiet. */
function EntryMenu({ open, onClose, onEdit, onDelete }) {
  if (!open) return null;
  const item = (icon, label, color, fn) => (
    <button onClick={fn} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, background: "transparent", cursor: "pointer", padding: "13px 18px 13px 16px", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color, minHeight: 46, whiteSpace: "nowrap" }}>
      <Icon name={icon} size={17} color={color} />{label}
    </button>
  );
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 70 }} />
      <div style={{ position: "absolute", top: 52, right: 10, zIndex: 71, minWidth: 176, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
        {item("pencil", "edit word", "var(--ink)", onEdit)}
        <div style={{ height: 1, background: "var(--hairline)" }} />
        {item("trash-2", "delete\u2026", "var(--danger)", onDelete)}
      </div>
    </>
  );
}

/* delete confirm — a small sheet, gentle but honest about what's lost. */
function DeleteConfirm({ m, onCancel, onConfirm }) {
  const lost = [m.desc && "its story", m.audio && "the voice", m.video && "the video"].filter(Boolean);
  const lostLine = lost.length ? ` ${lost[0][0].toUpperCase()}${lost[0].slice(1)}${lost.length > 1 ? " and " + lost.slice(1).join(" and ") : ""} go${lost.length === 1 ? "es" : ""} with it.` : "";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "var(--scrim)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderTopLeftRadius: "var(--r-xl)", borderTopRightRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)", padding: "14px 20px calc(18px + var(--safe-bottom))", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--hairline-2)", marginBottom: 18 }} />
        <div style={{ fontFamily: "var(--word-font)", fontSize: "calc(26px * var(--word-scale))", fontWeight: "var(--word-weight)", lineHeight: "var(--word-leading)", color: "var(--ink)", paddingBottom: "var(--word-pad-b)" }}>“{m.word}”</div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)", margin: "10px 0 0", maxWidth: 280 }}>
          Let this one go?{lostLine} There's no getting it back.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 22 }}>
          <Button full size="lg" style={{ background: "var(--danger)", boxShadow: "none" }} onClick={onConfirm}>Delete word</Button>
          <Button full size="lg" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function DetailScreen({ m, onBack, media, onSaidAt, onEdit, onDelete, actions = "menu" }) {
  const [liked, setLiked] = useD(m.liked);
  const [likes, setLikes] = useD(m.likes);
  const [saved, setSaved] = useD(m.saved);
  const [pop, setPop] = useD(false);
  const [open, setOpen] = useD(true);
  const [menuOpen, setMenuOpen] = useD(false);
  const [confirm, setConfirm] = useD(false);
  const replies = (window.VOCABU_REPLIES && window.VOCABU_REPLIES[m.id]) || [];

  const toggleLike = () => setLiked((v) => {
    const nv = !v; setLikes((c) => c + (nv ? 1 : -1));
    if (nv) { setPop(true); setTimeout(() => setPop(false), 280); }
    return nv;
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <TopBar title="word" onBack={onBack}
        right={onEdit && actions === "icons" ? (
          <div style={{ display: "flex" }}>
            <IconButton name="pencil" iconSize={19} title="edit" onClick={() => onEdit(m)} />
            <IconButton name="trash-2" iconSize={19} title="delete" color="var(--danger)" onClick={() => setConfirm(true)} />
          </div>
        ) : undefined}
        rightIcon={onEdit && actions === "menu" ? "more-horizontal" : undefined}
        onRight={onEdit && actions === "menu" ? () => setMenuOpen(true) : undefined} />
      <EntryMenu open={menuOpen} onClose={() => setMenuOpen(false)}
        onEdit={() => { setMenuOpen(false); onEdit(m); }}
        onDelete={() => { setMenuOpen(false); setConfirm(true); }} />
      {confirm && <DeleteConfirm m={m} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete(m); }} />}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 120px" }}>
        {/* the entry */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0 8px", textAlign: "center" }}>
          <Avatar name={m.speaker} tone={m.tone} size={52} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.3, marginTop: -4, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>{m.speaker}</span>
            {window.vocabuRel(m) && <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {window.vocabuRel(m)}</span>}
          </div>
          <WordText word={m.word} />
          {m.gloss && <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontStyle: "italic", color: "var(--ink-2)", marginTop: -6 }}>{m.gloss}</div>}
          {m.audio && <div style={{ width: "100%", marginTop: 6 }}><AudioSample audio={m.audio} big /></div>}
          {m.video && <div style={{ width: "100%", marginTop: 6 }}><VideoSample video={{ ...m.video, ...(media || {}) }} big /></div>}
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

        <SaidAt m={m} onChange={onSaidAt} />

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
