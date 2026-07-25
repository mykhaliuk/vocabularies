/* global React, Icon, Button, AudioSample, window */
// Vocabu — media affordance (VKB-66 feed video card · VKB-67 compose picker).
// Rules: audio is for everyone; video is premium-gated and the SERVER is the gate —
// the UI never hides video, it presents the locked state honestly.
// Accent: blue = "media", so audio and video read as siblings; the poster frame
// itself stays neutral so imagery reads as content, not chrome.

const { useState: useM, useRef: useMR, useEffect: useME } = React;

const mReduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const VIDEO_EXT = /\.(mov|mp4|m4v|webm|mkv|3gp|3gpp)$/i;
const kindOf = (f) => (f && (/^video\//.test(f.type || "") || VIDEO_EXT.test(f.name || "")) ? "video" : "audio");
const waveOf = (name) => {
  const s = (name || "clip").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 32 }, (_, i) => 0.28 + Math.abs(Math.sin(s + i * 1.7)) * 0.72);
};
const secsOf = (dur) => { const [m, s] = String(dur || "0:00").split(":").map(Number); return m * 60 + s; };
const ACCEPT = {
  audio: "audio/*,.m4a,.mp3,.aac,.ogg,.wav,.amr,.3gp",
  video: "video/*,.mov,.mp4,.webm,.mkv,.3gp",
  media: "audio/*,video/*",
};

/* ── poster placeholder — neutral skeleton, real poster.jpg drops in here ── */
function Poster({ radius = "var(--r-sm)", shimmer, glyph = 14, dim }) {
  return (
    <div style={{
      position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden",
      background: "var(--surface-sunk)", display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid var(--hairline-2)", boxSizing: "border-box",
      color: "var(--ink-2)", opacity: dim ? 0.7 : 1,
    }}>
      {shimmer && !mReduce() && (
        <span style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(100deg, transparent 20%, color-mix(in oklch, var(--secondary) 14%, transparent) 50%, transparent 80%)",
          backgroundSize: "220% 100%", animation: "vshimmer 1.5s linear infinite",
        }} />
      )}
      <Icon name="video" size={glyph} />
    </div>
  );
}

/* ── feed / detail: the video moment. Collapsed it keeps the audio player's
   rhythm (play · strip · duration); tap opens a framed inline player. ── */
function VideoSample({ video, big, onRetry }) {
  const state = video.state || "ready";
  const [open, setOpen] = useM(false);
  const [playing, setPlaying] = useM(false);
  const secs = secsOf(video.dur);
  const portrait = (video.orientation || "portrait") === "portrait";
  const wrap = { width: "100%", maxWidth: big ? 360 : 320, margin: "0 auto" };
  const btn = big ? 44 : 36;

  useME(() => () => clearTimeout(window.__vocabuVidT), []);
  const play = () => {
    setPlaying(true);
    clearTimeout(window.__vocabuVidT);
    window.__vocabuVidT = setTimeout(() => setPlaying(false), secs * 1000);
  };
  const toggle = (e) => {
    e.stopPropagation();
    if (!open) { setOpen(true); play(); return; }
    if (playing) { setPlaying(false); clearTimeout(window.__vocabuVidT); } else play();
  };

  if (state === "processing") {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{
          width: btn, height: btn, borderRadius: "var(--r-sm)", flex: "0 0 auto",
          border: "1.5px solid var(--hairline-2)", color: "var(--ink-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="loader" size={big ? 17 : 15} style={{ animation: mReduce() ? "none" : "vspin 1.4s linear infinite" }} />
        </span>
        <div style={{ position: "relative", flex: 1, height: btn }}><Poster shimmer /></div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)", flex: "0 0 auto" }}>normalizing…</span>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div style={{
        ...wrap, display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box",
        background: "var(--danger-bg)", border: "1px solid color-mix(in oklch, var(--danger) 26%, transparent)",
        borderRadius: "var(--r-sm)", padding: "10px 10px 10px 12px",
      }}>
        <Icon name="alert-circle" size={17} color="var(--danger)" />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--ink-2)", flex: 1, lineHeight: 1.35 }}>
          {video.reason || "this video didn't make it through."}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onRetry && onRetry(); }}
          style={{
            border: 0, background: "transparent", cursor: "pointer", flex: "0 0 auto",
            display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 4px",
            fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--link)",
          }}>
          <Icon name="refresh-cw" size={14} /> try again
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div onClick={toggle} style={{ ...wrap, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", padding: "4px 0" }}>
        <button aria-label="play video"
          style={{
            width: btn, height: btn, borderRadius: "var(--r-sm)", flex: "0 0 auto",
            border: "1.5px solid var(--blue-300)", background: "transparent", color: "var(--secondary)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
          <Icon name="play" size={big ? 17 : 14} fill="currentColor" stroke={0} />
        </button>
        <div style={{ position: "relative", flex: 1, height: btn, borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <Poster glyph={big ? 17 : 15} />
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>{video.dur}</span>
      </div>
    );
  }

  const frameH = portrait ? (big ? 340 : 300) : (big ? 202 : 176);
  return (
    <div style={{ ...wrap, animation: mReduce() ? "none" : "vfadeup 220ms var(--ease-out)" }}>
      <div onClick={toggle} style={{
        position: "relative", height: frameH, borderRadius: "var(--r-card)", overflow: "hidden",
        cursor: "pointer", border: "1px solid var(--hairline-2)",
      }}>
        <Poster radius="0px" glyph={30} dim />
        <span style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "color-mix(in oklch, var(--ink) 62%, transparent)", color: "var(--paper)",
          opacity: playing ? 0 : 1, transition: "opacity var(--dur-base) var(--ease-out)",
        }}>
          <Icon name="play" size={22} fill="currentColor" stroke={0} />
        </span>
        <button aria-label="close video"
          onClick={(e) => { e.stopPropagation(); setPlaying(false); clearTimeout(window.__vocabuVidT); setOpen(false); }}
          style={{
            position: "absolute", top: 0, right: 0, width: 44, height: 44, border: 0, background: "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          }}>
          <span style={{
            width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "color-mix(in oklch, var(--ink) 46%, transparent)", color: "var(--paper)",
          }}>
            <Icon name="chevron-up" size={16} />
          </span>
        </button>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "color-mix(in oklch, var(--ink) 22%, transparent)" }}>
          <div style={{
            height: "100%", background: "var(--secondary)",
            width: playing ? "100%" : "0%",
            transition: playing ? `width ${secs}s linear` : "width 200ms var(--ease-out)",
          }} />
        </div>
      </div>
    </div>
  );
}

/* ── compose: the chip row (the affordance layer) ──
   free    → two chips: voice, and video as a visible locked carrot
   premium → one combined "voice or video" chip that infers kind from the file */
function MediaChips({ mode, plan, attach, media, onOpen, onClose, onLocked }) {
  const [pressed, setPressed] = useM(null);
  const chip = (key, { icon, label, tone, active, locked, onClick }) => {
    const on = active
      ? (tone === "blue"
        ? { bg: "var(--secondary-soft)", bd: "var(--blue-200)", fg: "var(--on-secondary-soft)" }
        : { bg: "var(--primary-soft)", bd: "var(--primary-soft-border)", fg: "var(--on-primary-soft)" })
      : locked
        ? { bg: "var(--surface-sunk)", bd: "var(--hairline)", fg: "var(--ink-2)" }
        : { bg: "var(--surface)", bd: "var(--hairline-2)", fg: "var(--ink-2)" };
    return (
      <button key={key} onClick={onClick}
        onPointerDown={() => setPressed(key)} onPointerUp={() => setPressed(null)} onPointerLeave={() => setPressed(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)",
          fontSize: 13.5, fontWeight: 600, padding: "8px 13px", borderRadius: "var(--r-sm)",
          background: on.bg, border: `1.5px solid ${on.bd}`, color: on.fg, cursor: "pointer",
          whiteSpace: "nowrap", minHeight: 38, transform: pressed === key ? "scale(0.97)" : "scale(1)",
          transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast)",
        }}>
        <Icon name={icon} size={15} />
        {label}
        {locked && <Icon name="lock" size={13} color="var(--ink-3)" />}
      </button>
    );
  };

  const openOr = (m) => (attach === m ? onClose() : onOpen(m));
  const hasAudio = media && media.kind === "audio";
  const hasVideo = media && media.kind === "video";

  if (mode === "combined") {
    const locked = plan !== "premium";
    return chip("media", {
      icon: media ? "check" : "paperclip", tone: "blue",
      label: media ? (hasVideo ? "video kept" : "voice kept") : "voice or video",
      active: !!attach || !!media, locked: locked && !media,
      onClick: () => openOr(locked ? "audio" : "media"),
    });
  }
  return (
    <>
      {chip("audio", {
        icon: hasAudio ? "check" : "mic", tone: "blue", label: "voice",
        active: attach === "audio" || hasAudio, onClick: () => openOr("audio"),
      })}
      {plan === "premium"
        ? chip("video", {
          icon: hasVideo ? "check" : "video", tone: "blue", label: "video",
          active: attach === "video" || hasVideo, onClick: () => openOr("video"),
        })
        : chip("video-locked", { icon: "video", label: "video", locked: true, onClick: onLocked })}
    </>
  );
}

/* ── compose: the attach panel — one state machine for both kinds ──
   idle → uploading(%) → processing → ready | failed(retry) */
function MediaAttach({ accept = "audio", plan = "free", media, onDone, onRemove, onUpsell }) {
  const [phase, setPhase] = useM(media ? "ready" : "idle");
  const [progress, setProgress] = useM(0);
  const [file, setFile] = useM(null);
  const [kind, setKind] = useM(media ? media.kind : "audio");
  const [fail, setFail] = useM(null);
  const [dragging, setDragging] = useM(false);
  const raf = useMR(null), input = useMR(null);

  useME(() => () => cancelAnimationFrame(raf.current), []);

  const run = (f) => {
    const k = kindOf(f);
    setFile(f.name || "clip"); setKind(k); setFail(null); setProgress(0); setPhase("uploading");
    const t0 = Date.now(), span = mReduce() ? 500 : 1250;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / span);
      setProgress(p);
      if (p < 1) { raf.current = requestAnimationFrame(tick); return; }
      // the server is the gate: a video smuggled past an audio-only picker is
      // caught after the probe and comes back 403 / failed.
      if (k === "video" && plan !== "premium") {
        setPhase("failed"); setFail({ premium: true, msg: "video moments need premium." });
        return;
      }
      setPhase("processing");
      setTimeout(() => {
        const payload = k === "video"
          ? { kind: "video", video: { dur: "0:11", orientation: "portrait" } }
          : { kind: "audio", audio: { dur: "0:05", wave: waveOf(f.name) } };
        setPhase("ready"); onDone(payload);
      }, mReduce() ? 300 : 800);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const pick = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) run(f); };
  const drop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) run(f); };
  const reset = () => { setPhase("idle"); setFile(null); setFail(null); onRemove && onRemove(); };

  const copy = {
    audio: { title: "upload a voice clip", hint: "their actual voice — up to 3 minutes" },
    video: { title: "upload a video moment", hint: "up to 20 seconds — mp4, mov or webm" },
    media: { title: "upload a voice clip or a video", hint: "audio up to 3 min · video up to 20 s" },
  }[accept];

  return (
    <div style={{
      marginTop: 14, background: "var(--secondary-soft)", border: "1px solid var(--blue-100)",
      borderRadius: "var(--r-md)", padding: 16, overflow: "hidden",
      animation: mReduce() ? "none" : "vfadeup 260ms var(--ease-out)",
    }}>
      {phase === "idle" && (
        <>
          <div onClick={() => input.current && input.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)} onDrop={drop}
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
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{copy.title}</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>{copy.hint}</div>
            <input ref={input} type="file" accept={ACCEPT[accept]} onChange={pick} style={{ display: "none" }} />
          </div>
          {accept === "audio" && plan !== "premium" && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12 }}>
              <Icon name="lock" size={13} color="var(--ink-3)" />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)" }}>video moments are premium.</span>
              <button onClick={onUpsell}
                style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", padding: "6px 2px", minHeight: 36, fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, color: "var(--link)", whiteSpace: "nowrap" }}>
                see premium
              </button>
            </div>
          )}
        </>
      )}

      {(phase === "uploading" || phase === "processing") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name={phase === "uploading" ? "upload" : "loader"} size={15} color="var(--secondary)"
              style={phase === "processing" && !mReduce() ? { animation: "vspin 1.4s linear infinite" } : undefined} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {phase === "uploading" ? `uploading ${file}…` : "normalizing…"}
            </span>
            {phase === "uploading" && (
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--secondary)", fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }}>
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          {kind === "video"
            ? (
              <div style={{ position: "relative", height: 64, borderRadius: "var(--r-sm)", overflow: "hidden" }}>
                <Poster shimmer={phase === "processing"} glyph={20} />
                {phase === "uploading" && (
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "var(--blue-100)" }}>
                    <div style={{ height: "100%", width: `${progress * 100}%`, background: "var(--secondary)" }} />
                  </div>
                )}
              </div>
            )
            : (
              <div style={{ display: "flex", alignItems: "center", gap: 3, height: 52 }}>
                {waveOf(file).map((h, i) => {
                  const lit = phase === "processing" || i / 32 <= progress;
                  return <span key={i} style={{
                    flex: 1, minWidth: 2, borderRadius: 3, height: `${14 + h * 86}%`,
                    background: lit ? "var(--secondary)" : "var(--blue-200)", transition: "background 120ms linear",
                  }} />;
                })}
              </div>
            )}
        </div>
      )}

      {phase === "failed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <Icon name="alert-circle" size={17} color="var(--danger)" style={{ marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {fail && fail.premium ? "that one's a video." : "couldn't upload that."}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45, marginTop: 3 }}>
                {fail && fail.premium ? "video moments are part of premium — the voice clip path is always open." : "the connection dropped. nothing was lost."}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {fail && fail.premium
              ? <Button size="sm" variant="blue" icon="lock" onClick={onUpsell}>see premium</Button>
              : <Button size="sm" variant="blue" icon="refresh-cw" onClick={() => file && run({ name: file, type: kind + "/x" })}>try again</Button>}
            <Button size="sm" variant="secondary" onClick={reset}>choose another</Button>
          </div>
        </div>
      )}

      {phase === "ready" && media && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: mReduce() ? "none" : "vfadeup 240ms var(--ease-out)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", background: "var(--secondary)", color: "var(--text-on-accent)",
              display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto",
              animation: mReduce() ? "none" : "vpop 280ms var(--ease-out)",
            }}>
              <Icon name="check" size={12} stroke={3} />
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)" }}>
              {media.kind === "video" ? "video kept" : "voice kept"}
            </span>
            <button onClick={reset}
              style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 4px", minHeight: 36, whiteSpace: "nowrap" }}>
              <Icon name="repeat" size={14} /> replace
            </button>
          </div>
          {media.kind === "video" ? <VideoSample video={media.video} /> : <AudioSample audio={media.audio} />}
        </div>
      )}
    </div>
  );
}

/* ── the carrot: a small sheet, gentle but explicit, one CTA ── */
function UpgradeSheet({ open, onClose }) {
  return (
    <div aria-hidden={!open} style={{ position: "absolute", inset: 0, zIndex: 80, pointerEvents: open ? "auto" : "none" }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, background: "var(--scrim)",
        opacity: open ? 1 : 0, transition: "opacity var(--dur-base) var(--ease-out)",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)",
        borderTopLeftRadius: "var(--r-xl)", borderTopRightRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)",
        padding: "26px 22px calc(18px + var(--safe-bottom))", textAlign: "center",
        transform: open ? "translateY(0)" : "translateY(110%)", transition: "transform var(--dur-slow) var(--ease-out)",
      }}>
        <span style={{
          width: 54, height: 54, borderRadius: "50%", background: "var(--primary-soft)",
          border: "1px solid var(--primary-soft-border)", color: "var(--primary)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          <Icon name="video" size={24} />
        </span>
        <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          video moments are premium.
        </h3>
        <p style={{ margin: "9px auto 0", maxWidth: 285, fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.5, color: "var(--ink-2)" }}>
          voice is always yours. premium adds up to 20 seconds of video — their face, not only their words.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 20 }}>
          <Button full size="lg" onClick={onClose}>See premium</Button>
          <button onClick={onClose}
            style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14.5, fontWeight: 600, color: "var(--ink-3)", padding: "12px 4px", minHeight: 44 }}>
            not now
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VideoSample, MediaChips, MediaAttach, UpgradeSheet, mediaKindOf: kindOf });
