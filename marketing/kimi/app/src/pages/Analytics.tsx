import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Sparkles, ArrowRight,
  ChevronUp, ChevronDown, XCircle, Copy, Check, Zap, BarChart3,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import MetricCard from '@/components/MetricCard';
import PlatformIcon from '@/components/PlatformIcon';
import type { Platform } from '@/components/PlatformIcon';
import ViralScore from '@/components/ViralScore';
import {
  engagementData,
  followerGrowthData,
  heatmapData,
  daysOfWeek,
  timeBlocks,
  topContentData,
  competitorsData,
  aiRecommendations,
  hashtagWords,
  performanceMatrix,
  platformOverviews,
  platformColors,
} from '@/data/mockData';
import type { AnalyticsPlatform } from '@/data/mockData';

const platforms: AnalyticsPlatform[] = ['All', 'X', 'TikTok', 'Instagram', 'YouTube', 'Telegram'];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
};

const staggerItemFast = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
};

const staggerItemHorizontal = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
};

// Custom Tooltip for charts
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A1A26]/95 p-3 backdrop-blur-xl shadow-2xl">
      <p className="mb-2 text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[13px] text-[#9CA3AF]">{entry.name}:</span>
          <span className="text-[13px] font-mono font-semibold text-white">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Section 1: Platform Overview Card
function PlatformOverviewCard({ platform, isActive, onClick }: { platform: AnalyticsPlatform; isActive: boolean; onClick: () => void }) {
  const overview = platform === 'All'
    ? {
        followers: platformOverviews.reduce((s, p) => s + p.followers, 0),
        engagementRate: +(platformOverviews.reduce((s, p) => s + p.engagementRate, 0) / 5).toFixed(1),
        postsThisWeek: platformOverviews.reduce((s, p) => s + p.postsThisWeek, 0),
        growth: +((platformOverviews.reduce((s, p) => s + p.growth, 0) / 5)).toFixed(1),
      }
    : platformOverviews.find((p) => p.platform === platform);

  if (!overview) return null;

  const color = platformColors[platform] || '#8B5CF6';

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left
        backdrop-blur-2xl transition-all duration-300 min-w-[180px] flex-1
        ${isActive ? 'border-[#8B5CF6]/30 shadow-glow-purple' : 'border-white/[0.06] hover:border-white/[0.12]'}
      `}
      style={{ background: isActive ? 'rgba(139,92,246,0.08)' : 'rgba(26, 26, 38, 0.4)' }}
    >
      <div className="flex items-center gap-2">
        {platform === 'All' ? (
          <BarChart3 size={18} style={{ color }} />
        ) : (
          <PlatformIcon platform={platform as Platform} size={18} />
        )}
        <span className="text-[13px] font-medium text-white">{platform === 'All' ? 'All Platforms' : platform}</span>
      </div>
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Followers</span>
          <span className="font-mono text-[18px] font-semibold text-white" style={{ textShadow: `0 0 12px ${color}33` }}>
            {overview.followers}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Eng. Rate</span>
          <span className="font-mono text-[14px] font-medium text-white">{overview.engagementRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Posts/wk</span>
          <span className="font-mono text-[14px] font-medium text-white">{overview.postsThisWeek}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Growth</span>
          <span className={`flex items-center gap-0.5 font-mono text-[12px] font-medium ${overview.growth >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {overview.growth >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {overview.growth}%
          </span>
        </div>
      </div>
      {isActive && (
        <motion.div
          layoutId="platformActiveIndicator"
          className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)' }}
        />
      )}
    </motion.button>
  );
}

// Section 2: Heatmap Cell
function HeatmapCell({ value, dayIdx, timeIdx, isPeak }: { value: number; dayIdx: number; timeIdx: number; isPeak: boolean }) {
  const intensity = value / 100;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: dayIdx * 0.03 + timeIdx * 0.03 }}
      className={`
        group relative flex items-center justify-center rounded-md cursor-pointer
        transition-all duration-200 hover:scale-110 hover:z-10
        ${isPeak ? 'animate-pulse' : ''}
      `}
      style={{
        backgroundColor: `rgba(139, 92, 246, ${0.1 + intensity * 0.7})`,
        minHeight: '36px',
      }}
      title={`${daysOfWeek[dayIdx]} ${timeBlocks[timeIdx]}: ${value}/100`}
    >
      <span className="text-[10px] font-mono font-medium text-white/70">{value}</span>
      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute -top-10 left-1/2 z-20 hidden -translate-x-1/2 rounded-lg border border-white/[0.06] bg-[#1A1A26] px-2 py-1 shadow-xl group-hover:block">
        <span className="whitespace-nowrap text-[11px] font-mono text-white">{daysOfWeek[dayIdx]} {timeBlocks[timeIdx]} — Score: {value}</span>
      </div>
    </motion.div>
  );
}

// Word Cloud Component
function WordCloud({ words, filter }: { words: typeof hashtagWords; filter: string }) {
  const filtered = filter === 'All' ? words : words.filter((w) => w.category === filter);
  const maxVal = Math.max(...filtered.map((w) => w.value));
  const minVal = Math.min(...filtered.map((w) => w.value));

  const getSize = (val: number) => {
    const normalized = (val - minVal) / (maxVal - minVal || 1);
    return 14 + normalized * 34;
  };

  const colors = ['#8B5CF6', '#06B6D4', '#EC4899', '#10B981', '#FFFFFF', '#F59E0B'];

  // Spiral placement algorithm
  const placed: Array<{
    text: string;
    value: number;
    x: number;
    y: number;
    size: number;
    color: string;
    category: string;
    rotation: number;
  }> = [];

  const cloudWidth = 800;
  const cloudHeight = 280;

  filtered.forEach((word, i) => {
    const size = getSize(word.value);
    const angle = i * 0.5 + (i * 2.4); // golden angle approximation
    const radius = 5 + i * 8;
    const x = cloudWidth / 2 + radius * Math.cos(angle) - size * 1.5;
    const y = cloudHeight / 2 + radius * Math.sin(angle) * 0.6;
    const color = colors[i % colors.length];
    const rotation = (i % 3 - 1) * 8;

    placed.push({
      text: word.text,
      value: word.value,
      x: Math.max(10, Math.min(cloudWidth - 100, x)),
      y: Math.max(20, Math.min(cloudHeight - 20, y)),
      size,
      color,
      category: word.category,
      rotation,
    });
  });

  return (
    <div className="relative h-[280px] w-full overflow-hidden">
      <svg viewBox={`0 0 ${cloudWidth} ${cloudHeight}`} className="h-full w-full">
        {placed.map((word, i) => (
          <motion.text
            key={word.text}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: i * 0.04 }}
            x={word.x}
            y={word.y}
            fill={word.color}
            fontSize={word.size}
            fontWeight={word.size > 30 ? 800 : 600}
            transform={`rotate(${word.rotation}, ${word.x}, ${word.y})`}
            className="cursor-pointer select-none transition-all duration-200 hover:opacity-80"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {word.text}
          </motion.text>
        ))}
      </svg>
    </div>
  );
}

export default function Analytics() {
  const [selectedPlatform, setSelectedPlatform] = useState<AnalyticsPlatform>('All');
  const [hashtagFilter, setHashtagFilter] = useState('All');
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const toggleHashtag = useCallback((tag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const copyHashtags = useCallback(() => {
    navigator.clipboard.writeText(selectedHashtags.join(', '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedHashtags]);

  const getActiveLineOpacity = (platformName: string) => {
    if (selectedPlatform === 'All') return 1;
    return selectedPlatform === platformName ? 1 : 0.3;
  };

  const getActiveLineWidth = (platformName: string) => {
    if (selectedPlatform === 'All') return 2;
    return selectedPlatform === platformName ? 3 : 1.5;
  };

  // Peak times for highlighting
  const peakCells: Array<[number, number]> = [
    [0, 5], // Mon 20-24
    [2, 5], // Wed 20-24
    [4, 4], // Fri 16-20
    [5, 3], // Sat 12-16
    [6, 5], // Sun 20-24
  ];

  const isPeak = (dayIdx: number, timeIdx: number) =>
    peakCells.some(([d, t]) => d === dayIdx && t === timeIdx);

  return (
    <div className="space-y-8 pb-12">
      {/* Ambient Gradient Orbs */}
      <div
        className="pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 h-[500px] w-[500px] opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}
      />

      {/* Section 1: Platform Selector + Overview Cards */}
      <motion.section variants={staggerContainer} initial="initial" animate="animate" className="relative z-10 space-y-6">
        <motion.div variants={staggerItem}>
          <h1 className="font-orbitron text-3xl font-bold tracking-tight text-white mb-2">Analytics</h1>
          <p className="text-[13px] text-[#6B7280]">Deep-dive analytics across all platforms</p>
        </motion.div>

        {/* Platform Selector */}
        <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPlatform(p)}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium
                transition-all duration-250
                ${selectedPlatform === p
                  ? 'bg-[#1A1A26] text-white border-b-2 border-[#8B5CF6]'
                  : 'text-[#6B7280] hover:text-[#9CA3AF] hover:bg-[#1A1A26]/50'
                }
              `}
            >
              {p === 'All' ? <BarChart3 size={16} className="text-[#8B5CF6]" /> : <PlatformIcon platform={p as Platform} size={16} />}
              {p === 'All' ? 'All Platforms' : p}
            </button>
          ))}
        </motion.div>

        {/* Platform Overview Cards */}
        <motion.div variants={staggerItem} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {platforms.map((p) => (
            <PlatformOverviewCard
              key={p}
              platform={p}
              isActive={selectedPlatform === p}
              onClick={() => setSelectedPlatform(p)}
            />
          ))}
        </motion.div>

        {/* Key Metrics Row */}
        <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="TOTAL FOLLOWERS" value="176" delta="+12%" deltaPositive sparkline={[65,68,72,70,75,78,82,80,85,88,86,90,92,94,96]} index={0} />
          <MetricCard label="AVG ENGAGEMENT" value="4.3%" delta="+0.8%" deltaPositive sparkline={[3.2,3.3,3.5,3.4,3.6,3.8,3.9,4.0,4.1,4.2,4.1,4.3,4.3,4.4,4.3]} index={1} />
          <MetricCard label="POSTS THIS WEEK" value="8" delta="+3" deltaPositive sparkline={[4,5,4,6,5,7,6,8,7,9,8,8,9,8,8]} index={2} />
          <MetricCard label="AVG POST REACH" value="324" delta="+23%" deltaPositive sparkline={[200,210,225,230,245,255,265,275,280,295,300,310,315,320,324]} index={3} />
        </motion.div>
      </motion.section>

      {/* Section 2: Engagement Rate Chart + Best Posting Times Heatmap */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10 grid gap-6 lg:grid-cols-[3fr_2fr]"
      >
        <motion.div variants={staggerItem}>
          <GlassCard title="Engagement Rate — 30 Day Trend" subtitle="Platform engagement over the last 30 days">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} unit="%" domain={[0, 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  {selectedPlatform === 'All' ? (
                    <>
                      <Area type="monotone" dataKey="X" stroke="#9CA3AF" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                      <Area type="monotone" dataKey="TikTok" stroke="#EC4899" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                      <Area type="monotone" dataKey="Instagram" stroke="#E4405F" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                      <Area type="monotone" dataKey="YouTube" stroke="#FF0000" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                      <Area type="monotone" dataKey="Telegram" stroke="#26A5E4" strokeWidth={1.5} fillOpacity={0} fill="transparent" />
                    </>
                  ) : (
                    <Area
                      type="monotone"
                      dataKey={selectedPlatform}
                      stroke={platformColors[selectedPlatform]}
                      strokeWidth={2}
                      fill={`url(#engagementGrad)`}
                    />
                  )}
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <GlassCard title="Best Posting Times" subtitle="Based on engagement data from your audience">
            {/* Day labels */}
            <div className="mb-2 grid grid-cols-8 gap-1">
              <div />
              {daysOfWeek.map((d) => (
                <div key={d} className="text-center text-[10px] font-mono font-medium text-[#6B7280]">{d}</div>
              ))}
            </div>
            {/* Heatmap grid */}
            <div className="space-y-1">
              {timeBlocks.map((time, timeIdx) => (
                <div key={time} className="grid grid-cols-8 gap-1 items-center">
                  <div className="text-[10px] font-mono text-[#6B7280]">{time}</div>
                  {daysOfWeek.map((_, dayIdx) => (
                    <HeatmapCell
                      key={`${dayIdx}-${timeIdx}`}
                      value={heatmapData[dayIdx][timeIdx]}
                      dayIdx={dayIdx}
                      timeIdx={timeIdx}
                      isPeak={isPeak(dayIdx, timeIdx)}
                    />
                  ))}
                </div>
              ))}
            </div>
            {/* Legend */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-[#6B7280]">Low</span>
              <div className="h-2 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.1), rgba(139,92,246,0.8))' }} />
              <span className="text-[10px] text-[#6B7280]">High</span>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 3: Follower Growth Chart + Top Content */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10 grid gap-6 lg:grid-cols-[3fr_2fr]"
      >
        <motion.div variants={staggerItem}>
          <GlassCard title="Follower Growth — 90 Days" subtitle="Weekly follower count across all platforms">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={followerGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="X" stroke="#9CA3AF" strokeWidth={getActiveLineWidth('X')} dot={false} activeDot={{ r: 4, fill: '#9CA3AF' }} strokeOpacity={getActiveLineOpacity('X')} />
                  <Line type="monotone" dataKey="TikTok" stroke="#EC4899" strokeWidth={getActiveLineWidth('TikTok')} dot={false} activeDot={{ r: 4, fill: '#EC4899' }} strokeOpacity={getActiveLineOpacity('TikTok')} />
                  <Line type="monotone" dataKey="Instagram" stroke="#E4405F" strokeWidth={getActiveLineWidth('Instagram')} dot={false} activeDot={{ r: 4, fill: '#E4405F' }} strokeOpacity={getActiveLineOpacity('Instagram')} />
                  <Line type="monotone" dataKey="YouTube" stroke="#FF0000" strokeWidth={getActiveLineWidth('YouTube')} dot={false} activeDot={{ r: 4, fill: '#FF0000' }} strokeOpacity={getActiveLineOpacity('YouTube')} />
                  <Line type="monotone" dataKey="Telegram" stroke="#26A5E4" strokeWidth={getActiveLineWidth('Telegram')} dot={false} activeDot={{ r: 4, fill: '#26A5E4' }} strokeOpacity={getActiveLineOpacity('Telegram')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <GlassCard title="Top Performing Content" subtitle="What worked and why">
            <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="space-y-3">
              {topContentData.slice(0, 5).map((content) => (
                <motion.div
                  key={content.id}
                  variants={staggerItemFast}
                  whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.6)' }}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.04] p-3 transition-colors"
                >
                  {/* Thumbnail placeholder */}
                  <div className="flex h-[50px] w-[70px] flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6]/20 to-[#06B6D4]/20">
                    <PlatformIcon platform={content.platform as Platform} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">{content.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ backgroundColor: `${platformColors[content.platform]}22`, color: platformColors[content.platform] }}>
                        {content.platform}
                      </span>
                      <span className="text-[11px] text-[#6B7280]">{content.type}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="font-mono text-[11px] text-[#9CA3AF]">{content.views.toLocaleString()} views</span>
                      <span className="font-mono text-[11px] text-[#9CA3AF]">{content.engagement} eng.</span>
                      <ViralScore score={content.viralScore} size={28} />
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#06B6D4]">{content.aiInsight}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 4: Competitor Tracking */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10 space-y-4"
      >
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-white">Competitor Intelligence</h2>
          <button className="flex items-center gap-1 text-[13px] font-medium text-[#06B6D4] transition-colors hover:text-[#06B6D4]/80">
            View Full Report <ArrowRight size={14} />
          </button>
        </motion.div>

        <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {competitorsData.map((comp, i) => {
            const initials = comp.name.charAt(0);
            const sparklinePath = () => {
              if (comp.sparkline.length === 0) return '';
              const width = 60;
              const height = 24;
              const min = Math.min(...comp.sparkline);
              const max = Math.max(...comp.sparkline);
              const range = max - min || 1;
              const points = comp.sparkline.map((v, idx) => {
                const x = (idx / (comp.sparkline.length - 1)) * width;
                const y = height - ((v - min) / range) * height;
                return `${x},${y}`;
              });
              return `M ${points.join(' L ')}`;
            };
            return (
              <motion.div
                key={comp.id}
                variants={staggerItem}
                whileHover={{ y: -2, borderColor: 'rgba(245, 158, 11, 0.3)' }}
                className="rounded-2xl border border-white/[0.06] p-5 backdrop-blur-2xl transition-all duration-300 hover:shadow-glow-purple"
                style={{ background: 'rgba(26, 26, 38, 0.4)' }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-4 right-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)' }} />
                <div className="pt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{comp.name}</h3>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{comp.category}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Followers</p>
                    <p className="font-mono text-[16px] font-semibold text-white">{comp.followers}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Engagement</p>
                    <p className="font-mono text-[16px] font-semibold text-white">{comp.engagement}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Posts/wk</p>
                    <p className="font-mono text-[16px] font-semibold text-white">{comp.postsPerWeek}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Growth</p>
                    <span className="flex items-center gap-0.5 font-mono text-[14px] font-medium text-accent-green">
                      <ChevronUp size={14} /> {comp.growth}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[11px] font-mono text-[#6B7280]">Last active: {comp.lastActive}</p>
                  <svg width="60" height="24">
                    <defs>
                      <linearGradient id={`compSpark-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${sparklinePath()} L 60,24 L 0,24 Z`} fill={`url(#compSpark-${i})`} />
                    <path d={sparklinePath()} fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.section>

      {/* Section 5: AI Content Recommendations */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard glowColor="purple" noPadding className="p-6">
            {/* Card Header */}
            <div className="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <Sparkles size={20} className="text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-white">AI Content Recommendations</h2>
                  <p className="text-[11px] font-mono text-[#6B7280]">Based on trends and your audience data</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-green" />
                </span>
                <span className="text-[11px] font-mono text-accent-green">AI Online</span>
                <span className="text-[11px] font-mono text-[#6B7280]">· Updated 10m ago</span>
              </div>
            </div>

            <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiRecommendations.map((rec) => {
                const sparklinePath = () => {
                  const width = 60;
                  const height = 20;
                  const min = Math.min(...rec.trendSparkline);
                  const max = Math.max(...rec.trendSparkline);
                  const range = max - min || 1;
                  const points = rec.trendSparkline.map((v, idx) => {
                    const x = (idx / (rec.trendSparkline.length - 1)) * width;
                    const y = height - ((v - min) / range) * height;
                    return `${x},${y}`;
                  });
                  return `M ${points.join(' L ')}`;
                };
                return (
                  <motion.div
                    key={rec.id}
                    variants={staggerItem}
                    whileHover={{ y: -2 }}
                    className="rounded-xl border border-white/[0.06] p-4 backdrop-blur-2xl transition-all duration-300"
                    style={{ background: 'rgba(26, 26, 38, 0.4)', borderLeft: '4px solid #8B5CF6' }}
                  >
                    {/* Confidence Badge */}
                    <div className="mb-2 inline-flex items-center rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(139,92,246,0.15)' }}>
                      <span className="text-[11px] font-semibold text-[#8B5CF6]">{rec.confidence}% confidence</span>
                    </div>
                    <h3 className="text-[15px] font-semibold text-white">{rec.title}</h3>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-[#9CA3AF]">{rec.description}</p>
                    {/* Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {rec.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#9CA3AF]">{tag}</span>
                      ))}
                    </div>
                    {/* Action + Sparkline */}
                    <div className="mt-3 flex items-center justify-between">
                      <button className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-[#9CA3AF] transition-all hover:border-[#8B5CF6]/20 hover:bg-[#1E1E2D] hover:text-white">
                        <Zap size={12} /> {rec.action}
                      </button>
                      <svg width="60" height="20">
                        <defs>
                          <linearGradient id={`recSpark-${rec.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={`${sparklinePath()} L 60,20 L 0,20 Z`} fill={`url(#recSpark-${rec.id})`} />
                        <path d={sparklinePath()} fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 6: Trending Hashtags Word Cloud */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard title="Trending Hashtags — Web3 Gaming">
            {/* Category Filters */}
            <div className="mb-4 flex flex-wrap gap-2">
              {['All', 'Gaming', 'Meme', 'Crypto', 'Solana'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setHashtagFilter(cat)}
                  className={`
                    rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200
                    ${hashtagFilter === cat
                      ? 'bg-[#06B6D4] text-white'
                      : 'bg-white/[0.04] text-[#9CA3AF] hover:bg-white/[0.08] hover:text-white'
                    }
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>

            <WordCloud words={hashtagWords} filter={hashtagFilter} />

            {/* Selected Hashtags Bar */}
            {selectedHashtags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4"
              >
                <span className="text-[11px] font-mono text-[#6B7280]">Selected:</span>
                {selectedHashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleHashtag(tag)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#8B5CF6]/15 px-2.5 py-1 text-[11px] font-medium text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/25"
                  >
                    {tag} <XCircle size={12} />
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={copyHashtags}
                    className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] transition-all hover:border-[#8B5CF6]/20 hover:text-white"
                  >
                    {copied ? <Check size={12} className="text-accent-green" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy All'}
                  </button>
                  <button onClick={() => setSelectedHashtags([])} className="text-[11px] font-medium text-[#6B7280] transition-colors hover:text-white">
                    Clear All
                  </button>
                </div>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 7: Cross-Platform Performance Matrix */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard title="Cross-Platform Performance">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Platform</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Followers</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Engagement</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Posts/Wk</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Avg Reach</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Growth</th>
                  </tr>
                </thead>
                <motion.tbody variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
                  {performanceMatrix.map((row) => {
                    return (
                      <motion.tr
                        key={row.platform}
                        variants={staggerItemHorizontal}
                        whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.5)' }}
                        className="border-b border-white/[0.04] transition-colors"
                      >
                        <td className="flex items-center gap-2 py-3">
                          <PlatformIcon platform={row.platform as Platform} size={18} />
                          <span className="text-[14px] font-medium text-white">{row.platform}</span>
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{row.followers}</td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{row.engagement}</td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{row.postsPerWeek}</td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{row.avgReach}</td>
                        <td className="py-3 text-right">
                          <span className={`inline-flex items-center gap-0.5 font-mono text-[12px] font-medium ${row.growthPositive ? 'text-accent-green' : 'text-accent-red'}`}>
                            {row.growthPositive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {row.growth}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="border-t-2 border-white/[0.08]">
                    <td className="py-3 text-[14px] font-bold text-white">TOTAL/AVG</td>
                    <td className="py-3 text-right font-mono text-[13px] font-bold text-white">176</td>
                    <td className="py-3 text-right font-mono text-[13px] font-bold text-white">4.3%</td>
                    <td className="py-3 text-right font-mono text-[13px] font-bold text-white">8</td>
                    <td className="py-3 text-right font-mono text-[13px] font-bold text-white">324</td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center gap-0.5 font-mono text-[12px] font-bold text-accent-green">
                        <ChevronUp size={12} /> +23%
                      </span>
                    </td>
                  </tr>
                </motion.tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>
    </div>
  );
}
