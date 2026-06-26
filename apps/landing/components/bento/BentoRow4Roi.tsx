"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { iFade } from "./BentoShared";

const RoiCalculator = dynamic(
  () => import("@/components/RoiCalculator").then((m) => m.RoiCalculator),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-48 w-full animate-pulse rounded-2xl"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
    ),
  }
);

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.55 } },
};

export function BentoRow4Roi() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
    >
      <motion.div variants={iFade} className="bento-card roi-card p-4 lg:p-6">
        <RoiCalculator />
      </motion.div>
    </motion.div>
  );
}
