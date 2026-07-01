"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";

export type GlassVariant = "default" | "green" | "pink" | "blue" | "gold" | "amber";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children:  ReactNode;
  variant?:  GlassVariant;
  padding?:  string;
  radius?:   string;
  noHover?:  boolean;
  className?: string;
  style?:    CSSProperties;
}

const VARIANT_CLASSES: Record<GlassVariant, string> = {
  default: "pixel-panel",
  green:   "pixel-panel",
  pink:    "pixel-panel pixel-panel--red",
  blue:    "pixel-panel pixel-panel--teal",
  gold:    "pixel-panel pixel-panel--gold",
  amber:   "pixel-panel",
};

const VARIANT_BORDER: Record<GlassVariant, string> = {
  default: "rgba(245,200,66,0.16)",
  green:   "rgba(245,200,66,0.16)",
  pink:    "rgba(212,64,48,0.28)",
  blue:    "rgba(58,158,158,0.28)",
  gold:    "rgba(245,200,66,0.28)",
  amber:   "rgba(240,169,42,0.28)",
};

const VARIANT_GLOW: Record<GlassVariant, string> = {
  default: "rgba(245,200,66,0.08)",
  green:   "rgba(245,200,66,0.08)",
  pink:    "rgba(212,64,48,0.10)",
  blue:    "rgba(58,158,158,0.10)",
  gold:    "rgba(245,200,66,0.10)",
  amber:   "rgba(240,169,42,0.10)",
};

export function GlassCard({
  children,
  variant  = "default",
  padding  = "1.5rem",
  radius   = "0",
  noHover  = false,
  className = "",
  style,
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      className={`${VARIANT_CLASSES[variant]} ${className}`}
      style={{
        padding,
        borderRadius: radius,
        borderColor:  VARIANT_BORDER[variant],
        ...style,
      }}
      whileHover={
        noHover
          ? undefined
          : {
              borderColor: VARIANT_BORDER[variant].replace("0.16", "0.38").replace("0.28", "0.45"),
              boxShadow: `4px 4px 0 rgba(0,0,0,0.55), 0 0 24px ${VARIANT_GLOW[variant]}`,
            }
      }
      transition={{ duration: 0.22, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
