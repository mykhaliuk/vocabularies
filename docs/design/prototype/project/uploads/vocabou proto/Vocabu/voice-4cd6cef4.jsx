/* global React, Icon, AudioSample, window */
// Vocabu — voice sample (v0): upload a clip, with a gentle processing animation,
// then an inline player. Audio = blue (DS). (Live recording deferred past v0.)

const { useState: useV, useRef: useVR, useEffect: useVE } = React;

const VOICE_FALLBACK = [.3,.55,.4,.7,.5,.85,.6,1,.7,.5,.8,.45,.65,.38,.72,.5,.9,.46,.6,.34,.55,.42,.78,.5,.3,.6,.44,.8,.5,.66,.4,.58];
const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* processing sweep — bars light up blue left→right as the clip uploads */
function ProcessingBars({ wave, progress }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 52, width: "100%" }}>
      {wave.map((h, i) => {
        const lit = i / wave.length <= progress;
        const leading = Math.abs(i / wave.length - progress) < 0.06;
        return (
          <span key={i}
            style={{
              flex: 1, minWidth: 2, borderRadius: 3, height: `${14 + h * 86}%`,
              background: lit ? "var(--secondary)" : "var(--blue-200)",
              transform: leading ? "scaleY(1.12)" : "scaleY(1)",
              transition: "background 120ms linear, transform 120ms var(--ease-out)",
            }} />
        );
      })}
    </div>
  );
}

function waveFromName(name) {
  const seed = (name || "voice").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 32 }, (_, i) => 0.28 + Math.abs(Math.sin(seed + i * 1.7)) * 0.72);
}

function VoiceRecorder({ existing, onDone, onRemove }) {
  const [phase, setPhase] = useV(existing ? "done" : "idle"); // idle | processing | done
  const [progress, setProgress] = useV(0);
  const [audio, setAudio] = useV(existing || null);
  const [fileName, setFileName] = useV("");
  const [dragging, setDragging] = useV(false);
  const rafRef = useVR(null), fileRef = useVR(null);

  useVE(() => () => cancelAnimationFrame(rafRef.current), []);

  const runProcessing = (wave, dur, name) => {
    setFileName(name); setPhase("processing"); setProgress(0);
    const start = Date.now(), span = reduceMotion() ? 650 : 1500;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / span);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else { const a = { dur, wave }; setAudio(a); setPhase("done"); onDone(a); }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleFile = (f) => {
    if (!f) return;
    runProcessing(waveFromName(f.name), "0:05", f.name || "voice clip");
  };
  const onPick = (e) => { handleFile(e.target.files && e.target.files[0]); e.target.value = ""; };
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  };
  const reset = () => { setAudio(null); setFileName(""); setPhase("idle"); onRemove && onRemove(); };

  const panel = {
    marginTop: 14, background: "var(--secondary-soft)", border: "1px solid var(--blue-100)",
    borderRadius: "var(--r-md)", padding: 16, overflow: "hidden",
    animation: reduceMotion() ? "none" : "vfadeup 260ms var(--ease-out)",
  };

  return (
    <div style={panel}>
      {phase === "idle" && (
        <div
          onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer",
            border: `1.5px dashed ${dragging ? "var(--secondary)" : "var(--blue-200)"}`,
            background: dragging ? "var(--secondary-soft)" : "transparent",
            borderRadius: "var(--r-sm)", padding: "22px 16px", textAlign: "center",
            transition: "border-color var(--dur-fast), background var(--dur-fast)",
          }}>
          <span style={{
            width: 48, height: 48, borderRadius: "50%", background: "var(--secondary)", color: "var(--text-on-accent)",
            display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
            boxShadow: "0 6px 18px color-mix(in oklch, var(--blue-500) 34%, transparent)",
          }}>
            <Icon name="upload" size={22} />
          </span>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>upload a voice clip</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>their actual voice — mp3, m4a or wav</div>
          <input ref={fileRef} type="file" accept="audio/*" onChange={onPick} style={{ display: "none" }} />
        </div>
      )}

      {phase === "processing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="upload" size={15} color="var(--secondary)" />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              uploading {fileName}…
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--secondary)", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>{Math.round(progress * 100)}%</span>
          </div>
          <ProcessingBars wave={audio ? audio.wave : waveFromName(fileName)} progress={progress} />
        </div>
      )}

      {phase === "done" && audio && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: reduceMotion() ? "none" : "vfadeup 240ms var(--ease-out)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--secondary)", color: "var(--text-on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", animation: reduceMotion() ? "none" : "vpop 280ms var(--ease-out)" }}>
              <Icon name="check" size={12} stroke={3} />
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>voice kept</span>
            <button onClick={reset}
              style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 4px", minHeight: 36, whiteSpace: "nowrap" }}>
              <Icon name="repeat" size={14} /> replace
            </button>
          </div>
          <AudioSample audio={audio} />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { VoiceRecorder });
