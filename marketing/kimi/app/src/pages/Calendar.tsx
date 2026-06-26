import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  LayoutGrid,
  CheckSquare,
  Square,
  Trash2,
  CalendarClock,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
} from 'date-fns';

// Sub-components
import WeekView from '@/components/calendar/WeekView';
import MonthView from '@/components/calendar/MonthView';
import PostDetailDrawer from '@/components/calendar/PostDetailDrawer';
import QuickAddModal from '@/components/calendar/QuickAddModal';
import AISuggestionsPanel from '@/components/calendar/AISuggestionsPanel';
import UpcomingTimeline from '@/components/calendar/UpcomingTimeline';
import PlatformBreakdown from '@/components/calendar/PlatformBreakdown';
import GlassCard from '@/components/GlassCard';

// Data
import {
  calendarPosts as initialPosts,
  aiSuggestions,
  optimalTimes,
  getCalendarStats,
  getPlatformBreakdown,
} from '@/data/calendarData';
import type { CalendarPost, AISuggestion } from '@/data/calendarData';
import type { Platform } from '@/components/PlatformIcon';

type ViewMode = 'week' | 'month';

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [posts, setPosts] = useState<CalendarPost[]>(initialPosts);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string>();
  const [modalInitialTime, setModalInitialTime] = useState<string>();
  const [prefilledPlatform, setPrefilledPlatform] = useState<Platform | undefined>();
  const [prefilledCaption, setPrefilledCaption] = useState<string>('');

  // Bulk selection state
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Stats
  const stats = useMemo(() => getCalendarStats(posts), [posts]);
  const platformBreakdown = useMemo(() => getPlatformBreakdown(posts), [posts]);

  // Navigation
  const goToPrev = useCallback(() => {
    if (viewMode === 'week') {
      setCurrentDate((d) => subWeeks(d, 1));
    } else {
      setCurrentDate((d) => subMonths(d, 1));
    }
  }, [viewMode]);

  const goToNext = useCallback(() => {
    if (viewMode === 'week') {
      setCurrentDate((d) => addWeeks(d, 1));
    } else {
      setCurrentDate((d) => addMonths(d, 1));
    }
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // View switching with date sync
  const switchToWeekView = useCallback((date: Date) => {
    setCurrentDate(date);
    setViewMode('week');
  }, []);

  // Post actions
  const handlePostClick = useCallback((post: CalendarPost) => {
    setSelectedPost(post);
    setIsDrawerOpen(true);
  }, []);

  const handlePostMove = useCallback((postId: string, newDate: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, scheduledDate: newDate } : p))
    );
  }, []);

  const handleDeletePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setIsDrawerOpen(false);
    setSelectedPost(null);
  }, []);

  const handleReschedulePost = useCallback(
    (postId: string, newDate: string, newTime: string) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, scheduledDate: newDate, scheduledTime: newTime } : p
        )
      );
      setIsDrawerOpen(false);
    },
    []
  );

  const handleStatusChange = useCallback(
    (postId: string, status: 'draft' | 'scheduled' | 'published') => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, status } : p))
      );
      setIsDrawerOpen(false);
    },
    []
  );

  const handleSavePost = useCallback((updatedPost: CalendarPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    setIsDrawerOpen(false);
  }, []);

  const handleCreatePost = useCallback((newPost: CalendarPost) => {
    setPosts((prev) => [...prev, newPost]);
    setIsModalOpen(false);
  }, []);

  const handleEmptySlotClick = useCallback((date: string, time: string) => {
    setModalInitialDate(date);
    setModalInitialTime(time);
    setPrefilledPlatform(undefined);
    setPrefilledCaption('');
    setIsModalOpen(true);
  }, []);

  const handleNewPostClick = useCallback(() => {
    setModalInitialDate(format(new Date(), 'yyyy-MM-dd'));
    setModalInitialTime('12:00');
    setPrefilledPlatform(undefined);
    setPrefilledCaption('');
    setIsModalOpen(true);
  }, []);

  const handleScheduleSuggestion = useCallback((suggestion: AISuggestion) => {
    setModalInitialDate(suggestion.suggestedDate);
    setModalInitialTime(suggestion.suggestedTime);
    setPrefilledPlatform(suggestion.platform);
    setPrefilledCaption(suggestion.title);
    setIsModalOpen(true);
  }, []);

  // Bulk actions
  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]
    );
  }, []);

  const toggleBulkMode = useCallback(() => {
    setIsBulkMode((prev) => !prev);
    if (isBulkMode) {
      setSelectedPostIds([]);
    }
  }, [isBulkMode]);

  const handleBulkDelete = useCallback(() => {
    setPosts((prev) => prev.filter((p) => !selectedPostIds.includes(p.id)));
    setSelectedPostIds([]);
    setIsBulkMode(false);
  }, [selectedPostIds]);

  const handleBulkReschedule = useCallback(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const newDate = format(tomorrow, 'yyyy-MM-dd');
    setPosts((prev) =>
      prev.map((p) =>
        selectedPostIds.includes(p.id) ? { ...p, scheduledDate: newDate } : p
      )
    );
    setSelectedPostIds([]);
    setIsBulkMode(false);
  }, [selectedPostIds]);

  const handleBulkStatusChange = useCallback(
    (status: 'draft' | 'scheduled') => {
      setPosts((prev) =>
        prev.map((p) =>
          selectedPostIds.includes(p.id) ? { ...p, status } : p
        )
      );
      setSelectedPostIds([]);
      setIsBulkMode(false);
    },
    [selectedPostIds]
  );

  // Date display
  const dateDisplay =
    viewMode === 'week'
      ? (() => {
          const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          const weekEnd = addWeeks(weekStart, 1);
          const startStr = format(weekStart, 'MMM d');
          const endStr = format(weekEnd, 'MMM d, yyyy');
          return `${startStr} - ${endStr}`;
        })()
      : format(currentDate, 'MMMM yyyy');

  // Stat pills
  const statPills = [
    { label: 'SCHEDULED', value: stats.scheduled, color: 'text-accent-amber', icon: CalendarClock },
    { label: 'PUBLISHED', value: stats.published, color: 'text-accent-green', icon: CheckSquare },
    { label: 'DRAFTS', value: stats.drafts, color: 'text-text-muted', icon: Square },
    { label: 'OPTIMAL SLOTS', value: stats.optimalSlots, color: 'text-accent-purple', icon: Sparkles },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Section 1: Calendar Controls + Stats Bar */}
      <div className="space-y-4">
        {/* Controls row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Left: Nav + Date + View Toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Navigation arrows */}
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrev}
                className="p-2 rounded-full hover:bg-bg-surface-hover transition-colors"
              >
                <ChevronLeft size={18} className="text-text-secondary" />
              </button>
              <button
                onClick={goToNext}
                className="p-2 rounded-full hover:bg-bg-surface-hover transition-colors"
              >
                <ChevronRight size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Date display */}
            <motion.h2
              key={dateDisplay}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="font-orbitron text-xl font-semibold text-white min-w-[180px]"
            >
              {dateDisplay}
            </motion.h2>

            {/* View Toggle */}
            <div className="flex items-center bg-bg-surface-raised rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('week')}
                className={`
                  relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                  ${viewMode === 'week' ? 'text-white' : 'text-text-muted hover:text-text-secondary'}
                `}
              >
                {viewMode === 'week' && (
                  <motion.div
                    layoutId="viewToggle"
                    className="absolute inset-0 bg-bg-surface rounded-md border border-white/[0.06]"
                    transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <LayoutGrid size={14} />
                  Week
                </span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`
                  relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                  ${viewMode === 'month' ? 'text-white' : 'text-text-muted hover:text-text-secondary'}
                `}
              >
                {viewMode === 'month' && (
                  <motion.div
                    layoutId="viewToggle"
                    className="absolute inset-0 bg-bg-surface rounded-md border border-white/[0.06]"
                    transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  Month
                </span>
              </button>
            </div>

            {/* Today button */}
            <button
              onClick={goToToday}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-sm text-text-secondary
                hover:bg-bg-surface-hover hover:text-white transition-all"
            >
              Today
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Bulk mode toggle */}
            <button
              onClick={toggleBulkMode}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isBulkMode
                  ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/20'
                  : 'bg-bg-surface-raised border border-white/[0.08] text-text-secondary hover:text-white hover:bg-bg-surface-hover'
                }
              `}
            >
              <Layers size={14} />
              {isBulkMode ? 'Done' : 'Bulk'}
            </button>

            {/* + New Post button */}
            <button
              onClick={handleNewPostClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white
                bg-gradient-to-r from-accent-purple to-accent-cyan
                hover:shadow-glow-purple transition-all"
            >
              <Plus size={16} />
              New Post
            </button>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex flex-wrap gap-2">
          {statPills.map((pill, idx) => {
            const Icon = pill.icon;
            return (
              <motion.div
                key={pill.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.08, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06]
                  bg-bg-surface-raised/50 backdrop-blur-sm hover:bg-bg-surface-hover transition-colors"
              >
                <Icon size={14} className={pill.color} />
                <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-muted">
                  {pill.label}
                </span>
                <span className={`text-sm font-mono font-semibold ${pill.color}`}>
                  {pill.value}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {isBulkMode && selectedPostIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-accent-purple/5 border border-accent-purple/20"
            >
              <span className="text-sm text-accent-purple font-medium">
                {selectedPostIds.length} selected
              </span>
              <div className="flex-1" />
              <button
                onClick={() => handleBulkStatusChange('scheduled')}
                className="px-3 py-1.5 rounded-lg bg-accent-amber/10 text-accent-amber text-xs font-medium
                  hover:bg-accent-amber/20 transition-colors"
              >
                Mark Scheduled
              </button>
              <button
                onClick={() => handleBulkStatusChange('draft')}
                className="px-3 py-1.5 rounded-lg bg-text-muted/10 text-text-secondary text-xs font-medium
                  hover:bg-text-muted/20 transition-colors"
              >
                Mark Draft
              </button>
              <button
                onClick={handleBulkReschedule}
                className="px-3 py-1.5 rounded-lg bg-accent-cyan/10 text-accent-cyan text-xs font-medium
                  hover:bg-accent-cyan/20 transition-colors"
              >
                Reschedule
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 rounded-lg bg-accent-red/10 text-accent-red text-xs font-medium
                  hover:bg-accent-red/20 transition-colors"
              >
                <Trash2 size={12} className="inline mr-1" />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section 2: Calendar View (Week or Month) */}
      <GlassCard noPadding className="p-4">
        <AnimatePresence mode="wait">
          {viewMode === 'week' ? (
            <WeekView
              key="week-view"
              currentDate={currentDate}
              posts={posts}
              onPostClick={handlePostClick}
              onPostMove={handlePostMove}
              onDateClick={switchToWeekView}
              onEmptySlotClick={handleEmptySlotClick}
              selectedPosts={selectedPostIds}
              onSelectPost={isBulkMode ? togglePostSelection : () => {}}
              optimalTimes={optimalTimes}
            />
          ) : (
            <MonthView
              key="month-view"
              currentDate={currentDate}
              posts={posts}
              onPostClick={handlePostClick}
              onWeekClick={switchToWeekView}
              onEmptySlotClick={handleEmptySlotClick}
              onDateChange={setCurrentDate}
            />
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Section 3: Upcoming Posts Timeline */}
      <UpcomingTimeline posts={posts} onPostClick={handlePostClick} />

      {/* Section 4: AI Scheduling Suggestions */}
      <AISuggestionsPanel suggestions={aiSuggestions} onSchedule={handleScheduleSuggestion} />

      {/* Section 5: Platform Post Breakdown */}
      <PlatformBreakdown breakdowns={platformBreakdown} />

      {/* Post Detail Drawer */}
      <PostDetailDrawer
        post={selectedPost}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedPost(null);
        }}
        onDelete={handleDeletePost}
        onReschedule={handleReschedulePost}
        onStatusChange={handleStatusChange}
        onSave={handleSavePost}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreatePost}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        prefilledPlatform={prefilledPlatform}
        prefilledCaption={prefilledCaption}
      />
    </div>
  );
}
