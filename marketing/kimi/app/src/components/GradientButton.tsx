import type { FC, ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GradientButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}

const GradientButton: FC<GradientButtonProps> = ({
  children,
  icon,
  onClick,
  className = '',
  size = 'md',
  variant = 'primary',
}) => {
  const sizeClasses = {
    sm: 'px-4 py-2 text-[13px]',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  if (variant === 'secondary') {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`
          inline-flex items-center gap-2
          rounded-xl border border-white/[0.06]
          bg-transparent
          text-text-secondary font-medium
          transition-all duration-200
          hover:bg-bg-surface-hover hover:border-accent-purple/20 hover:text-white
          ${sizeClasses[size]}
          ${className}
        `}
      >
        {icon && <span className="w-4 h-4">{icon}</span>}
        {children}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        inline-flex items-center gap-2
        rounded-xl
        bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink
        text-white font-semibold
        transition-all duration-200
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </motion.button>
  );
};

export default GradientButton;
