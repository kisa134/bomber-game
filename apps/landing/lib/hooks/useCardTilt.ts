"use client";

import { useEffect, useRef, useCallback } from "react";
import { registerRaf, unregisterRaf } from "@/lib/rafManager";
import { getLiteLevel } from "@/lib/liteMode";

interface CardTiltOptions {
  key: string;
  stiffness?: number;
  damping?: number;
  maxTilt?: number;
  fanAngle?: number;
  isActive?: boolean;
  bobAmplitude?: number;
  enabled?: boolean;
}

interface TiltState {
  mx: number;
  my: number;
  tmx: number;
  tmy: number;
  vx: number;
  vy: number;
  t: number;
  isHovered: boolean;
  lastFrameTime: number;
}

/** Per-frame card driver — CSS vars only, zero React re-renders (spec §1.4). */
export function useCardTilt(
  cardRef: React.RefObject<HTMLElement | null>,
  options: CardTiltOptions,
) {
  const {
    key,
    stiffness = 180,
    damping = 18,
    maxTilt = 15,
    fanAngle = 0,
    isActive = true,
    bobAmplitude = 4,
    enabled = true,
  } = options;

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const state = useRef<TiltState>({
    mx: 0,
    my: 0,
    tmx: 0,
    tmy: 0,
    vx: 0,
    vy: 0,
    t: Math.random() * Math.PI * 2,
    isHovered: false,
    lastFrameTime: 0,
  });

  const rafKey = `card-tilt-${key}`;

  const tick = useCallback(
    (dt: number) => {
      const el = cardRef.current;
      if (!el) return;
      const s = state.current;
      const active = isActiveRef.current;
      const lite = getLiteLevel();

      if (lite === "minimal") return;

      const k = stiffness / 1000;
      const d = damping / 1000;
      const ax = k * (s.tmx - s.mx) - d * s.vx;
      const ay = k * (s.tmy - s.my) - d * s.vy;
      s.vx += ax * dt;
      s.vy += ay * dt;
      s.mx += s.vx * dt;
      s.my += s.vy * dt;

      s.t += dt * 0.001 * (active ? 0.8 : 0.35);
      const depth = active ? 1 : 0.45;
      const idleOffsetY = active && !s.isHovered ? Math.sin(s.t * 1.1) * bobAmplitude : 0;
      const idleSway = active && !s.isHovered ? Math.cos(s.t * 0.7) * 2 : 0;
      const idleRoll = active && !s.isHovered ? Math.sin(s.t * 0.5) * 1.5 : 0;

      const rx = s.my * maxTilt * 0.8 + (s.isHovered ? 0 : idleOffsetY * 0.3);
      const ry = -s.mx * maxTilt + idleSway * 0.5;
      const rz = idleRoll + (s.isHovered ? s.mx * -2 : 0);

      const lx = (s.mx + 1) / 2;
      const ly = (s.my + 1) / 2;
      const holoX = lx * 100 + fanAngle * 0.8;
      const holoY = ly * 100;

      const shadowX = s.mx * 12 * depth;
      const shadowY = (s.my * 8 + 8) * depth;
      const shadowBlur = active ? 24 + Math.abs(s.mx * 8) : 12;
      const shadowAlpha = active ? 0.55 : 0.3;

      const cs = el.style;
      cs.setProperty("--tilt-rx", `${rx}deg`);
      cs.setProperty("--tilt-ry", `${ry}deg`);
      cs.setProperty("--tilt-rz", `${rz}deg`);
      cs.setProperty("--tilt-tz", active && s.isHovered ? "28px" : "0px");
      cs.setProperty("--lx", `${lx * 100}%`);
      cs.setProperty("--ly", `${ly * 100}%`);
      cs.setProperty("--holo-x", `${holoX}%`);
      cs.setProperty("--holo-y", `${holoY}%`);
      cs.setProperty("--shadow-x", `${shadowX}px`);
      cs.setProperty("--shadow-y", `${shadowY}px`);
      cs.setProperty("--shadow-blur", `${shadowBlur}px`);
      cs.setProperty("--shadow-alpha", `${shadowAlpha}`);
      cs.setProperty("--idle-ty", `${idleOffsetY}px`);
      cs.setProperty("--depth", `${depth}`);
      cs.setProperty("--fan-angle-bias", `${fanAngle}deg`);

      if (lite === "lite") {
        cs.setProperty("--holo-x", "50%");
        cs.setProperty("--holo-y", "50%");
      }
    },
    [cardRef, stiffness, damping, maxTilt, fanAngle, bobAmplitude],
  );

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !enabled) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      state.current.tmx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      state.current.tmy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onEnter = () => {
      state.current.isHovered = true;
    };
    const onLeave = () => {
      state.current.isHovered = false;
      state.current.tmx = 0;
      state.current.tmy = 0;
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerenter", onEnter, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [cardRef, enabled]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !enabled || getLiteLevel() === "minimal") return;

    let visible = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !visible) {
          visible = true;
          registerRaf(rafKey, tick);
        } else if (entry && !entry.isIntersecting && visible) {
          visible = false;
          unregisterRaf(rafKey);
        }
      },
      { rootMargin: "100px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      unregisterRaf(rafKey);
    };
  }, [rafKey, tick, cardRef, enabled]);
}

/** External tilt feed (gyro / touch drag). */
export function setCardTiltTarget(
  cardRef: React.RefObject<HTMLElement | null>,
  mx: number,
  my: number,
) {
  const el = cardRef.current;
  if (!el) return;
  el.style.setProperty("--tilt-override-mx", String(mx));
  el.style.setProperty("--tilt-override-my", String(my));
}
