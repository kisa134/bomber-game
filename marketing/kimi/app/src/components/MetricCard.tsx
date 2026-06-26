import type { FC } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  sparkline?: number[];
  index?: number;
  className?: string;
}

const MetricCard: FC<MetricCardProps> = ({
  label,
  value,
  delta,
  deltaPositive,
  sparkline = [],
  index = 0,
  className = '',
}) => {
  // Build SVG sparkline path
  const sparklinePath = () => {
    if (sparkline.length === 0) return '';
    const width = 60;
    const height = 24;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const points = sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const sparkColor = deltaPositive ? '#10B981' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.3 + index * 0.08,
        ease: [0, 0, 0.2, 1] as [number, number, number, number],
      }}
      className={`
        relative rounded-2xl border border-white/[0.06]
        backdrop-blur-2xl p-5
        transition-all duration-300
        hover:border-accent-purple/20 hover:shadow-glow-purple
        min-w-[160px]
        ${className}
      `}
      style={{ background: 'rgba(26, 26, 38, 0.4)' }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-4 right-4 h-[3px] rounded-full"
        style={{
          background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)',
        }}
      />

      <div className="pt-2">
        {/* Label */}
        <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-2">
          {label}
        </p>

        {/* Value + Sparkline row */}
        <div className="flex items-center justify-between gap-3">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 + index * 0.08 }}
            className="font-mono text-[28px] font-bold text-white leading-none"
            style={{ textShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}
          >
            {value}
          </motion.span>

          {/* Sparkline */}
          {sparkline.length > 0 && (
            <svg width="60" height="24" className="flex-shrink-0">
              <defs>
                <linearGradient id={`sparkGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${sparklinePath()} L 60,24 L 0,24 Z`}
                fill={`url(#sparkGradient-${index})`}
              />
              <path
                d={sparklinePath()}
                fill="none"
                stroke={sparkColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Delta badge */}
        <div className="mt-2 flex items-center gap-1">
          <span
            className={`
              inline-flex items-center gap-0.5
              text-[12px] font-mono font-medium
              ${deltaPositive ? 'text-accent-green' : 'text-accent-red'}
            `}
          >
            {deltaPositive ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {delta}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default MetricCard;
