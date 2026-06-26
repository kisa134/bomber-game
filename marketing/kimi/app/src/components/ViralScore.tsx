import type { FC } from 'react';
import { motion } from 'framer-motion';

interface ViralScoreProps {
  score: number;
  size?: number;
  className?: string;
}

const ViralScore: FC<ViralScoreProps> = ({ score, size = 64, className = '' }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Determine glow color based on score
  let glowColor = 'rgba(239, 68, 68, 0.4)'; // red
  if (score > 30) glowColor = 'rgba(245, 158, 11, 0.4)'; // amber
  if (score > 60) glowColor = 'rgba(139, 92, 246, 0.4)'; // purple
  if (score > 85) glowColor = 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.4))'; // gradient

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Score fill with gradient */}
        <defs>
          <linearGradient id={`scoreGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#scoreGradient-${score})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="font-mono text-white font-semibold"
          style={{ fontSize: size * 0.3 }}
        >
          {score}
        </motion.span>
      </div>
      {/* Glow effect for high scores */}
      {score > 60 && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: score > 85
              ? '0 0 12px rgba(139, 92, 246, 0.3), 0 0 24px rgba(6, 182, 212, 0.2)'
              : `0 0 12px ${glowColor}`,
          }}
        />
      )}
    </div>
  );
};

export default ViralScore;
