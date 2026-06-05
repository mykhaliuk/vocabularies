/* global React, window */
// Vocabu — shared primitives (Icon, Avatar, Button, IconButton, Chip)
const { useState } = React;

/* ---------- Icon (Lucide, built from icon-node data) ---------- */
function lucideSvg(name, { size = 18, stroke = 1.85, fill = "none" } = {}) {
  const pascal = name.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
  const node = window.lucide && window.lucide.icons && window.lucide.icons[pascal];
  if (!node) return "";
  const children = node[2] || [];
  const inner = children
    .map(([t, a]) => "<" + t + " " + Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ") + "/>")
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function Icon({ name, size = 18, stroke = 1.85, fill = "none", color, style, className }) {
  const html = lucideSvg(name, { size, stroke, fill });
  return (
    <span
      className={className}
      style={{ display: "inline-flex", width: size, height: size, color, lineHeight: 0, flex: "0 0 auto", ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ---------- Avatar — quiet, initial on a soft tint ---------- */
const AV_COLORS = {
  rose: ["var(--rose-100)", "var(--rose-700)"],
  blue: ["var(--blue-100)", "var(--blue-700)"],
  ink:  ["var(--surface-sunk)", "var(--ink-2)"],
};
function Avatar({ name = "?", tone = "ink", size = 40, ring = false }) {
  const [bg, fg] = AV_COLORS[tone] || AV_COLORS.ink;
  const inner = (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: bg, color: fg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.42, fontFamily: "var(--font-sans)", flex: "0 0 auto",
        letterSpacing: "-0.01em",
      }}
    >
      {name[0].toUpperCase()}
    </div>
  );
  if (!ring) return inner;
  return (
    <div style={{ padding: 2, borderRadius: "50%", background: "linear-gradient(135deg,var(--rose-300),var(--blue-300))", flex: "0 0 auto" }}>
      <div style={{ padding: 2, background: "var(--paper)", borderRadius: "50%" }}>{inner}</div>
    </div>
  );
}

/* ---------- Button (press-scale, rounded-rect) ---------- */
function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, style, full, disabled }) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600, border: 0, cursor: disabled ? "default" : "pointer",
    borderRadius: "var(--r-btn)", display: "inline-flex", alignItems: "center",
    justifyContent: "center", gap: 7, whiteSpace: "nowrap",
    transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), filter var(--dur-fast)",
    transform: pressed && !disabled ? "scale(0.97)" : "scale(1)", width: full ? "100%" : undefined,
    fontSize: size === "lg" ? 16 : size === "sm" ? 14 : 14.5,
    padding: size === "lg" ? "13px 18px" : size === "sm" ? "7px 13px" : "9px 16px",
    minHeight: size === "lg" ? 50 : size === "sm" ? 34 : 44,
    opacity: disabled ? 0.55 : 1,
  };
  const dark = pressed ? "brightness(0.9)" : hover ? "brightness(0.95)" : "none";
  const variants = {
    primary: { background: "var(--primary)", color: "var(--text-on-accent)", boxShadow: disabled ? "none" : "var(--shadow-float)", filter: dark },
    blue:    { background: "var(--secondary)", color: "var(--text-on-accent)", filter: dark },
    secondary: { background: hover ? "var(--surface-sunk)" : "var(--surface)", color: "var(--ink)", border: `1.5px solid ${hover ? "var(--ink-3)" : "var(--hairline-2)"}` },
    softblue: { background: "var(--secondary-soft)", color: "var(--blue-700)" },
    ghost:   { background: hover ? "var(--primary-soft)" : "transparent", color: "var(--primary-hover)" },
  };
  return (
    <button
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onClick={disabled ? undefined : onClick}
      onPointerEnter={() => setHover(true)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => { setPressed(false); setHover(false); }}
    >
      {icon && <Icon name={icon} size={size === "lg" ? 19 : size === "sm" ? 16 : 17} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 16} />}
    </button>
  );
}

/* ---------- Round icon button ---------- */
function IconButton({ name, onClick, active, size = 44, iconSize = 20, fill = "none", color, title }) {
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
        background: "transparent", color: color || (active ? "var(--primary-hover)" : "var(--ink-2)"),
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transform: pressed ? "scale(0.9)" : "scale(1)", transition: "transform var(--dur-fast) var(--ease-out)",
      }}
    >
      <Icon name={name} size={iconSize} fill={fill} />
    </button>
  );
}

/* ---------- Chip (add-chips, themes, collections) ---------- */
function Chip({ children, active, tone = "rose", icon, onClick, style }) {
  const [pressed, setPressed] = useState(false);
  const tones = {
    rose: { background: "var(--primary-soft)", border: "var(--primary-soft-border)", color: "var(--primary-hover)" },
    blue: { background: "var(--secondary-soft)", border: "var(--blue-200)", color: "var(--blue-700)" },
  };
  const on = active ? tones[tone] : { background: "var(--surface)", border: "var(--hairline-2)", color: "var(--ink-2)" };
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-sans)",
        fontSize: 13.5, fontWeight: 600, padding: "8px 13px", borderRadius: "var(--r-sm)",
        background: on.background, border: `1.5px solid ${on.border}`, color: on.color,
        cursor: "pointer", whiteSpace: "nowrap", minHeight: 38,
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform var(--dur-fast) var(--ease-out), background var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

Object.assign(window, { Icon, Avatar, Button, IconButton, Chip, lucideSvg });
