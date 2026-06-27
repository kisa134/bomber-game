import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Image,
  FileText,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import PlatformIcon from '@/components/PlatformIcon';
import type { CalendarPost } from '@/data/calendarData';
import { platformColors, platformBgColors } from '@/data/calendarData';
interface PostCardProps {
  post: CalendarPost;
  onClick: (post: CalendarPost) => void;
  onDragEnd?: (postId: string, newDate: string) => void;
  compact?: boolean;
  selected?: boolean;
  onSelect?: (postId: string) => void;
}

const contentTypeIcons = {
  video: Video,
  image: Image,
  text: FileText,
};

const statusConfig = {
  draft: {
    dotColor: 'bg-text-muted',
    borderStyle: 'border-dashed',
    opacity: 'opacity-70',
    watermark: true,
  },
  scheduled: {
    dotColor: 'bg-accent-amber',
    borderStyle: 'border-solid',
    opacity: 'opacity-100',
    watermark: false,
  },
  published: {
    dotColor: 'bg-accent-green',
    borderStyle: 'border-solid',
    opacity: 'opacity-100',
    watermark: false,
  },
};

export default function PostCard({
  post,
  onClick,
  onDragEnd,
  compact = false,
  selected = false,
  onSelect,
}: PostCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const config = statusConfig[post.status];
  const ContentIcon = contentTypeIcons[post.contentType];
  const platformColor = platformColors[post.platform];

  const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number } }) => {
    setIsDragging(false);
    if (!onDragEnd) return;

    // Calculate day offset from drag (each day column ~160px)
    const dayOffset = Math.round(info.offset.x / 160);
    if (dayOffset === 0) return;

    const currentDate = new Date(post.scheduledDate + 'T00:00:00');
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const newDate = currentDate.toISOString().split('T')[0];
    onDragEnd(post.id, newDate);
  };

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        className={`w-2 h-2 rounded-full cursor-pointer hover:scale-125 transition-transform`}
        style={{ backgroundColor: platformColor }}
        onClick={() => onClick(post)}
        title={post.caption.slice(0, 40)}
      />
    );
  }

  return (
    <motion.div
      layout
      drag={post.status !== 'published' ? 'x' : false}
      dragConstraints={{ left: -500, right: 500 }}
      dragElastic={0.1}
      dragSnapToOrigin={!onDragEnd}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.7 : 1, scale: isDragging ? 1.03 : 1 }}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (isDragging) return;
        if (onSelect && (e.ctrlKey || e.metaKey)) {
          onSelect(post.id);
        } else {
          onClick(post);
        }
      }}
      className={`
        relative rounded-lg border-l-[3px] p-2 cursor-pointer
        transition-shadow duration-200
        ${config.borderStyle}
        ${config.opacity}
        ${selected ? 'ring-2 ring-accent-purple' : ''}
      `}
      style={{
        backgroundColor: platformBgColors[post.platform],
        borderLeftColor: platformColor,
        minHeight: 64,
      }}
    >
      {/* Draft watermark */}
      {config.watermark && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-widest text-text-muted/20 pointer-events-none uppercase">
          Draft
        </span>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Time + Platform icon row */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-text-muted">
              {post.scheduledTime}
            </span>
            {post.status === 'published' && (
              <CheckCircle2 size={10} className="text-accent-green" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <ContentIcon size={10} className="text-text-muted" />
            <PlatformIcon platform={post.platform} size={12} />
          </div>
        </div>

        {/* Caption preview */}
        <p className="text-xs font-medium text-white truncate leading-tight">
          {post.caption.slice(0, 35)}{post.caption.length > 35 ? '...' : ''}
        </p>

        {/* Status dot */}
        <div className="flex items-center gap-1 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
          <span className="text-[9px] uppercase tracking-wider text-text-muted">
            {post.status}
          </span>
        </div>

        {/* Hover actions */}
        {isHovered && !isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-bg-surface-raised rounded-md p-0.5 shadow-lg z-20"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick(post);
              }}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-secondary hover:text-white transition-colors"
            >
              <Eye size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick(post);
              }}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-secondary hover:text-white transition-colors"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="p-1 rounded hover:bg-bg-surface-hover text-text-secondary hover:text-accent-red transition-colors"
            >
              <Trash2 size={10} />
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
