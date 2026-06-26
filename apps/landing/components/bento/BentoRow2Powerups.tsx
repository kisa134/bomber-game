"use client";

import { motion } from "framer-motion";
import { iFade, PowerupCard } from "./BentoShared";

const POWERUPS = [
  { image: "/sprites/powerup_bomb.png",   name: "BOMB UP",   desc: "+1 simultaneous bomb" },
  { image: "/sprites/powerup_fire.png",   name: "FIRE UP",   desc: "+1 explosion range" },
  { image: "/sprites/powerup_speed.png",  name: "SPEED UP",  desc: "+0.42 cells/s" },
  { image: "/sprites/powerup_kick.png",   name: "KICK",      desc: "Boot bombs into enemies" },
  { image: "/sprites/powerup_wall.png",   name: "WALL PASS", desc: "Phase through soft blocks" },
  { image: "/sprites/powerup_health.png", name: "HEALTH",    desc: "+1 HP · rare drop (2%)" },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
};

export function BentoRow2Powerups() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      {POWERUPS.map((p) => (
        <motion.div key={p.name} variants={iFade} className="h-full min-w-0">
          <PowerupCard {...p} />
        </motion.div>
      ))}
    </motion.div>
  );
}
