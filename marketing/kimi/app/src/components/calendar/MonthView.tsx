import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  differenceInCalendarDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarPost } from '@/data/calendarData';
import { platformColors } from '@/data/calendarData';

interface MonthViewProps {
  currentDate: Date;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
  onWeekClick: (date: Date) => void;
  onEmptySlotClick: (date: string, time: string) => void;
  onDateChange: (date: Date) => void;
}

export default function MonthView({
  currentDate,
  posts,
  onWeekClick,
  onEmptySlotClick,
  onDateChange,
}: MonthViewProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let day = calendarStart;
  while (differenceInCalendarDays(calendarEnd, day) >= 0) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getPostsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return posts.filter((p) => p.scheduledDate === dateStr);
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-bg-surface-hover transition-colors"
          >
            <ChevronLeft size={18} className="text-text-secondary" />
          </button>
          <h2 className="font-orbitron text-lg font-semibold text-white">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full hover:bg-bg-surface-hover transition-colors"
          >
            <ChevronRight size={18} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center py-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-text-muted"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-white/[0.04] rounded-xl overflow-hidden">
        {days.map((date) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isToday(date);
          const dayPosts = getPostsForDay(date);
          const isHovered = hoveredCell === dateStr;

          // Get unique platforms for dots
          const platforms = [...new Set(dayPosts.map((p) => p.platform))].slice(0, 4);
          const extraCount = dayPosts.length - 4;

          return (
            <motion.div
              key={dateStr}
              onClick={() => {
                if (dayPosts.length > 0) {
                  onWeekClick(date);
                } else {
                  onEmptySlotClick(dateStr, '12:00');
                }
              }}
              onMouseEnter={() => setHoveredCell(dateStr)}
              onMouseLeave={() => setHoveredCell(null)}
              className={`
                relative min-h-[100px] p-2 cursor-pointer
                transition-all duration-150
                ${isCurrentMonth ? 'bg-bg-surface' : 'bg-bg-surface/50'}
                ${isCurrentDay ? 'ring-1 ring-inset ring-accent-cyan' : ''}
                ${isHovered && isCurrentMonth ? 'bg-bg-surface-hover' : ''}
              `}
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.1 }}
            >
              {/* Date number */}
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`
                    text-sm font-mono font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isCurrentDay
                      ? 'bg-accent-cyan text-white shadow-glow-cyan'
                      : isCurrentMonth
                        ? 'text-white'
                        : 'text-text-muted/40'
                    }
                  `}
                >
                  {format(date, 'd')}
                </span>
                {dayPosts.length > 0 && (
                  <span className="text-[9px] font-mono text-text-muted">
                    {dayPosts.length}
                  </span>
                )}
              </div>

              {/* Post dots / mini list */}
              {dayPosts.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {platforms.map((platform, i) => (
                    <motion.div
                      key={platform}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: platformColors[platform] }}
                        title={platform}
                      />
                    </motion.div>
                  ))}
                  {extraCount > 0 && (
                    <span className="text-[9px] text-text-muted font-mono ml-0.5">
                      +{extraCount}
                    </span>
                  )}
                </div>
              )}

              {/* Mini post previews (on hover) */}
              <AnimatePresence>
                {isHovered && dayPosts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-x-1 bottom-1 z-20 space-y-0.5"
                  >
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-surface-raised/90 text-[9px] text-text-secondary truncate"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: platformColors[post.platform] }}
                        />
                        <span className="truncate">{post.caption.slice(0, 20)}...</span>
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-[8px] text-text-muted px-1.5">
                        +{dayPosts.length - 2} more
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Elevated background for cells with posts */}
              {dayPosts.length > 0 && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
