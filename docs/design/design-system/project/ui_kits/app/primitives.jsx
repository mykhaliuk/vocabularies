/* global React */
// Vocabu UI kit — shared primitives
const { useState, useRef, useEffect, useCallback } = React;

/* ---------- Icon (Lucide, built from icon-node data) ---------- */
function lucideSvg(name, { size = 18, stroke = 2, fill = "none" } = {}) {
  const pascal = name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  const node = window.lucide && window.lucide.icons && window.lucide.icons[pascal];
  if (!node) return "";
  const children = node[2] || [];
  const inner = children
    .map(([t, a]) => "<" + t + " " + Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ") + "/>")
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function Icon({ name, size = 18, stroke = 2, fill = "none", color, style, className }) {
  const html = lucideSvg(name, { size, stroke, fill });
  return (
    <span
      className={className}
      style={{ display: "inline-flex", width: size, height: size, color, lineHeight: 0, flex: "0 0 auto", ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ---------- Avatar ---------- */
const AV_COLORS = {
  rose: ["var(--rose-200)", "var(--rose-700)"],
  blue: ["var(--blue-200)", "var(--blue-700)"],
  sage: ["#D8E4D6", "#3f5a40"],
  amber: ["#F0E2C4", "#7a5e22"],
  ink: ["var(--ink-2)", "#fff"],
};
function Avatar({ name = "?", tone = "blue", size = 40, ring = false }) {
  const [bg, fg] = AV_COLORS[tone] || AV_COLORS.blue;
  const inner = (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.4, fontFamily: "var(--font-sans)", flex: "0 0 auto",
      }}
    >
      {name[0].toUpperCase()}
    </div>
  );
  if (!ring) return inner;
  return (
    <div style={{ padding: 2, borderRadius: "50%", background: "linear-gradient(135deg,var(--rose-400),var(--blue-400))", flex: "0 0 auto" }}>
      <div style={{ padding: 2, background: "var(--paper)", borderRadius: "50%" }}>{inner}</div>
    </div>
  );
}

/* ---------- Button (with press scale) ---------- */
function Button({ children, variant = "primary", size = "md", icon, onClick, style, full }) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600, border: 0, cursor: "pointer",
    borderRadius: "var(--r-btn)", display: "inline-flex", alignItems: "center",
    justifyContent: "center", gap: 7, whiteSpace: "nowrap", transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), filter var(--dur-fast)",
    transform: pressed ? "scale(0.97)" : "scale(1)", width: full ? "100%" : undefined,
    fontSize: size === "sm" ? 14 : 14.5, padding: size === "sm" ? "7px 13px" : "9px 16px",
    minHeight: size === "sm" ? 34 : 40,
  };
  const dark = pressed ? "brightness(0.9)" : hover ? "brightness(0.94)" : "none";
  const variants = {
    primary: { background: "var(--rose-500)", color: "#fff", boxShadow: "var(--shadow-float)", filter: dark },
    blue: { background: "var(--blue-500)", color: "#fff", filter: dark },
    secondary: { background: hover ? "var(--surface-sunk)" : "var(--surface)", color: "var(--ink)", border: `1.5px solid ${hover ? "var(--ink-3)" : "var(--hairline-2)"}` },
    ghost: { background: hover ? "var(--rose-50)" : "transparent", color: "var(--rose-600)" },
    danger: { background: hover ? "var(--danger-bg)" : "transparent", color: "var(--danger)" },
  };
  return (
    <button
      style={{ ...base, ...variants[variant], ...style }}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => { setPressed(false); setHover(false); }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 17} />}
      {children}
    </button>
  );
}

/* ---------- Round icon button ---------- */
function IconButton({ name, onClick, active, size = 40, fill = "none", color, title }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        width: size, height: size, borderRadius: "50%", border: 0, cursor: "pointer",
        background: "transparent", color: color || (active ? "var(--rose-600)" : "var(--ink-2)"),
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transform: pressed ? "scale(0.9)" : "scale(1)", transition: "transform var(--dur-fast) var(--ease-out)",
      }}
    >
      <Icon name={name} size={20} fill={fill} />
    </button>
  );
}

/* ---------- Chip ---------- */
function Chip({ children, active, tone = "rose", icon, onClick }) {
  const tones = {
    rose: { background: "var(--rose-50)", border: "var(--rose-200)", color: "var(--on-primary-soft)" },
    blue: { background: "var(--blue-50)", border: "var(--blue-200)", color: "var(--on-secondary-soft)" },
  };
  const on = active ? tones[tone] : { background: "var(--surface)", border: "var(--hairline-2)", color: "var(--ink-2)" };
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-sans)",
        fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: "var(--r-sm)",
        background: on.background, border: `1.5px solid ${on.border}`, color: on.color,
        cursor: "pointer", whiteSpace: "nowrap", transition: "all var(--dur-fast)",
      }}
    >
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

Object.assign(window, { Icon, Avatar, Button, IconButton, Chip, lucideSvg });

/* ---------- Theme toggle (light ↔ dark) ---------- */
function setTheme(next) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("vocabu-theme", next); } catch (e) {}
}
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const toggle = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setDark(!dark);
  };
  return (
    <IconButton
      name={dark ? "sun" : "moon"}
      onClick={toggle}
      color="var(--ink-2)"
      title={dark ? "Switch to light" : "Switch to dark"}
    />
  );
}

Object.assign(window, { ThemeToggle, setTheme });
