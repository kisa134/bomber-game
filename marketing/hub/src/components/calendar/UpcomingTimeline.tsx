import { motion } from 'framer-motion';
import { Pencil, Eye, ChevronRight, Clock } from 'lucide-react';
import PlatformIcon from '@/components/PlatformIcon';
import type { CalendarPost } from '@/data/calendarData';
import { platformColors } from '@/data/calendarData';
import {
  format,
  isToday,
  isTomorrow,
  parseISO,
} from 'date-fns';

interface UpcomingTimelineProps {
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
}

const getRelativeDay = (dateStr: string) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE');
};

export default function UpcomingTimeline({ posts, onPostClick }: UpcomingTimelineProps) {
  // Get next 7 scheduled posts, sorted by date
  const upcomingPosts = posts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => {
      const dateCompare = a.scheduledDate.localeCompare(b.scheduledDate);
      if (dateCompare !== 0) return dateCompare;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    })
    .slice(0, 7);

  return (
    <div
      className="rounded-2xl border border-white/[0.06] backdrop-blur-2xl p-6 relative overflow-hidden"
      style={{ background: 'rgba(26, 26, 38, 0.4)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-orbitron text-lg font-semibold text-white">
            Up Next
          </h3>
          <p className="text-[13px] text-text-muted mt-0.5">Next 7 scheduled posts</p>
        </div>
        <button className="flex items-center gap-1 text-sm text-accent-cyan hover:text-accent-cyan/80 transition-colors">
          View All
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical gradient line */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: '100%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute left-[15px] top-0 bottom-0 w-[2px] rounded-full"
          style={{ background: 'linear-gradient(180deg, #8B5CF6, #06B6D4)' }}
        />

        <div className="space-y-1">
          {upcomingPosts.map((post, idx) => {
            const platformColor = platformColors[post.platform];
            const relativeDay = getRelativeDay(post.scheduledDate);

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08, duration: 0.3 }}
                onClick={() => onPostClick(post)}
                className="relative flex items-center gap-3 pl-9 pr-2 py-3 rounded-xl 
                  hover:bg-bg-surface-hover transition-colors cursor-pointer group"
              >
                {/* Timeline node */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: idx * 0.08 + 0.2,
                    duration: 0.3,
                    ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
                  }}
                  className="absolute left-[9px] w-3.5 h-3.5 rounded-full border-2 border-bg-surface"
                  style={{ backgroundColor: platformColor }}
                />

                {/* Time */}
                <div className="flex-shrink-0 w-[60px]">
                  <div className="text-[11px] font-mono text-text-muted">
                    {relativeDay}
                  </div>
                  <div className="text-[11px] font-mono text-text-secondary">
                    {post.scheduledTime}
                  </div>
                </div>

                {/* Platform icon */}
                <div className="flex-shrink-0">
                  <PlatformIcon platform={post.platform} size={20} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {post.caption.slice(0, 40)}{post.caption.length > 40 ? '...' : ''}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {post.platform} · <span className="text-accent-amber">Scheduled</span>
                  </p>
                </div>

                {/* Actions - visible on hover */}
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPostClick(post);
                    }}
                    className="p-1.5 rounded-md hover:bg-bg-surface-raised text-text-muted hover:text-white transition-colors"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPostClick(post);
                    }}
                    className="p-1.5 rounded-md hover:bg-bg-surface-raised text-text-muted hover:text-white transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {upcomingPosts.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            <Clock size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming scheduled posts</p>
            <p className="text-xs mt-1">Click &quot;+ New Post&quot; to schedule content</p>
          </div>
        )}
      </div>
    </div>
  );
}
