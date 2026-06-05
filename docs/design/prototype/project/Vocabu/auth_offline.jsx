/* global React, Icon, Button, window */
// Vocabu — magic-link login + a gentle offline page.

const { useState: useA, useEffect: useAE } = React;

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const aReduce = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- LOGIN (magic link) ---------------- */
function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useA("");
  const [phase, setPhase] = useA("enter"); // enter | sent
  const [focus, setFocus] = useA(false);
  const ok = validEmail(email);

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 90, background: "var(--paper)",
      display: "flex", flexDirection: "column", padding: "0 28px",
    }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 360, width: "100%", margin: "0 auto" }}>
        {phase === "enter" && (
          <div style={{ animation: aReduce() ? "none" : "vfadeup 320ms var(--ease-out)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 34 }}>
              <img src="assets/logo-mark.svg" alt="" width="56" height="56" style={{ borderRadius: 14, marginBottom: 18 }} />
              <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)" }}>Vocabu</h1>
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.5 }}>
                never lose your sweet moments.
              </p>
            </div>

            <label style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 7 }}>your email</label>
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
              onKeyDown={(e) => { if (e.key === "Enter" && ok) setPhase("sent"); }}
              type="email" inputMode="email" autoComplete="email" placeholder="you@email.com"
              style={{
                width: "100%", boxSizing: "border-box", fontFamily: "var(--font-sans)", fontSize: 16,
                color: "var(--ink)", background: "var(--surface)", borderRadius: "var(--r-sm)",
                padding: "14px 15px", outline: "none",
                border: `1.5px solid ${focus ? "var(--primary)" : "var(--hairline-2)"}`,
                boxShadow: focus ? "0 0 0 3px var(--primary-soft)" : "none",
                transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
              }} />

            <div style={{ marginTop: 16 }}>
              <Button full size="lg" disabled={!ok} iconRight="arrow-right" onClick={() => setPhase("sent")}>
                send me a link
              </Button>
            </div>
            <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--ink-3)", margin: "16px 0 0", lineHeight: 1.5 }}>
              no passwords. we'll email you a link to sign in.
            </p>
          </div>
        )}

        {phase === "sent" && (
          <div style={{ textAlign: "center", animation: aReduce() ? "none" : "vfadeup 320ms var(--ease-out)" }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", margin: "0 auto 22px",
              background: "var(--secondary-soft)", color: "var(--secondary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: aReduce() ? "none" : "vpop 360ms var(--ease-out)",
            }}>
              <Icon name="mail" size={32} />
            </div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>check your inbox</h2>
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55 }}>
              we sent a sign-in link to<br /><span style={{ fontWeight: 600, color: "var(--ink)" }}>{email.trim()}</span>
            </p>

            <div style={{ marginTop: 26 }}>
              {/* simulates tapping the emailed link */}
              <Button full size="lg" variant="blue" icon="external-link" onClick={onSignedIn}>
                open the link
              </Button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 14 }}>
              <button onClick={() => setPhase("enter")}
                style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink-2)", padding: "10px 4px", minHeight: 44 }}>
                use a different email
              </button>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)" }}>
                didn't get it? <button onClick={() => {}} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--link)", padding: "4px" }}>resend</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink-3)", padding: "0 0 calc(20px + var(--safe-bottom))", lineHeight: 1.5 }}>
        by continuing you agree to keep things kind.
      </p>
    </div>
  );
}

/* ---------------- OFFLINE ---------------- */
function OfflineScreen({ onRetry }) {
  const [checking, setChecking] = useA(false);
  const retry = () => {
    setChecking(true);
    setTimeout(() => { setChecking(false); onRetry && onRetry(); }, 700);
  };
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 95, background: "var(--paper)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "0 36px",
    }}>
      <div style={{ maxWidth: 320, animation: aReduce() ? "none" : "vfadeup 320ms var(--ease-out)" }}>
        <div style={{
          width: 88, height: 88, borderRadius: "50%", margin: "0 auto 24px",
          background: "var(--surface-sunk)", color: "var(--ink-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: aReduce() ? "none" : "vfloat 3.4s var(--ease-in-out) infinite",
        }}>
          <Icon name="cloud-off" size={38} />
        </div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>you're offline</h2>
        <p style={{ margin: "12px 0 0", fontFamily: "var(--font-sans)", fontSize: 16, color: "var(--ink-2)", lineHeight: 1.55 }}>
          your words are safe — kept right here. we'll sync the moment you're back.
        </p>
        <div style={{ marginTop: 26, display: "inline-flex" }}>
          <Button variant="secondary" size="lg" icon={checking ? "loader" : "refresh-cw"} onClick={retry}>
            {checking ? "checking…" : "try again"}
          </Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, OfflineScreen });
