import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  addDays,
  isToday,
  startOfWeek,
} from 'date-fns';
import PostCard from './PostCard';
import type { CalendarPost, OptimalTime } from '@/data/calendarData';
interface WeekViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
  onPostMove: (postId: string, newDate: string) => void;
  onDateClick: (date: Date) => void;
  onEmptySlotClick: (date: string, time: string) => void;
  selectedPosts: string[];
  onSelectPost?: (postId: string) => void;
  optimalTimes: OptimalTime[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 to 19:00

export default function WeekView({
  currentDate,
  posts,
  onPostClick,
  onPostMove,
  onDateClick,
  onEmptySlotClick,
  selectedPosts,
  onSelectPost,
  optimalTimes,
}: WeekViewProps) {
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getPostsForDay = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return posts
        .filter((p) => p.scheduledDate === dateStr)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    },
    [posts]
  );

  const getOptimalForDay = useCallback(
    (date: Date) => {
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      return optimalTimes.filter((o) => o.dayOfWeek === dayOfWeek);
    },
    [optimalTimes]
  );

  const isDayToday = (date: Date) => isToday(date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full overflow-x-auto"
    >
      <div className="min-w-[900px]">
        {/* Header row */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {weekDays.map((date, idx) => {
            const dayName = DAYS[idx];
            const dateNum = format(date, 'd');
            const isCurrentDay = isDayToday(date);

            return (
              <motion.div
                key={dayName}
                onClick={() => onDateClick(date)}
                className={`
                  text-center py-3 px-2 rounded-t-xl cursor-pointer
                  transition-all duration-200
                  ${isCurrentDay
                    ? 'bg-accent-cyan/[0.06] border-t-2 border-accent-cyan'
                    : 'hover:bg-bg-surface-hover'
                  }
                `}
                whileHover={{ scale: 1.02 }}
              >
                <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted mb-1">
                  {dayName}
                </div>
                <div
                  className={`
                    text-xl font-mono font-semibold inline-flex items-center justify-center
                    w-8 h-8 rounded-lg
                    ${isCurrentDay
                      ? 'bg-accent-cyan text-white shadow-glow-cyan'
                      : 'text-white'
                    }
                  `}
                >
                  {dateNum}
                </div>
                {isCurrentDay && (
                  <motion.div
                    className="mt-1 text-[9px] text-accent-cyan uppercase tracking-wider font-semibold"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Today
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Time grid + posts */}
        <div className="grid grid-cols-7 gap-px bg-white/[0.04] rounded-b-xl overflow-hidden">
          {weekDays.map((date, dayIdx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayPosts = getPostsForDay(date);
            const dayOptimal = getOptimalForDay(date);
            const isCurrentDay = isDayToday(date);

            return (
              <motion.div
                key={dateStr}
                className={`
                  relative min-h-[500px] p-2
                  transition-colors duration-200
                  ${isCurrentDay ? 'bg-accent-cyan/[0.03]' : 'bg-bg-surface'}
                  ${dragOverDay === dateStr ? 'ring-2 ring-accent-purple ring-inset' : ''}
                  ${dayIdx < 6 ? 'border-r border-white/[0.04]' : ''}
                `}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDay(dateStr);
                }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const postId = e.dataTransfer.getData('text/plain');
                  if (postId) onPostMove(postId, dateStr);
                  setDragOverDay(null);
                }}
              >
                {/* Time slot grid lines (visual) */}
                <div className="absolute inset-0 pointer-events-none">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-dashed border-white/[0.03]"
                      style={{ height: `${100 / HOURS.length}%` }}
                    >
                      <span className="text-[9px] font-mono text-text-muted/50 ml-1">
                        {String(hour).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Optimal time indicators */}
                {dayOptimal.map((opt, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-1 right-1 rounded pointer-events-none z-0"
                    style={{
                      top: `${((opt.startHour - 8) / 12) * 100}%`,
                      height: `${((opt.endHour - opt.startHour) / 12) * 100}%`,
                      background: `linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.15) 100%)`,
                    }}
                    animate={{ opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    title={`Optimal: ${opt.startHour}:00-${opt.endHour}:00 (Engagement: ${opt.engagementScore})`}
                  >
                    {/* Green dot at optimal hour */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-green shadow-glow-green"
                      style={{ top: '30%' }}
                    />
                  </motion.div>
                ))}

                {/* Posts */}
                <div className="relative z-10 space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {dayPosts.map((post, i) => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                          e.dataTransfer?.setData('text/plain', post.id);
                        }}
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{
                            delay: i * 0.05,
                            duration: 0.2,
                            ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
                          }}
                        >
                          <PostCard
                            post={post}
                            onClick={onPostClick}
                            onDragEnd={onPostMove}
                            selected={selectedPosts.includes(post.id)}
                            onSelect={onSelectPost}
                          />
                        </motion.div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Empty slot - click to add */}
                {dayPosts.length === 0 && (
                  <motion.button
                    onClick={() => onEmptySlotClick(dateStr, '12:00')}
                    className="absolute inset-x-2 bottom-4 h-16 rounded-lg border border-dashed border-white/[0.08] 
                      flex items-center justify-center text-text-muted/40 hover:text-text-muted
                      hover:border-accent-purple/30 hover:bg-accent-purple/[0.04]
                      transition-all duration-200"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <span className="text-xs">+ Add post</span>
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
