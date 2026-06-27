import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import {
  Upload, Play, ChevronRight, TrendingUp, ArrowUpRight,
} from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import GlassCard from '@/components/GlassCard';
import PlatformIcon from '@/components/PlatformIcon';
import type { Platform } from '@/components/PlatformIcon';
import StatusBadge from '@/components/StatusBadge';
import ViralScore from '@/components/ViralScore';
import GradientButton from '@/components/GradientButton';
import ParticleNetwork from '@/components/ParticleNetwork';
import {
  heroMetrics, growthData, dauData, viralClips, calendarDays, marketIntel,
} from '@/data/mockData';

// Easing
const easeOut = [0, 0, 0.2, 1] as [number, number, number, number];

// Get greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
};

// Platform colors for chart
const platformColors: Record<string, string> = {
  x: '#9CA3AF',
  tiktok: '#EC4899',
  instagram: '#E4405F',
  youtube: '#FF0000',
  telegram: '#26A5E4',
};

// Custom chart tooltip
const GrowthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-xl border border-white/[0.08] p-3 backdrop-blur-xl"
      style={{ background: 'rgba(18, 18, 26, 0.95)' }}
    >
      <p className="text-text-muted text-xs mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: entry.color }}
            />
            <span className="text-white text-xs capitalize">{entry.name}:</span>
            <span className="text-white text-xs font-mono font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Viral Clips Section
const ViralClipsSection = () => {
  return (
    <GlassCard
      title="Recently Generated Viral Clips"
      subtitle=""
      className="flex-1"
    >
      <div className="flex items-center justify-between mb-4">
        <div />
        <Link
          to="/video-hub"
          className="text-accent-cyan text-sm font-medium hover:underline flex items-center gap-1 transition-colors"
        >
          View All <ChevronRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {viralClips.slice(0, 3).map((clip, idx) => (
          <motion.div
            key={clip.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * idx, ease: easeOut }}
            whileHover={{ scale: 1.03 }}
            className="
              group relative rounded-xl overflow-hidden cursor-pointer
              border border-white/[0.06] hover:border-accent-purple/30
              transition-all duration-300
            "
            style={{ background: 'rgba(26, 26, 38, 0.5)' }}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
              <img
                src={clip.thumbnail}
                alt={clip.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Dark overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

              {/* Play button - appears on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                  <Play size={20} className="text-white ml-1" fill="white" />
                </div>
              </div>

              {/* Duration badge */}
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60">
                <span className="text-[11px] font-mono text-text-secondary">{clip.duration}</span>
              </div>

              {/* Viral score ring - bottom right */}
              <div className="absolute bottom-2 right-2">
                <ViralScore score={clip.viralScore} size={40} />
              </div>
            </div>

            {/* Info section */}
            <div className="p-3">
              <h4 className="text-white text-[13px] font-semibold mb-2 truncate">
                {clip.title}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {clip.platforms.map((p) => (
                    <PlatformIcon key={p} platform={p as Platform} size={14} />
                  ))}
                </div>
                <StatusBadge status={clip.status} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
};

// Upload Zone Section
const UploadSection = () => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: easeOut }}
    >
      <GlassCard className="flex flex-col lg:flex-row items-center gap-6">
        {/* Left - Text */}
        <div className="flex-1 space-y-3">
          <h3 className="text-white text-xl font-semibold">
            Drop a Gameplay Clip
          </h3>
          <p className="text-text-secondary text-sm">
            AI will detect highlights, predict virality, and format for every platform
          </p>
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GradientButton
              icon={<Upload size={16} />}
              onClick={() => { window.location.href = '/video-hub'; }}
            >
              Upload Video
            </GradientButton>
          </motion.div>
        </div>

        {/* Right - Drop zone */}
        <Link
          to="/video-hub"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); }}
          className={`
            w-full lg:w-[280px] h-[120px] flex flex-col items-center justify-center
            rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer
            ${isDragOver
              ? 'border-accent-purple bg-accent-purple/8 scale-[1.02]'
              : 'border-accent-purple/30 hover:border-accent-purple/60 bg-accent-purple/[0.02]'
            }
          `}
        >
          <Upload size={28} className="text-accent-purple mb-2" />
          <span className="text-text-secondary text-xs">or drag & drop here</span>
          <span className="text-text-muted text-[10px] mt-1">MP4, MOV, MKV up to 2GB</span>
        </Link>
      </GlassCard>
    </motion.div>
  );
};

// Calendar Strip Section
const CalendarStrip = () => {
  const platformDotColors: Record<string, string> = {
    X: '#9CA3AF',
    TikTok: '#EC4899',
    Instagram: '#E4405F',
    YouTube: '#FF0000',
    Telegram: '#26A5E4',
  };

  return (
    <GlassCard
      title="This Week's Schedule"
      className="flex-1"
    >
      <div className="flex items-center justify-between mb-4">
        <div />
        <Link
          to="/calendar"
          className="text-accent-cyan text-sm font-medium hover:underline flex items-center gap-1 transition-colors"
        >
          Open Calendar <ChevronRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, idx) => (
          <motion.div
            key={day.day}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * idx, ease: easeOut }}
            whileHover={{ scale: 1.02 }}
            className={`
              rounded-xl p-2 text-center cursor-pointer transition-all duration-200
              ${day.isToday
                ? 'border border-accent-cyan/50 bg-accent-cyan/5'
                : 'border border-transparent hover:bg-bg-surface-hover'
              }
            `}
          >
            {/* Day label */}
            <p className="text-[11px] font-mono text-text-muted mb-1.5">
              {day.day} {day.date}
            </p>

            {/* Post count badge */}
            {day.posts > 0 ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 + idx * 0.05, type: 'spring', stiffness: 500 }}
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center mx-auto mb-1.5
                  text-[11px] font-mono font-semibold
                  ${day.isToday ? 'bg-accent-cyan text-black' : 'bg-accent-amber text-white'}
                `}
              >
                {day.posts}
              </motion.div>
            ) : (
              <div className="w-7 h-7 mx-auto mb-1.5" />
            )}

            {/* Platform icons */}
            <div className="flex items-center justify-center gap-0.5 min-h-[16px]">
              {day.platforms.slice(0, 3).map((p) => (
                <PlatformIcon key={p} platform={p as Platform} size={12} />
              ))}
            </div>

            {/* Post dots */}
            {day.posts > 0 && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {day.platforms.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05, type: 'spring' }}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: platformDotColors[p] || '#6B7280' }}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
};

// Market Intel Section
const MarketIntelSection = () => {
  const badgeColorMap: Record<string, string> = {
    pink: 'bg-accent-pink/15 text-accent-pink',
    amber: 'bg-accent-amber/15 text-accent-amber',
    cyan: 'bg-accent-cyan/15 text-accent-cyan',
    purple: 'bg-accent-purple/15 text-accent-purple',
  };

  const glowBorderMap: Record<string, string> = {
    pink: 'hover:border-accent-pink/30 hover:shadow-glow-pink',
    amber: 'hover:border-accent-amber/30 hover:shadow-glow-amber',
    cyan: 'hover:border-accent-cyan/30 hover:shadow-glow-cyan',
    purple: 'hover:border-accent-purple/30 hover:shadow-glow-purple',
  };

  return (
    <div>
      <h2 className="text-white text-xl font-semibold mb-4">
        Market Intelligence — Web3 Gaming 2026
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {marketIntel.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 * idx, ease: easeOut }}
            whileHover={{ y: -2 }}
            className={`
              rounded-2xl border border-white/[0.06] p-5 cursor-pointer
              backdrop-blur-xl transition-all duration-300
              ${glowBorderMap[item.badgeColor]}
            `}
            style={{ background: 'rgba(26, 26, 38, 0.4)' }}
          >
            {/* Category badge */}
            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.08em] uppercase mb-3 ${badgeColorMap[item.badgeColor]}`}>
              {item.badge}
            </span>

            {/* Headline */}
            <h4 className="text-white text-[15px] font-semibold leading-snug mb-2 line-clamp-2">
              {item.headline}
            </h4>

            {/* Data snippet */}
            <p className="font-mono text-[12px] text-text-secondary mb-3">
              {item.data}
            </p>

            {/* Bottom row */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-text-muted">
                Updated {item.updatedAgo}
              </span>
              {item.trend === 'up' ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + idx * 0.1, type: 'spring' }}
                >
                  <ArrowUpRight size={16} className="text-accent-green" />
                </motion.span>
              ) : (
                <TrendingUp size={16} className="text-accent-red rotate-180" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Dashboard Page ───
export default function Home() {
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      {/* Ambient gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full animate-glow-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full animate-glow-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animationDelay: '1s',
          }}
        />
      </div>

      {/* SECTION 1 & 2: Hero with Particle Network */}
      <section className="relative rounded-2xl overflow-hidden" style={{ minHeight: '220px' }}>
        <ParticleNetwork />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-6">
          {/* Welcome text */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
            className="space-y-2"
          >
            <h1 className="font-orbitron text-3xl lg:text-5xl font-bold text-white tracking-tight">
              {greeting}, Commander
            </h1>
            <p className="text-text-secondary text-base lg:text-lg">
              Your AI content engine is running.{` `}
              <span className="text-accent-cyan">3 viral moments</span> detected today.
            </p>
            {/* AI Status Pill - mobile visible */}
            <div className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20 w-fit mt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
              </span>
              <span className="text-[11px] font-mono font-medium text-accent-green">
                AI Engine Online
              </span>
            </div>
          </motion.div>

          {/* Quick Stats Row */}
          <div className="flex flex-wrap gap-4">
            {heroMetrics.map((metric, idx) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                delta={metric.delta}
                deltaPositive={metric.deltaPositive}
                sparkline={metric.sparkline}
                index={idx}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: Growth Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 relative z-10">
        {/* Combined Platform Growth - 60% */}
        <div className="lg:col-span-3">
          <GlassCard title="Follower Growth — All Platforms">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    {Object.entries(platformColors).map(([key, color]) => (
                      <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<GrowthTooltip />} />
                  {Object.entries(platformColors).map(([key, color]) => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={color}
                      strokeWidth={2}
                      fill={`url(#gradient-${key})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
              {Object.entries(platformColors).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] text-text-secondary capitalize">
                    {key === 'x' ? 'X' : key}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Game DAU - 40% */}
        <div className="lg:col-span-2">
          <GlassCard title="Game DAU (7 Days)">
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dauData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div
                          className="rounded-xl border border-white/[0.08] p-3 backdrop-blur-xl"
                          style={{ background: 'rgba(18, 18, 26, 0.95)' }}
                        >
                          <p className="text-white text-xs font-medium">{data.day}</p>
                          <p className="text-accent-cyan text-xs font-mono mt-1">
                            {data.dau} players
                          </p>
                          <p className={`text-[10px] font-mono mt-0.5 ${data.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {data.change >= 0 ? '+' : ''}{data.change} from prev
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="dau"
                    fill="url(#dauGradient)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* SECTION 4: Recent Viral Clips */}
      <section className="relative z-10">
        <ViralClipsSection />
      </section>

      {/* SECTION 5 & 6: Upload + Calendar */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        <UploadSection />
        <CalendarStrip />
      </section>

      {/* SECTION 7: Market Intelligence */}
      <section className="relative z-10">
        <MarketIntelSection />
      </section>
    </div>
  );
}
