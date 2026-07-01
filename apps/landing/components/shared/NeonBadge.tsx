import type { ReactNode, CSSProperties } from "react";

export type BadgeColor  = "green" | "pink" | "blue" | "gold" | "amber" | "muted";
export type BadgeSize   = "xs" | "sm" | "md";

interface NeonBadgeProps {
  children:   ReactNode;
  color?:     BadgeColor;
  size?:      BadgeSize;
  icon?:      ReactNode;
  dot?:       boolean;    // shows a pulsing dot prefix
  className?: string;
  style?:     CSSProperties;
}

const COLOR_CLASS: Record<BadgeColor, string> = {
  green: "neon-badge neon-badge-green",
  pink:  "neon-badge neon-badge-pink",
  blue:  "neon-badge neon-badge-blue",
  gold:  "neon-badge neon-badge-gold",
  amber: "neon-badge neon-badge-amber",
  muted: "neon-badge neon-badge-muted",
};

const SIZE_STYLE: Record<BadgeSize, CSSProperties> = {
  xs: { fontSize: "0.52rem", padding: "2px 7px",  letterSpacing: "0.12em" },
  sm: { fontSize: "0.60rem", padding: "3px 10px", letterSpacing: "0.14em" },
  md: { fontSize: "0.68rem", padding: "4px 12px", letterSpacing: "0.10em" },
};

const DOT_COLOR: Record<BadgeColor, string> = {
  green: "#f5c842",
  pink:  "#ff5a4d",
  blue:  "#3a9e9e",
  gold:  "#ffd700",
  amber: "#f0a92a",
  muted: "rgba(255,255,255,0.4)",
};

/** MMR tier presets — use the `tier` prop shortcut */
export const TIER_BADGES = {
  iron:     { label: "IRON",     color: "muted"  as BadgeColor },
  bronze:   { label: "BRONZE",   color: "amber"  as BadgeColor },
  silver:   { label: "SILVER",   color: "muted"  as BadgeColor },
  gold:     { label: "GOLD",     color: "gold"   as BadgeColor },
  diamond:  { label: "DIAMOND",  color: "blue"   as BadgeColor },
  legend:   { label: "LEGEND",   color: "pink"   as BadgeColor },
  champion: { label: "CHAMPION", color: "green"  as BadgeColor },
} as const;

/** Character role presets */
export const ROLE_BADGES = {
  tank:     { label: "TANK",     color: "blue"   as BadgeColor },
  assassin: { label: "ASSASSIN", color: "pink"   as BadgeColor },
  support:  { label: "SUPPORT",  color: "green"  as BadgeColor },
  bruiser:  { label: "BRUISER",  color: "amber"  as BadgeColor },
  ranged:   { label: "RANGED",   color: "gold"   as BadgeColor },
} as const;

export function NeonBadge({
  children,
  color     = "green",
  size      = "sm",
  icon,
  dot       = false,
  className = "",
  style,
}: NeonBadgeProps) {
  return (
    <span
      className={`${COLOR_CLASS[color]} ${className}`}
      style={{ ...SIZE_STYLE[size], ...style }}
    >
      {dot && (
        <span
          style={{
            width:        "5px",
            height:       "5px",
            borderRadius: "50%",
            background:   DOT_COLOR[color],
            display:      "inline-block",
            flexShrink:   0,
            boxShadow:    `0 0 6px ${DOT_COLOR[color]}`,
          }}
        />
      )}
      {icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </span>
  );
}
