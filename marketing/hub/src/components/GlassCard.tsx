import type { FC, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  glowColor?: 'purple' | 'cyan' | 'pink' | 'green';
  className?: string;
  noPadding?: boolean;
  /** Optional control rendered top-right of the header (e.g. an export button). */
  action?: ReactNode;
}

const glowColorMap = {
  purple: 'hover:border-accent-purple/20 hover:shadow-glow-purple',
  cyan: 'hover:border-accent-cyan/20 hover:shadow-glow-cyan',
  pink: 'hover:border-accent-pink/20 hover:shadow-glow-pink',
  green: 'hover:border-accent-green/20 hover:shadow-glow-green',
};

const GlassCard: FC<GlassCardProps> = ({
  title,
  subtitle,
  children,
  glowColor = 'purple',
  className = '',
  noPadding = false,
  action,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
      className={`
        relative rounded-2xl border border-white/[0.06]
        backdrop-blur-2xl
        transition-all duration-300
        ${glowColorMap[glowColor]}
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
      style={{
        background: 'rgba(26, 26, 38, 0.4)',
      }}
    >
      {/* Glow pseudo-element on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        }}
      />
      {(title || subtitle || action) && (
        <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-white font-inter text-xl font-semibold tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-text-muted text-[13px] mt-1">{subtitle as string}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

export default GlassCard;
