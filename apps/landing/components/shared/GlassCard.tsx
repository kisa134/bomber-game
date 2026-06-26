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
  default: "cyber-glass",
  green:   "cyber-glass",
  pink:    "cyber-glass cyber-glass-pink",
  blue:    "cyber-glass cyber-glass-blue",
  gold:    "cyber-glass",
  amber:   "cyber-glass",
};

const VARIANT_BORDER: Record<GlassVariant, string> = {
  default: "rgba(90,210,122,0.12)",
  green:   "rgba(90,210,122,0.12)",
  pink:    "rgba(255,90,77,0.12)",
  blue:    "rgba(127,216,255,0.12)",
  gold:    "rgba(255,215,0,0.12)",
  amber:   "rgba(255,140,0,0.12)",
};

const VARIANT_GLOW: Record<GlassVariant, string> = {
  default: "rgba(90,210,122,0.08)",
  green:   "rgba(90,210,122,0.08)",
  pink:    "rgba(255,90,77,0.10)",
  blue:    "rgba(127,216,255,0.10)",
  gold:    "rgba(255,215,0,0.10)",
  amber:   "rgba(255,140,0,0.10)",
};

export function GlassCard({
  children,
  variant  = "default",
  padding  = "1.5rem",
  radius   = "1rem",
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
              borderColor: VARIANT_BORDER[variant].replace("0.12", "0.32"),
              boxShadow: `0 24px 72px rgba(0,0,0,0.75), 0 0 32px ${VARIANT_GLOW[variant]}`,
            }
      }
      transition={{ duration: 0.22, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
