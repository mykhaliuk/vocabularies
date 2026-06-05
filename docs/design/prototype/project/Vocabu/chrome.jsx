/* global React, Icon, window */
// Vocabu — chrome: frosted top bar + floating glass bottom nav with raised FAB.

const { useState: useChromeState } = React;

function TopBar({ title, onBack, leftIcon, onLeft, rightIcon, onRight, brand }) {
  const side = (icon, onClick, fallbackBack) => (
    <div style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {(icon || fallbackBack) && (
        <button onClick={onClick}
          style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={fallbackBack ? "arrow-left" : icon} size={fallbackBack ? 22 : 21} color={fallbackBack ? "var(--ink)" : undefined} />
        </button>
      )}
    </div>
  );
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20, height: 54, display: "flex", alignItems: "center", padding: "0 8px",
      background: "var(--glass-bar)", backdropFilter: "blur(16px) saturate(1.4)",
      WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderBottom: "1px solid var(--hairline)",
    }}>
      {side(leftIcon, onBack || onLeft, !!onBack)}
      {brand ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <img src="assets/logo-mark.svg" alt="" width="22" height="22" style={{ display: "block", borderRadius: 6 }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ink)" }}>Vocabu</span>
        </div>
      ) : (
        <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}>{title}</h1>
      )}
      {side(rightIcon, onRight, false)}
    </header>
  );
}

const TABS = [
  { id: "feed", icon: "home" },
  { id: "discover", icon: "search" },
  { id: "saved", icon: "bookmark" },
  { id: "profile", icon: "user" },
];

function BottomNav({ active, onNav, onCompose }) {
  const [pressed, setPressed] = useChromeState(false);
  const tab = (t) => {
    const on = active === t.id;
    return (
      <button key={t.id} onClick={() => onNav(t.id)}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "transparent", border: 0, cursor: "pointer", width: 52, height: 48,
          color: on ? "var(--primary)" : "var(--ink-3)",
        }}>
        <Icon name={t.icon} size={23} fill="none" />
        <span style={{
          width: 5, height: 5, borderRadius: "50%", marginTop: 5,
          background: on ? "var(--primary)" : "transparent",
          transition: "background var(--dur-fast)",
        }} />
      </button>
    );
  };
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30,
      display: "flex", justifyContent: "center",
      padding: "0 16px calc(14px + var(--safe-bottom))", pointerEvents: "none",
    }}>
      <nav style={{
        position: "relative", pointerEvents: "auto",
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px", borderRadius: "var(--r-pill)",
        background: "var(--glass-nav)", backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-lg)",
      }}>
        {tab(TABS[0])}
        {tab(TABS[1])}
        {/* centered slot for the raised FAB */}
        <div style={{ width: 60, height: 48, position: "relative" }}>
          <button
            onClick={onCompose}
            onPointerDown={() => setPressed(true)}
            onPointerUp={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            aria-label="New word"
            style={{
              position: "absolute", left: "50%", top: "50%",
              transform: `translate(-50%,-50%) translateY(-14px) scale(${pressed ? 0.94 : 1})`,
              width: 56, height: 56, borderRadius: "50%", border: "3px solid var(--paper)", cursor: "pointer",
              background: "var(--primary)", color: "var(--text-on-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "var(--shadow-float)", transition: "transform var(--dur-fast) var(--ease-out)",
            }}>
            <Icon name="feather" size={24} />
          </button>
        </div>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </nav>
    </div>
  );
}

Object.assign(window, { TopBar, BottomNav });
