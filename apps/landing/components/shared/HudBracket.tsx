import type { CSSProperties } from "react";

type BracketColor = "green" | "pink" | "blue" | "gold";

interface HudBracketProps {
  /** Corner size in px */
  size?:    number;
  /** Stroke weight in px */
  weight?:  number;
  color?:   BracketColor;
  inset?:   number;
  className?: string;
  style?:   CSSProperties;
  /** Disable blink animation */
  static?:  boolean;
}

const COLOR_MAP: Record<BracketColor, { stroke: string; glow: string }> = {
  green: { stroke: "rgba(90,210,122,0.85)",  glow: "rgba(90,210,122,0.55)"  },
  pink:  { stroke: "rgba(255,90,77,0.85)", glow: "rgba(255,90,77,0.55)" },
  blue:  { stroke: "rgba(127,216,255,0.85)",  glow: "rgba(127,216,255,0.55)"  },
  gold:  { stroke: "rgba(255,215,0,0.85)",  glow: "rgba(255,215,0,0.55)"  },
};

/**
 * HudBracket — overlays 4 L-shaped neon corner brackets on a relatively
 * positioned parent container. Place inside a `position: relative` wrapper.
 */
export function HudBracket({
  size   = 28,
  weight = 2,
  color  = "green",
  inset  = 12,
  className = "",
  style,
  static: isStatic = false,
}: HudBracketProps) {
  const { stroke, glow } = COLOR_MAP[color];

  const base: CSSProperties = {
    position:     "absolute",
    width:        `${size}px`,
    height:       `${size}px`,
    border:       `${weight}px solid ${stroke}`,
    filter:       `drop-shadow(0 0 5px ${glow})`,
    pointerEvents:"none",
    zIndex:       20,
    animation:    isStatic ? undefined : "bracket-blink 3s steps(1) infinite",
    ...style,
  };

  const corners = [
    {
      style: {
        ...base,
        top:         `${inset}px`,
        left:        `${inset}px`,
        borderRight: "none",
        borderBottom:"none",
        borderTopLeftRadius: "3px",
      },
    },
    {
      style: {
        ...base,
        top:         `${inset}px`,
        right:       `${inset}px`,
        borderLeft:  "none",
        borderBottom:"none",
        borderTopRightRadius: "3px",
      },
    },
    {
      style: {
        ...base,
        bottom:      `${inset}px`,
        left:        `${inset}px`,
        borderRight: "none",
        borderTop:   "none",
        borderBottomLeftRadius: "3px",
      },
    },
    {
      style: {
        ...base,
        bottom:      `${inset}px`,
        right:       `${inset}px`,
        borderLeft:  "none",
        borderTop:   "none",
        borderBottomRightRadius: "3px",
      },
    },
  ];

  return (
    <div
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}
    >
      {corners.map((c, i) => (
        <div key={i} style={c.style} />
      ))}
    </div>
  );
}
