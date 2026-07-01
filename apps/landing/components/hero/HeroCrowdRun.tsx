"use client";

/* Hero crowd-run — a perspective stampede of our meme fighters sprinting straight at
   the camera. Each page load picks a fresh random crowd (skins / lanes / phase), so the
   hero never looks the same twice. Depth comes from per-runner scale + blur + brightness
   as they rush from far/small/dim to near/big/bright, clipping waist-up at the bottom.
   Front-facing run cycle = skin_N_down_{0,1,2}. Client-only random (no hydration drift). */

import { useEffect, useState } from "react";

type Runner = { skin: number; lane: number; delay: number; dur: number; foff: number; scale: number };

const POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const COUNT = 9;

export function HeroCrowdRun() {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const list: Runner[] = Array.from({ length: COUNT }, () => ({
      skin: POOL[Math.floor(Math.random() * POOL.length)],
      lane: 30 + Math.random() * 66,        // % across (right-biased so the headline stays clear)
      delay: -Math.random() * 8,            // negative → start mid-run (staggered in depth)
      dur: 6.5 + Math.random() * 4,         // run speed
      foff: Math.floor(Math.random() * 3),  // frame offset so they don't all step in sync
      scale: 0.9 + Math.random() * 0.28,    // size variation
    }));
    setRunners(list);
    const id = setInterval(() => setFrame((f) => (f + 1) % 3), 130);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-crowd pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {runners.map((r, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={`/sprites/skin_${r.skin}_down_${(frame + r.foff) % 3}.webp`}
          alt=""
          className="hero-runner"
          style={{
            left: `${r.lane}%`,
            animationDelay: `${r.delay}s`,
            animationDuration: `${r.dur}s`,
            ["--rs" as string]: r.scale,
          }}
        />
      ))}
    </div>
  );
}
