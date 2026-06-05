/* global React, Icon, IconButton */
// Vocabu UI kit — app chrome (top bar + bottom tab nav)

function TopBar({ title, onBack, action, serif }) {
  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 20,
        height: 52, display: "flex", alignItems: "center", padding: "0 8px",
        background: "var(--bar-bg)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div style={{ width: 44, display: "flex", justifyContent: "flex-start" }}>
        {onBack && <IconButton name="arrow-left" onClick={onBack} color="var(--ink)" />}
      </div>
      <h1 style={{
        flex: 1, textAlign: "center", margin: 0,
        fontFamily: "var(--font-sans)",
        fontSize: 17, fontWeight: 700, color: "var(--ink)",
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h1>
      <div style={{ width: 44, display: "flex", justifyContent: "flex-end" }}>
        {action}
      </div>
    </header>
  );
}

function FeedTopBar() {
  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 20, height: 52,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative",
        background: "var(--bar-bg)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hairline)",
      }}
    >
      <img src="../../assets/logo-mark.svg" alt="" width="24" height="24" style={{ display: "block" }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--ink)" }}>Vocabu</span>
      <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}>
        <ThemeToggle />
      </div>
    </header>
  );
}

const TABS = [
  { id: "feed", icon: "home", label: "Feed" },
  { id: "discover", icon: "search", label: "Discover" },
  { id: "compose", icon: "feather", label: "", fab: true },
  { id: "saved", icon: "bookmark", label: "Saved" },
  { id: "profile", icon: "user", label: "You" },
];

function BottomNav({ active, onNav, onCompose }) {
  return (
    <nav
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "6px 6px calc(6px + var(--safe-bottom))", height: "var(--bottom-nav-h)",
        background: "var(--bar-bg)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)", borderTop: "1px solid var(--hairline)",
      }}
    >
      {TABS.map((t) =>
        t.fab ? (
          <button
            key={t.id}
            onClick={onCompose}
            style={{
              width: 52, height: 52, marginTop: -8, borderRadius: "50%", border: 0, cursor: "pointer",
              background: "var(--rose-500)", color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", boxShadow: "var(--shadow-float)",
            }}
          >
            <Icon name="feather" size={23} />
          </button>
        ) : (
          <button
            key={t.id}
            onClick={() => onNav(t.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "transparent", border: 0, cursor: "pointer", width: 56, height: 46,
              justifyContent: "center", color: active === t.id ? "var(--rose-600)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600,
            }}
          >
            <Icon name={t.icon} size={23} fill={active === t.id && t.id !== "search" ? "none" : "none"} />
            {t.label}
          </button>
        )
      )}
    </nav>
  );
}

Object.assign(window, { TopBar, FeedTopBar, BottomNav });
