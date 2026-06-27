import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Brain, TrendingUp, Sparkles, ArrowRight, Search, Eye,
  RefreshCw, Filter, ChevronUp, ChevronDown, Bookmark,
  Flag, Mail, Edit, Trash2, Plus, Download,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import MetricCard from '@/components/MetricCard';
import PlatformIcon from '@/components/PlatformIcon';
import type { Platform } from '@/components/PlatformIcon';
import ViralScore from '@/components/ViralScore';
import {
  marketOverviewMetrics,
  trendingTopicsData,
  narrativeData,
  competitorActivityData,
  memeCoinsData,
  memeMentionsData,
  kolDatabase,
  newsData,
} from '@/data/mockData';

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

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A1A26]/95 p-3 backdrop-blur-xl shadow-2xl">
      <p className="mb-2 text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[13px] text-[#9CA3AF]">{entry.name}:</span>
          <span className="text-[13px] font-mono font-semibold text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// Activity type colors
const activityTypeColors: Record<string, string> = {
  Launch: '#10B981',
  Partnership: '#8B5CF6',
  Content: '#06B6D4',
  Update: '#F59E0B',
};

// Status config for KOL table
const statusConfig: Record<string, { color: string; bgColor: string }> = {
  'Active': { color: '#10B981', bgColor: 'rgba(16,185,129,0.15)' },
  'In Negotiation': { color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.15)' },
  'Contacted': { color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)' },
  'Declined': { color: '#EF4444', bgColor: 'rgba(239,68,68,0.15)' },
};

const nicheColors: Record<string, string> = {
  'Gaming': '#8B5CF6',
  'Memes': '#EC4899',
  'Solana': '#06B6D4',
  'Crypto': '#F59E0B',
  'NFTs': '#10B981',
};

export default function MarketIntel() {
  const [prediction, setPrediction] = useState<{
    score: number;
    confidence: number;
    range: [number, number];
    factors: Array<{ name: string; score: number }>;
    suggestions: string[];
    interpretation: string;
    context: string;
  } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [kolFilter, setKolFilter] = useState('All');
  const [activityFilter, setActivityFilter] = useState('All');
  const [newsFilter, setNewsFilter] = useState('All');

  const [predictionForm, setPredictionForm] = useState({
    contentType: 'Video',
    platform: 'X',
    character: 'PEPE',
    momentType: 'Clutch',
  });

  const handlePredict = useCallback(() => {
    setIsPredicting(true);
    setTimeout(() => {
      const baseScores: Record<string, number> = { Video: 75, Image: 65, Text: 55, Meme: 85 };
      const platformMultipliers: Record<string, number> = { X: 1.1, TikTok: 1.15, Instagram: 0.95, YouTube: 1.0, Telegram: 0.85 };
      const charBoosts: Record<string, number> = { PEPE: 12, DOGE: 8, MUSK: 10, Generic: 0 };
      const momentBoosts: Record<string, number> = { Kill: 5, Clutch: 15, Escape: 10, Win: 8, Funny: 12, Tutorial: 3 };

      const base = baseScores[predictionForm.contentType] || 60;
      const pm = platformMultipliers[predictionForm.platform] || 1;
      const cb = charBoosts[predictionForm.character] || 0;
      const mb = momentBoosts[predictionForm.momentType] || 0;
      const score = Math.min(98, Math.round(base * pm + cb + mb));
      const range: [number, number] = [Math.max(0, score - 6), Math.min(100, score + 6)];

      setPrediction({
        score,
        confidence: Math.round(75 + Math.random() * 20),
        range,
        factors: [
          { name: 'Action Appeal', score: Math.round(70 + Math.random() * 25) },
          { name: 'Character Popularity', score: Math.round(65 + Math.random() * 30) },
          { name: 'Platform Fit', score: Math.round(60 + Math.random() * 35) },
          { name: 'Timing Score', score: Math.round(68 + Math.random() * 25) },
          { name: 'Hashtag Power', score: Math.round(55 + Math.random() * 30) },
        ],
        suggestions: [
          `Switch to PEPE character (+${Math.round(Math.random() * 8 + 8)} points)`,
          `Post at 8 PM Wednesday (+${Math.round(Math.random() * 6 + 5)} points)`,
          `Add #Web3Gaming hashtag (+${Math.round(Math.random() * 4 + 3)} points)`,
        ],
        interpretation: score > 80
          ? 'High viral potential — strong action moment with trending character'
          : score > 60
            ? 'Moderate viral potential — good content with room for optimization'
            : 'Lower viral potential — consider changing key parameters',
        context: `This score is in the top ${Math.max(5, 100 - score)}% of predicted clips. Similar clips averaged ${(score * 30).toLocaleString()} views on ${predictionForm.platform}.`,
      });
      setIsPredicting(false);
    }, 1200);
  }, [predictionForm]);

  const filteredKOL = kolFilter === 'All' ? kolDatabase : kolDatabase.filter((k) => k.status === kolFilter);
  const filteredActivity = activityFilter === 'All'
    ? competitorActivityData
    : competitorActivityData.filter((a) => a.competitor === activityFilter);
  const filteredNews = newsFilter === 'All' ? newsData : newsData.filter((n) => n.source === newsFilter);

  const activityFilters = ['All', 'Bomb Crypto', 'SOL Arena', 'Catizen', 'Notcoin'];
  const newsFilters = ['All', 'DappRadar', 'Decrypt', 'Twitter', 'Discord'];

  return (
    <div className="space-y-8 pb-12">
      {/* Ambient Gradient Orbs */}
      <div
        className="pointer-events-none fixed right-0 top-0 h-[600px] w-[600px] opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 h-[500px] w-[500px] opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', filter: 'blur(80px)', zIndex: 0 }}
      />

      {/* Section 1: Market Overview Hero */}
      <motion.section variants={staggerContainer} initial="initial" animate="animate" className="relative z-10 space-y-6">
        <motion.div variants={staggerItem}>
          <h1 className="font-orbitron text-3xl font-bold tracking-tight text-white mb-2">Market Intel</h1>
          <p className="text-[13px] text-[#6B7280]">Strategic intelligence hub for Web3 gaming</p>
        </motion.div>

        <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {marketOverviewMetrics.map((m, i) => (
            <MetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              delta={m.delta}
              deltaPositive={m.deltaPositive}
              sparkline={m.sparkline}
              index={i}
            />
          ))}
        </motion.div>
      </motion.section>

      {/* Section 2: Trending Topics & Narrative Tracker */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10 grid gap-6 lg:grid-cols-2"
      >
        {/* Trending Topics */}
        <motion.div variants={staggerItem}>
          <GlassCard
            title="Trending Topics"
            subtitle="What's moving the market"
            glowColor="purple"
          >
            <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="space-y-3">
              {trendingTopicsData.map((topic) => (
                <motion.div
                  key={topic.id}
                  variants={staggerItemFast}
                  whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.5)' }}
                  className="flex items-start gap-4 rounded-xl border border-white/[0.04] p-4 transition-colors"
                >
                  <span className="flex w-10 flex-shrink-0 items-center justify-center font-mono text-[28px] font-bold text-[#6B7280]">
                    {topic.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-white">{topic.name}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[#9CA3AF]">{topic.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topic.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#9CA3AF]">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <svg width="60" height="24">
                      <defs>
                        <linearGradient id={`topicSpark-${topic.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M 0,${24 - (topic.sparkline[0] / 150) * 24} ${topic.sparkline.slice(1).map((v, i) => `L ${(i + 1) * (60 / (topic.sparkline.length - 1))},${24 - (v / 150) * 24}`).join(' ')}`}
                        fill={`url(#topicSpark-${topic.id})`}
                      />
                      <path
                        d={`M 0,${24 - (topic.sparkline[0] / 150) * 24} ${topic.sparkline.slice(1).map((v, i) => `L ${(i + 1) * (60 / (topic.sparkline.length - 1))},${24 - (v / 150) * 24}`).join(' ')}`}
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="flex items-center gap-0.5 font-mono text-[13px] font-semibold text-accent-green">
                      <ChevronUp size={14} /> +{topic.trend}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </GlassCard>
        </motion.div>

        {/* Narrative Tracker */}
        <motion.div variants={staggerItem}>
          <GlassCard title="Narrative Momentum" subtitle="Topic interest over 90 days">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={narrativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="AI Agent" stroke="#8B5CF6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="PolitiFi" stroke="#EC4899" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="SocialFi" stroke="#06B6D4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="NFT-Community" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 3: Competitor Activity Feed */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard
            title="Competitor Activity Feed"
            subtitle="Live monitoring of competitor actions"
            glowColor="cyan"
          >
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-green" />
                </span>
                <span className="rounded-full bg-accent-green/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-green">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-[#6B7280]" />
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="rounded-lg border border-white/[0.06] bg-[#1A1A26] px-3 py-1.5 text-[12px] text-white outline-none transition-colors focus:border-[#8B5CF6]/40"
                >
                  {activityFilters.map((f) => (
                    <option key={f} value={f}>{f === 'All' ? 'All Competitors' : f}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Activity List */}
            <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
              <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
                {filteredActivity.map((activity) => (
                  <motion.div
                    key={activity.id}
                    variants={staggerItemFast}
                    whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.5)' }}
                    className="flex items-center gap-4 rounded-lg border-b border-white/[0.04] px-3 py-3 transition-colors"
                  >
                    {/* Competitor Avatar */}
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
                    >
                      {activity.competitor.charAt(0)}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white">
                        <span className="text-[#8B5CF6]">{activity.competitor}</span> {activity.action}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[#6B7280]">{activity.time}</span>
                        <span className="text-[11px] font-mono text-[#6B7280]">·</span>
                        <span className="text-[11px] font-mono text-[#6B7280]">Twitter/X</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activity.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${activityTypeColors[activity.type]}22`,
                              color: activityTypeColors[activity.type],
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-white">
                        <Eye size={16} />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-white">
                        <Bookmark size={16} />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-white">
                        <Flag size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 4: Meme Coin Tracker */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10 grid gap-6 lg:grid-cols-2"
      >
        {/* Coin Price Cards */}
        <motion.div variants={staggerItem}>
          <GlassCard title="Meme Coin Tracker" subtitle="Real-time meme coin prices">
            <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="space-y-3">
              {memeCoinsData.map((coin) => (
                <motion.div
                  key={coin.id}
                  variants={staggerItemFast}
                  whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.5)' }}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.04] p-4 transition-colors"
                >
                  {/* Coin Icon */}
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white"
                    style={{ backgroundColor: coin.color }}
                  >
                    {coin.symbol}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-white">{coin.name}</h3>
                    <p className="font-mono text-[16px] font-semibold text-white">{coin.price}</p>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-0.5 font-mono text-[12px] font-medium ${coin.priceChange >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {coin.priceChange >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {coin.priceChange >= 0 ? '+' : ''}{coin.priceChange}%
                      </span>
                      <span className="text-[11px] font-mono text-[#6B7280]">{coin.marketCap} cap</span>
                    </div>
                  </div>
                  {/* Mini Chart */}
                  <div className="flex flex-col items-end gap-2">
                    <svg width="80" height="32">
                      <defs>
                        <linearGradient id={`coinSpark-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={coin.color} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={coin.color} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`M 0,${32 - ((coin.sparkline[0] - Math.min(...coin.sparkline)) / (Math.max(...coin.sparkline) - Math.min(...coin.sparkline) || 1)) * 32} ${coin.sparkline.slice(1).map((v, i) => `L ${(i + 1) * (80 / (coin.sparkline.length - 1))},${32 - ((v - Math.min(...coin.sparkline)) / (Math.max(...coin.sparkline) - Math.min(...coin.sparkline) || 1)) * 32}`).join(' ')}`}
                        fill={`url(#coinSpark-${coin.id})`}
                      />
                      <path
                        d={`M 0,${32 - ((coin.sparkline[0] - Math.min(...coin.sparkline)) / (Math.max(...coin.sparkline) - Math.min(...coin.sparkline) || 1)) * 32} ${coin.sparkline.slice(1).map((v, i) => `L ${(i + 1) * (80 / (coin.sparkline.length - 1))},${32 - ((v - Math.min(...coin.sparkline)) / (Math.max(...coin.sparkline) - Math.min(...coin.sparkline) || 1)) * 32}`).join(' ')}`}
                        fill="none"
                        stroke={coin.color}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    {/* Sentiment bar */}
                    <div className="h-1 w-[80px] overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: coin.sentiment === 'Very Bullish' ? '95%' : coin.sentiment === 'Bullish' ? '75%' : coin.sentiment === 'Neutral' ? '50%' : '25%',
                          background: coin.sentiment === 'Bearish' ? '#EF4444' : 'linear-gradient(90deg, #F59E0B, #10B981)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#6B7280]">{coin.sentiment}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </GlassCard>
        </motion.div>

        {/* Social Mentions Chart */}
        <motion.div variants={staggerItem}>
          <GlassCard title="Meme Coin Social Mentions" subtitle="30-day social media mention volume">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memeMentionsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pepeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dogeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gigaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bonkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Area type="monotone" dataKey="PEPE" stroke="#10B981" strokeWidth={2} fill="url(#pepeGrad)" />
                  <Area type="monotone" dataKey="DOGE" stroke="#F59E0B" strokeWidth={2} fill="url(#dogeGrad)" />
                  <Area type="monotone" dataKey="GIGA" stroke="#8B5CF6" strokeWidth={2} fill="url(#gigaGrad)" />
                  <Area type="monotone" dataKey="BONK" stroke="#EF4444" strokeWidth={2} fill="url(#bonkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 5: KOL Database */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard title="Key Opinion Leaders" subtitle="Influencer network management">
            {/* Header Controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Search KOLs..."
                    className="rounded-lg border border-white/[0.06] bg-[#12121A] py-2 pl-8 pr-3 text-[12px] text-white placeholder-[#6B7280] outline-none transition-colors focus:border-[#8B5CF6]/40"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#1E1E2D]">
                  <Download size={14} /> Export CSV
                </button>
                <button className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition-all hover:shadow-glow-purple" style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>
                  <Plus size={14} /> Add KOL
                </button>
              </div>
            </div>

            {/* Status Filters */}
            <div className="mb-4 flex flex-wrap gap-2">
              {['All', 'Contacted', 'In Negotiation', 'Active', 'Declined'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setKolFilter(filter)}
                  className={`
                    rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200
                    ${kolFilter === filter
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-white/[0.04] text-[#9CA3AF] hover:bg-white/[0.08] hover:text-white'
                    }
                  `}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* KOL Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Name</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Followers</th>
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Platform</th>
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Niche</th>
                    <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Status</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Rev-Share</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Engagement</th>
                    <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Last Contact</th>
                    <th className="pb-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Actions</th>
                  </tr>
                </thead>
                <motion.tbody variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
                  {filteredKOL.map((kol) => {
                    const status = statusConfig[kol.status] || statusConfig['Contacted'];
                    const nicheColor = nicheColors[kol.niche] || '#8B5CF6';
                    return (
                      <motion.tr
                        key={kol.id}
                        variants={staggerItemFast}
                        whileHover={{ backgroundColor: 'rgba(30, 30, 45, 0.5)' }}
                        className="border-b border-white/[0.04] transition-colors"
                      >
                        <td className="flex items-center gap-2 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${nicheColor}44, ${nicheColor}22)` }}>
                            {kol.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-white">{kol.name}</p>
                            <p className="text-[11px] font-mono text-[#6B7280]">{kol.handle}</p>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{kol.followers}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <PlatformIcon platform={kol.platform as Platform} size={14} />
                            <span className="text-[12px] text-[#9CA3AF]">{kol.platform}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${nicheColor}22`, color: nicheColor }}>
                            {kol.niche}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: status.bgColor, color: status.color }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                            {kol.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-[13px] text-white">{kol.revShare}</td>
                        <td className="py-3 text-right">
                          <span className={`font-mono text-[13px] ${kol.engagement > 3 ? 'text-accent-green' : 'text-[#9CA3AF]'}`}>
                            {kol.engagement}%
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-[12px] text-[#6B7280]">{kol.lastContact}</td>
                        <td className="py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-white">
                              <Edit size={14} />
                            </button>
                            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-white">
                              <Mail size={14} />
                            </button>
                            <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#1E1E2D] hover:text-accent-red">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 6: Virality Prediction Engine */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <GlassCard glowColor="purple" noPadding className="p-6">
            <div className="mb-6 flex items-center gap-3 border-b border-white/[0.06] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(139,92,246,0.15)' }}>
                <Brain size={20} className="text-[#8B5CF6]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-white">Virality Prediction Engine</h2>
                  <span className="rounded-full bg-[#1A1A26] px-2 py-0.5 text-[11px] font-mono text-[#6B7280]">v2.4</span>
                </div>
                <p className="text-[13px] text-[#9CA3AF]">Predict engagement potential before you post</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-green" />
                </span>
                <span className="text-[11px] font-mono text-accent-green">AI Online</span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              {/* Input Panel */}
              <motion.div
                variants={staggerItem}
                className="rounded-xl border border-white/[0.06] p-5"
                style={{ background: 'rgba(18, 18, 26, 0.6)' }}
              >
                <h3 className="mb-4 text-[15px] font-semibold text-white">Content Parameters</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Content Type</label>
                    <select
                      value={predictionForm.contentType}
                      onChange={(e) => setPredictionForm({ ...predictionForm, contentType: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-2.5 text-[13px] text-white outline-none transition-colors focus:border-[#8B5CF6]/40"
                    >
                      <option>Video</option>
                      <option>Image</option>
                      <option>Text</option>
                      <option>Meme</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Platform</label>
                    <select
                      value={predictionForm.platform}
                      onChange={(e) => setPredictionForm({ ...predictionForm, platform: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-2.5 text-[13px] text-white outline-none transition-colors focus:border-[#8B5CF6]/40"
                    >
                      <option>X</option>
                      <option>TikTok</option>
                      <option>Instagram</option>
                      <option>YouTube</option>
                      <option>Telegram</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Character</label>
                    <select
                      value={predictionForm.character}
                      onChange={(e) => setPredictionForm({ ...predictionForm, character: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-2.5 text-[13px] text-white outline-none transition-colors focus:border-[#8B5CF6]/40"
                    >
                      <option>PEPE</option>
                      <option>DOGE</option>
                      <option>MUSK</option>
                      <option>Generic</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Moment Type</label>
                    <select
                      value={predictionForm.momentType}
                      onChange={(e) => setPredictionForm({ ...predictionForm, momentType: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.06] bg-[#12121A] px-3 py-2.5 text-[13px] text-white outline-none transition-colors focus:border-[#8B5CF6]/40"
                    >
                      <option>Kill</option>
                      <option>Clutch</option>
                      <option>Escape</option>
                      <option>Win</option>
                      <option>Funny</option>
                      <option>Tutorial</option>
                    </select>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handlePredict}
                  disabled={isPredicting}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:shadow-glow-purple disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
                >
                  {isPredicting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Predict Virality
                    </>
                  )}
                </motion.button>
              </motion.div>

              {/* Result Panel */}
              <motion.div variants={staggerItem}>
                {!prediction ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-white/[0.06] p-5" style={{ background: 'rgba(18, 18, 26, 0.6)' }}>
                    <Brain size={40} className="mb-3 text-[#6B7280]" />
                    <p className="text-center text-[14px] font-medium text-[#9CA3AF]">
                      Enter parameters and click <span className="text-[#8B5CF6]">Predict</span> to see results
                    </p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
                    className="rounded-xl border border-white/[0.06] p-5"
                    style={{ background: 'rgba(18, 18, 26, 0.6)' }}
                  >
                    {/* Score Ring */}
                    <div className="flex flex-col items-center">
                      <ViralScore score={prediction.score} size={120} />
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Predicted Score</p>
                      <p className="mt-1 text-center text-[13px] text-[#9CA3AF]">{prediction.interpretation}</p>
                    </div>

                    {/* Confidence Interval */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Confidence Range</span>
                        <span className="font-mono text-[13px] font-semibold text-white">{prediction.range[0]}–{prediction.range[1]}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${prediction.confidence}%`,
                            background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)',
                          }}
                        />
                      </div>
                      <p className="mt-1 text-right text-[11px] font-mono text-[#6B7280]">{prediction.confidence}% confidence</p>
                    </div>

                    {/* Factor Breakdown */}
                    <div className="mt-4 space-y-2">
                      {prediction.factors.map((factor) => (
                        <div key={factor.name}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#9CA3AF]">{factor.name}</span>
                            <span className="font-mono text-[12px] font-semibold text-white">{factor.score}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${factor.score}%` }}
                              transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
                              className="h-full rounded-full"
                              style={{
                                background: factor.score > 80 ? 'linear-gradient(90deg, #10B981, #06B6D4)' :
                                  factor.score > 60 ? 'linear-gradient(90deg, #8B5CF6, #06B6D4)' :
                                    'linear-gradient(90deg, #F59E0B, #8B5CF6)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Context */}
                    <p className="mt-4 text-center text-[11px] text-[#6B7280]">{prediction.context}</p>

                    {/* Suggestions */}
                    <div className="mt-3 space-y-1.5">
                      {prediction.suggestions.map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className="flex items-center gap-2 rounded-lg bg-[#06B6D4]/10 px-3 py-2"
                        >
                          <TrendingUp size={14} className="flex-shrink-0 text-[#06B6D4]" />
                          <span className="text-[12px] text-[#06B6D4]">{s}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.section>

      {/* Section 7: News & Sources Aggregator */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, amount: 0.15 }}
        className="relative z-10"
      >
        <motion.div variants={staggerItem}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-white">Curated News & Intelligence</h2>
            <div className="flex flex-wrap gap-2">
              {newsFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setNewsFilter(filter)}
                  className={`
                    rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-200
                    ${newsFilter === filter
                      ? 'bg-[#8B5CF6] text-white'
                      : 'bg-white/[0.04] text-[#9CA3AF] hover:bg-white/[0.08] hover:text-white'
                    }
                  `}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNews.map((news) => (
              <motion.div
                key={news.id}
                variants={staggerItem}
                whileHover={{ y: -2, borderColor: 'rgba(139,92,246,0.2)' }}
                className="rounded-2xl border border-white/[0.06] p-5 backdrop-blur-2xl transition-all duration-300"
                style={{ background: 'rgba(26, 26, 38, 0.4)' }}
              >
                {/* Source + Time */}
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: `${news.sourceColor}22`, color: news.sourceColor }}
                  >
                    {news.source}
                  </span>
                  <span className="text-[11px] font-mono text-[#6B7280]">{news.time}</span>
                </div>

                {/* Headline */}
                <h3 className="mt-3 line-clamp-3 text-[15px] font-semibold leading-snug text-white">
                  {news.headline}
                </h3>

                {/* Excerpt */}
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#9CA3AF]">
                  {news.excerpt}
                </p>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {news.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#9CA3AF]">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Read link */}
                <button className="mt-3 flex items-center gap-1 text-[12px] font-medium text-[#06B6D4] transition-colors hover:text-[#06B6D4]/80">
                  Read <ArrowRight size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
}
