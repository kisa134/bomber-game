import type { FC } from 'react';

export type StatusType = 'live' | 'scheduled' | 'published' | 'draft' | 'processing';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; bgColor: string; textColor: string; dotColor?: string }> = {
  live: {
    label: 'LIVE',
    bgColor: 'bg-accent-green/15',
    textColor: 'text-accent-green',
    dotColor: 'bg-accent-green',
  },
  scheduled: {
    label: 'SCHEDULED',
    bgColor: 'bg-accent-amber/15',
    textColor: 'text-accent-amber',
  },
  published: {
    label: 'PUBLISHED',
    bgColor: 'bg-accent-green/15',
    textColor: 'text-accent-green',
  },
  draft: {
    label: 'DRAFT',
    bgColor: 'bg-text-muted/15',
    textColor: 'text-text-secondary',
  },
  processing: {
    label: 'PROCESSING',
    bgColor: 'bg-accent-purple/15',
    textColor: 'text-accent-purple',
    dotColor: 'bg-accent-purple',
  },
};

const StatusBadge: FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2 py-0.5 rounded-full
        text-[11px] font-semibold tracking-[0.08em] uppercase
        ${config.bgColor} ${config.textColor}
        ${className}
      `}
    >
      {config.dotColor && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${status === 'live' || status === 'processing' ? 'animate-pulse' : ''}`}
        />
      )}
      {config.label}
    </span>
  );
};

export default StatusBadge;
