import { motion } from 'framer-motion';
import PlatformIcon from '@/components/PlatformIcon';
import type { PlatformBreakdown } from '@/data/calendarData';
import type { Platform } from '@/components/PlatformIcon';

interface PlatformBreakdownProps {
  breakdowns: PlatformBreakdown[];
}

// Mini donut chart SVG component
function MiniDonut({
  scheduled,
  published,
  draft,
  total,
}: {
  scheduled: number;
  published: number;
  draft: number;
  total: number;
}) {
  const size = 60;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const scheduledPct = total > 0 ? (scheduled / total) * circumference : 0;
  const publishedPct = total > 0 ? (published / total) * circumference : 0;
  const draftPct = total > 0 ? (draft / total) * circumference : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Published segment (green) */}
        {publishedPct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${publishedPct} ${circumference - publishedPct}`}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${publishedPct} ${circumference - publishedPct}` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        )}
        {/* Scheduled segment (amber) */}
        {scheduledPct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={strokeWidth}
            strokeDasharray={`${scheduledPct} ${circumference - scheduledPct}`}
            strokeDashoffset={-publishedPct}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${scheduledPct} ${circumference - scheduledPct}` }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
        )}
        {/* Draft segment (gray) */}
        {draftPct > 0 && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#6B7280"
            strokeWidth={strokeWidth}
            strokeDasharray={`${draftPct} ${circumference - draftPct}`}
            strokeDashoffset={-(publishedPct + scheduledPct)}
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${draftPct} ${circumference - draftPct}` }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-mono font-semibold text-white">{total}</span>
      </div>
    </div>
  );
}

// Mini bar chart for posts per day
function MiniBarChart({ platform }: { platform: Platform }) {
  // Generate deterministic pseudo-data based on platform
  const seed = platform.charCodeAt(0);
  const bars = Array.from({ length: 7 }, (_, i) => {
    const val = ((seed + i * 3) % 5) + 1;
    return val;
  });
  const maxVal = Math.max(...bars);

  return (
    <div className="flex items-end gap-[3px] h-8">
      {bars.map((val, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${(val / maxVal) * 100}%` }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          className="flex-1 rounded-t-sm bg-white/[0.08] hover:bg-white/[0.15] transition-colors"
        />
      ))}
    </div>
  );
}

export default function PlatformBreakdown({ breakdowns }: PlatformBreakdownProps) {
  return (
    <div>
      <h3 className="font-orbitron text-lg font-semibold text-white mb-4">
        Posts by Platform
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {breakdowns.map((b, idx) => {
          const hasPosts = b.total > 0;

          return (
            <motion.div
              key={b.platform}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              className="rounded-xl border border-white/[0.06] p-4 backdrop-blur-xl
                hover:border-white/[0.10] transition-all"
              style={{ background: 'rgba(26, 26, 38, 0.4)' }}
            >
              {/* Platform name + icon */}
              <div className="flex items-center gap-2 mb-3">
                <PlatformIcon platform={b.platform} size={18} />
                <span className="text-sm font-semibold text-white">{b.platform}</span>
              </div>

              {/* Donut + legend */}
              <div className="flex items-center gap-3 mb-3">
                <MiniDonut
                  scheduled={b.scheduled}
                  published={b.published}
                  draft={b.draft}
                  total={b.total}
                />
                <div className="space-y-1">
                  {b.scheduled > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent-amber" />
                      <span className="text-[10px] text-text-muted">{b.scheduled} sched</span>
                    </div>
                  )}
                  {b.published > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent-green" />
                      <span className="text-[10px] text-text-muted">{b.published} pub</span>
                    </div>
                  )}
                  {b.draft > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-text-muted" />
                      <span className="text-[10px] text-text-muted">{b.draft} draft</span>
                    </div>
                  )}
                  {b.total === 0 && (
                    <span className="text-[10px] text-text-muted">No posts</span>
                  )}
                </div>
              </div>

              {/* Mini bar chart */}
              {hasPosts && <MiniBarChart platform={b.platform} />}

              {/* Est. reach */}
              {b.estReach > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.04]">
                  <span className="text-[11px] font-mono text-text-muted">
                    Est. reach: {b.estReach.toLocaleString()}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
