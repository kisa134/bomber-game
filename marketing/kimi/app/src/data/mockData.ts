// Social media follower counts
export const socialMetrics = {
  x: { followers: 88, platform: 'X' as const },
  tiktok: { followers: 45, platform: 'TikTok' as const },
  instagram: { followers: 23, platform: 'Instagram' as const },
  youtube: { followers: 0, platform: 'YouTube' as const },
  telegram: { followers: 8, platform: 'Telegram' as const },
};

export const totalFollowers = 96;

// Generate 30 days of growth data
const generateGrowthData = () => {
  const data = [];
  const platforms = ['x', 'tiktok', 'instagram', 'youtube', 'telegram'] as const;
  const baseValues = { x: 65, tiktok: 30, instagram: 15, youtube: 0, telegram: 5 };

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;

    const entry: Record<string, number | string> = { day: dayLabel };
    platforms.forEach((p) => {
      const growth = Math.random() * 3 - 0.5;
      entry[p] = Math.round(baseValues[p] + (30 - i) * growth * 0.8);
    });
    data.push(entry);
  }
  return data;
};

export const growthData = generateGrowthData();

// 7-day DAU data
export const dauData = [
  { day: 'Mon', dau: 42, change: +3 },
  { day: 'Tue', dau: 45, change: +3 },
  { day: 'Wed', dau: 38, change: -7 },
  { day: 'Thu', dau: 44, change: +6 },
  { day: 'Fri', dau: 47, change: +3 },
  { day: 'Sat', dau: 51, change: +4 },
  { day: 'Sun', dau: 49, change: -2 },
];

// Recent viral clips
export interface ViralClip {
  id: number;
  title: string;
  platforms: Array<'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram'>;
  viralScore: number;
  duration: string;
  thumbnail: string;
  status: 'published' | 'scheduled' | 'processing' | 'draft';
}

export const viralClips: ViralClip[] = [
  {
    id: 1,
    title: 'PEPE Clutch 1v3 Win',
    platforms: ['X', 'TikTok', 'YouTube'],
    viralScore: 87,
    duration: '00:32',
    thumbnail: '/assets/clip-thumb-1.jpg',
    status: 'published',
  },
  {
    id: 2,
    title: 'DOGE Near-Death Escape',
    platforms: ['TikTok', 'Instagram'],
    viralScore: 74,
    duration: '00:18',
    thumbnail: '/assets/clip-thumb-2.jpg',
    status: 'published',
  },
  {
    id: 3,
    title: 'MUSK Epic Kill Streak',
    platforms: ['X', 'YouTube'],
    viralScore: 91,
    duration: '00:45',
    thumbnail: '/assets/clip-thumb-3.jpg',
    status: 'scheduled',
  },
  {
    id: 4,
    title: 'SHIB Bomb Trap Master',
    platforms: ['TikTok', 'Telegram'],
    viralScore: 68,
    duration: '00:28',
    thumbnail: '/assets/clip-thumb-4.jpg',
    status: 'processing',
  },
  {
    id: 5,
    title: 'FLOKI Arena Domination',
    platforms: ['X', 'Instagram', 'YouTube'],
    viralScore: 82,
    duration: '00:38',
    thumbnail: '/assets/clip-thumb-5.jpg',
    status: 'draft',
  },
];

// Content calendar (next 7 days)
export interface CalendarDay {
  day: string;
  date: number;
  posts: number;
  platforms: Array<'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram'>;
  isToday: boolean;
}

export const calendarDays: CalendarDay[] = [
  { day: 'Mon', date: 12, posts: 2, platforms: ['X', 'TikTok'], isToday: false },
  { day: 'Tue', date: 13, posts: 1, platforms: ['YouTube'], isToday: false },
  { day: 'Wed', date: 14, posts: 3, platforms: ['X', 'TikTok', 'Instagram'], isToday: true },
  { day: 'Thu', date: 15, posts: 0, platforms: [], isToday: false },
  { day: 'Fri', date: 16, posts: 2, platforms: ['X', 'Telegram'], isToday: false },
  { day: 'Sat', date: 17, posts: 1, platforms: ['TikTok'], isToday: false },
  { day: 'Sun', date: 18, posts: 1, platforms: ['Instagram'], isToday: false },
];

// Market intel cards
export interface MarketIntel {
  id: number;
  badge: string;
  badgeColor: 'pink' | 'amber' | 'cyan' | 'purple';
  headline: string;
  data: string;
  trend: 'up' | 'down';
  updatedAgo: string;
}

export const marketIntel: MarketIntel[] = [
  {
    id: 1,
    badge: 'TRENDING',
    badgeColor: 'pink',
    headline: 'AI Agent Gaming Tokens Surge',
    data: '+340% volume this week',
    trend: 'up',
    updatedAgo: '2h ago',
  },
  {
    id: 2,
    badge: 'COMPETITOR',
    badgeColor: 'amber',
    headline: 'Bomb Crypto Launches Season 3',
    data: '12K new players in 48h',
    trend: 'up',
    updatedAgo: '4h ago',
  },
  {
    id: 3,
    badge: 'NARRATIVE',
    badgeColor: 'cyan',
    headline: 'PolitiFi Meme Coins Resurgent',
    data: '$2.1B market cap',
    trend: 'up',
    updatedAgo: '6h ago',
  },
  {
    id: 4,
    badge: 'MARKET SIZE',
    badgeColor: 'purple',
    headline: 'Web3 Gaming Market 2026',
    data: '$33-45B projected',
    trend: 'up',
    updatedAgo: '12h ago',
  },
];

// KOL contacts
export interface KOLContact {
  id: number;
  name: string;
  handle: string;
  platform: 'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram';
  followers: string;
  engagement: number;
  category: string;
}

export const kolContacts: KOLContact[] = [
  { id: 1, name: 'CryptoZach', handle: '@cryptozach', platform: 'X', followers: '245K', engagement: 4.2, category: 'Gaming' },
  { id: 2, name: 'Web3Sarah', handle: '@web3sarah', platform: 'TikTok', followers: '512K', engagement: 6.8, category: 'Crypto' },
  { id: 3, name: 'DeFi_Daily', handle: '@defidaily', platform: 'YouTube', followers: '189K', engagement: 3.5, category: 'DeFi' },
  { id: 4, name: 'NFT Ninja', handle: '@nftninja', platform: 'Instagram', followers: '98K', engagement: 5.1, category: 'NFT' },
  { id: 5, name: 'TokenTom', handle: '@tokentom', platform: 'Telegram', followers: '45K', engagement: 7.2, category: 'Trading' },
  { id: 6, name: 'ChainChad', handle: '@chainchad', platform: 'X', followers: '320K', engagement: 3.9, category: 'Gaming' },
  { id: 7, name: 'MemeLisa', handle: '@memelisa', platform: 'TikTok', followers: '780K', engagement: 8.4, category: 'Meme' },
  { id: 8, name: 'AlphaAlex', handle: '@alphaalex', platform: 'YouTube', followers: '156K', engagement: 4.7, category: 'Alpha' },
  { id: 9, name: 'Pump Paula', handle: '@pumppaula', platform: 'Instagram', followers: '67K', engagement: 5.8, category: 'Crypto' },
  { id: 10, name: 'DegenDave', handle: '@degendave', platform: 'X', followers: '410K', engagement: 5.3, category: 'Trading' },
];

// Metric card data for hero
export interface HeroMetric {
  label: string;
  value: string;
  numericValue: number;
  delta: string;
  deltaPositive: boolean;
  sparkline: number[];
}

export const heroMetrics: HeroMetric[] = [
  {
    label: 'TOTAL FOLLOWERS',
    value: '96',
    numericValue: 96,
    delta: '+12%',
    deltaPositive: true,
    sparkline: [65, 68, 72, 70, 75, 78, 82, 80, 85, 88, 86, 90, 92, 94, 96],
  },
  {
    label: 'POSTS THIS WEEK',
    value: '8',
    numericValue: 8,
    delta: '+3',
    deltaPositive: true,
    sparkline: [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 8, 9, 8, 8],
  },
  {
    label: 'GAME DAU',
    value: '47',
    numericValue: 47,
    delta: '-8%',
    deltaPositive: false,
    sparkline: [52, 50, 51, 49, 48, 50, 47, 46, 48, 47, 45, 47, 46, 47, 47],
  },
  {
    label: 'VIRAL SCORE AVG',
    value: '68',
    numericValue: 68,
    delta: '+5',
    deltaPositive: true,
    sparkline: [55, 58, 56, 60, 62, 61, 64, 63, 65, 66, 67, 68, 69, 68, 68],
  },
];

// ============================================================
// ANALYTICS PAGE DATA
// ============================================================

export type AnalyticsPlatform = 'All' | 'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram';

export const platformColors: Record<string, string> = {
  X: '#9CA3AF',
  TikTok: '#EC4899',
  Instagram: '#E4405F',
  YouTube: '#FF0000',
  Telegram: '#26A5E4',
  All: '#8B5CF6',
};

// Platform Overview Cards data
export interface PlatformOverview {
  platform: AnalyticsPlatform;
  followers: number;
  engagementRate: number;
  postsThisWeek: number;
  growth: number;
}

export const platformOverviews: PlatformOverview[] = [
  { platform: 'X', followers: 88, engagementRate: 3.8, postsThisWeek: 4, growth: 8 },
  { platform: 'TikTok', followers: 45, engagementRate: 6.2, postsThisWeek: 2, growth: 15 },
  { platform: 'Instagram', followers: 23, engagementRate: 4.5, postsThisWeek: 1, growth: 33 },
  { platform: 'YouTube', followers: 12, engagementRate: 2.1, postsThisWeek: 0, growth: 0 },
  { platform: 'Telegram', followers: 8, engagementRate: 5.1, postsThisWeek: 1, growth: 60 },
];

// Engagement rate chart data (30 days)
const generateEngagementData = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      day: `${date.getMonth() + 1}/${date.getDate()}`,
      X: 3.8 + Math.sin(i * 0.3) * 1.2 + Math.random() * 0.5,
      TikTok: 6.2 + Math.sin(i * 0.25) * 1.5 + Math.random() * 0.8,
      Instagram: 4.5 + Math.sin(i * 0.2) * 1.0 + Math.random() * 0.6,
      YouTube: 2.1 + Math.sin(i * 0.35) * 0.8 + Math.random() * 0.4,
      Telegram: 5.1 + Math.sin(i * 0.28) * 1.1 + Math.random() * 0.5,
    });
  }
  return data;
};

export const engagementData = generateEngagementData();

// Follower growth data (90 days, weekly)
const generateFollowerGrowthData = () => {
  const data = [];
  const baseValues = { X: 55, TikTok: 25, Instagram: 10, YouTube: 5, Telegram: 3 };
  for (let i = 12; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    data.push({
      week: `W${13 - i}`,
      X: Math.round(baseValues.X + (13 - i) * 2.5 + Math.random() * 3),
      TikTok: Math.round(baseValues.TikTok + (13 - i) * 1.8 + Math.random() * 2),
      Instagram: Math.round(baseValues.Instagram + (13 - i) * 1.2 + Math.random() * 2),
      YouTube: Math.round(baseValues.YouTube + (13 - i) * 0.5 + Math.random() * 1),
      Telegram: Math.round(baseValues.Telegram + (13 - i) * 0.4 + Math.random() * 1),
    });
  }
  return data;
};

export const followerGrowthData = generateFollowerGrowthData();

// Best posting times heatmap data (7 days x 6 time blocks)
export const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const timeBlocks = ['00-04', '04-08', '08-12', '12-16', '16-20', '20-24'];

export const heatmapData = [
  // Mon
  [12, 8, 25, 45, 62, 78],
  // Tue
  [10, 7, 28, 48, 58, 72],
  // Wed
  [11, 9, 30, 52, 65, 85],
  // Thu
  [9, 6, 22, 42, 55, 68],
  // Fri
  [14, 10, 35, 58, 72, 80],
  // Sat
  [18, 15, 42, 65, 58, 75],
  // Sun
  [15, 12, 38, 55, 60, 82],
];

// Top performing content
export interface TopContentItem {
  id: number;
  title: string;
  platform: AnalyticsPlatform;
  type: string;
  views: number;
  engagement: number;
  viralScore: number;
  date: string;
  aiInsight: string;
}

export const topContentData: TopContentItem[] = [
  {
    id: 1,
    title: 'PEPE Clutch Win reaction video goes viral',
    platform: 'X',
    type: 'Video',
    views: 1240,
    engagement: 24,
    viralScore: 91,
    date: '2026-01-14',
    aiInsight: 'Meme character + clutch moment = viral formula',
  },
  {
    id: 2,
    title: 'Gameplay teaser #Bombermeme clip',
    platform: 'TikTok',
    type: 'Short',
    views: 890,
    engagement: 18,
    viralScore: 78,
    date: '2026-01-13',
    aiInsight: 'Short format + hashtag combo performs well',
  },
  {
    id: 3,
    title: 'Behind the scenes dev update',
    platform: 'Telegram',
    type: 'Text',
    views: 156,
    engagement: 6,
    viralScore: 62,
    date: '2026-01-12',
    aiInsight: 'Community updates drive loyal engagement',
  },
  {
    id: 4,
    title: 'DOGE escape moment compilation',
    platform: 'YouTube',
    type: 'Video',
    views: 2100,
    engagement: 45,
    viralScore: 85,
    date: '2026-01-10',
    aiInsight: 'Compilation format extends watch time',
  },
  {
    id: 5,
    title: 'New character reveal sneak peek',
    platform: 'Instagram',
    type: 'Image',
    views: 567,
    engagement: 32,
    viralScore: 74,
    date: '2026-01-09',
    aiInsight: 'Character reveals drive comment engagement',
  },
  {
    id: 6,
    title: 'Tournament highlights montage',
    platform: 'X',
    type: 'Video',
    views: 980,
    engagement: 21,
    viralScore: 82,
    date: '2026-01-08',
    aiInsight: 'Tournament content peaks during events',
  },
  {
    id: 7,
    title: 'How to master bomb traps tutorial',
    platform: 'YouTube',
    type: 'Video',
    views: 3400,
    engagement: 89,
    viralScore: 88,
    date: '2026-01-06',
    aiInsight: 'Tutorial content has long-tail value',
  },
  {
    id: 8,
    title: 'Meme Monday community submissions',
    platform: 'Telegram',
    type: 'Text',
    views: 234,
    engagement: 18,
    viralScore: 58,
    date: '2026-01-05',
    aiInsight: 'UGC campaigns build community loyalty',
  },
  {
    id: 9,
    title: 'Speedrun world record attempt',
    platform: 'TikTok',
    type: 'Short',
    views: 1560,
    engagement: 67,
    viralScore: 93,
    date: '2026-01-04',
    aiInsight: 'Speedrun content drives share velocity',
  },
  {
    id: 10,
    title: 'Partnership announcement teaser',
    platform: 'X',
    type: 'Image',
    views: 780,
    engagement: 15,
    viralScore: 71,
    date: '2026-01-03',
    aiInsight: 'Partnership news drives profile visits',
  },
];

// Competitor tracking data
export interface Competitor {
  id: number;
  name: string;
  category: string;
  followers: string;
  engagement: string;
  postsPerWeek: number;
  growth: number;
  lastActive: string;
  sparkline: number[];
}

export const competitorsData: Competitor[] = [
  {
    id: 1,
    name: 'Bomb Crypto',
    category: 'P2E',
    followers: '45.2K',
    engagement: '2.1%',
    postsPerWeek: 12,
    growth: 5.2,
    lastActive: '2h ago',
    sparkline: [42, 43, 44, 43, 45, 44, 46, 45, 47, 46],
  },
  {
    id: 2,
    name: 'SOL Arena',
    category: 'Battle Royale',
    followers: '28.1K',
    engagement: '3.4%',
    postsPerWeek: 8,
    growth: 8.7,
    lastActive: '5h ago',
    sparkline: [22, 23, 24, 25, 25, 26, 27, 27, 28, 28],
  },
  {
    id: 3,
    name: 'Catizen',
    category: 'Strategy',
    followers: '12.8K',
    engagement: '4.6%',
    postsPerWeek: 15,
    growth: 12.3,
    lastActive: '8h ago',
    sparkline: [8, 9, 9, 10, 10, 11, 11, 12, 12, 13],
  },
  {
    id: 4,
    name: 'Notcoin',
    category: 'Arcade',
    followers: '67.5K',
    engagement: '1.8%',
    postsPerWeek: 21,
    growth: 3.1,
    lastActive: '12h ago',
    sparkline: [62, 63, 64, 64, 65, 65, 66, 66, 67, 67],
  },
];

// AI Content Recommendations
export interface AIRecommendation {
  id: number;
  confidence: number;
  title: string;
  description: string;
  action: string;
  tags: string[];
  trendSparkline: number[];
}

export const aiRecommendations: AIRecommendation[] = [
  {
    id: 1,
    confidence: 94,
    title: 'PEPE clutch compilations trending',
    description: 'Clutch moment videos with PEPE character are seeing 3x engagement vs avg. Create a "Best of PEPE" compilation.',
    action: 'Create Clip',
    tags: ['Video', 'X', '3.2K est. engagement'],
    trendSparkline: [45, 52, 61, 73, 82, 91, 94],
  },
  {
    id: 2,
    confidence: 87,
    title: 'Short-form bomb escape clips',
    description: '"Near-death escape" moments under 15s perform best on TikTok. Your last escape clip reached 2x avg views.',
    action: 'Create Clip',
    tags: ['Short', 'TikTok', '2.8K est. engagement'],
    trendSparkline: [30, 38, 48, 58, 68, 78, 87],
  },
  {
    id: 3,
    confidence: 82,
    title: 'Meme reaction content for X',
    description: 'Reaction-style posts with meme character faces get 40% more retweets. Pair gameplay with meme reaction overlays.',
    action: 'Schedule Post',
    tags: ['Image', 'X', '1.9K est. engagement'],
    trendSparkline: [25, 35, 45, 55, 65, 72, 82],
  },
  {
    id: 4,
    confidence: 79,
    title: 'Tutorial content for YouTube',
    description: '"How to" bomb trap tutorials drive 4x avg watch time. Create a series covering advanced techniques.',
    action: 'Create Clip',
    tags: ['Video', 'YouTube', '3.5K est. engagement'],
    trendSparkline: [20, 30, 40, 52, 60, 68, 79],
  },
  {
    id: 5,
    confidence: 76,
    title: 'Telegram community polls',
    description: 'Interactive polls about new characters drive 2.5x community engagement. Run weekly "Pick the next character" polls.',
    action: 'Schedule Post',
    tags: ['Poll', 'Telegram', '850 est. engagement'],
    trendSparkline: [15, 25, 38, 48, 58, 65, 76],
  },
];

// Hashtag word cloud data
export interface HashtagWord {
  text: string;
  value: number;
  category: string;
}

export const hashtagWords: HashtagWord[] = [
  { text: '#Web3Gaming', value: 45200, category: 'Gaming' },
  { text: '#Solana', value: 38100, category: 'Crypto' },
  { text: '#PEPE', value: 32700, category: 'Meme' },
  { text: '#GameFi', value: 28400, category: 'Gaming' },
  { text: '#MemeCoin', value: 24100, category: 'Meme' },
  { text: '#P2E', value: 19800, category: 'Gaming' },
  { text: '#NFTGaming', value: 16300, category: 'Gaming' },
  { text: '#DOGE', value: 15700, category: 'Meme' },
  { text: '#CryptoGaming', value: 14200, category: 'Crypto' },
  { text: '#AIGaming', value: 11800, category: 'Gaming' },
  { text: '#PolitiFi', value: 9400, category: 'Crypto' },
  { text: '#MemeCharacter', value: 8100, category: 'Meme' },
  { text: '#SolanaNFT', value: 7300, category: 'Solana' },
  { text: '#Deathmatch', value: 6200, category: 'Gaming' },
  { text: '#Bombermeme', value: 1200, category: 'Gaming' },
  { text: '#Web3', value: 8900, category: 'Crypto' },
  { text: '#Blockchain', value: 7600, category: 'Crypto' },
  { text: '#Token', value: 5400, category: 'Crypto' },
  { text: '#Airdrop', value: 4800, category: 'Crypto' },
  { text: '#Metaverse', value: 4200, category: 'Gaming' },
  { text: '#DAO', value: 3900, category: 'Crypto' },
  { text: '#DeFi', value: 3600, category: 'Crypto' },
  { text: '#Meme', value: 3300, category: 'Meme' },
  { text: '#Gaming', value: 3000, category: 'Gaming' },
  { text: '#Crypto', value: 2700, category: 'Crypto' },
];

// Cross-platform performance matrix
export interface PerformanceRow {
  platform: AnalyticsPlatform;
  followers: number;
  engagement: string;
  postsPerWeek: number;
  avgReach: number;
  growth: string;
  growthPositive: boolean;
}

export const performanceMatrix: PerformanceRow[] = [
  { platform: 'X', followers: 88, engagement: '3.8%', postsPerWeek: 4, avgReach: 156, growth: '+8%', growthPositive: true },
  { platform: 'TikTok', followers: 45, engagement: '6.2%', postsPerWeek: 2, avgReach: 89, growth: '+15%', growthPositive: true },
  { platform: 'Instagram', followers: 23, engagement: '4.5%', postsPerWeek: 1, avgReach: 67, growth: '+33%', growthPositive: true },
  { platform: 'YouTube', followers: 12, engagement: '2.1%', postsPerWeek: 0, avgReach: 0, growth: '0%', growthPositive: false },
  { platform: 'Telegram', followers: 8, engagement: '5.1%', postsPerWeek: 1, avgReach: 12, growth: '+60%', growthPositive: true },
];

// ============================================================
// MARKET INTEL PAGE DATA
// ============================================================

// Market overview hero metrics
export interface MarketMetric {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  subtext: string;
  source: string;
  sparkline: number[];
}

export const marketOverviewMetrics: MarketMetric[] = [
  {
    label: 'WEB3 GAMING MARKET 2026',
    value: '$33-45B',
    delta: '+28%',
    deltaPositive: true,
    subtext: 'Projected market size by end of 2026',
    source: 'DappRadar',
    sparkline: [18, 20, 22, 24, 26, 28, 30, 33, 36, 38, 40, 42, 44, 45, 45],
  },
  {
    label: 'BLOCKCHAIN GAMERS',
    value: '145M',
    delta: '+35%',
    deltaPositive: true,
    subtext: 'Active wallets monthly',
    source: 'DappRadar',
    sparkline: [85, 88, 92, 96, 100, 105, 110, 115, 120, 125, 130, 135, 140, 143, 145],
  },
  {
    label: 'SOLANA GAMING TXs',
    value: '$2.1B',
    delta: '+52%',
    deltaPositive: true,
    subtext: 'Transaction volume quarterly',
    source: 'Solscan',
    sparkline: [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.05, 2.1],
  },
  {
    label: 'NEW GAME LAUNCHES',
    value: '2,400+',
    delta: '+18%',
    deltaPositive: true,
    subtext: 'Across all chains this year',
    source: 'IGDB',
    sparkline: [1500, 1600, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2100, 2150, 2200, 2250, 2300, 2400],
  },
];

// Trending topics
export interface TrendingTopic {
  id: number;
  rank: string;
  name: string;
  description: string;
  trend: number;
  tags: string[];
  sparkline: number[];
}

export const trendingTopicsData: TrendingTopic[] = [
  {
    id: 1,
    rank: '01',
    name: 'AI Agent Gaming',
    description: 'AI-powered NPCs and autonomous game characters trending hard',
    trend: 340,
    tags: ['AI', 'Gaming', 'Bullish'],
    sparkline: [20, 25, 35, 50, 65, 80, 95, 110, 130, 150],
  },
  {
    id: 2,
    rank: '02',
    name: 'PolitiFi Memes',
    description: 'Political meme tokens surging ahead of election cycles',
    trend: 210,
    tags: ['Political', 'Meme', 'Volatile'],
    sparkline: [15, 20, 30, 45, 55, 60, 70, 85, 95, 110],
  },
  {
    id: 3,
    rank: '03',
    name: 'SocialFi Gaming',
    description: 'Play-to-earn meets social media, content creation rewards',
    trend: 156,
    tags: ['Social', 'Gaming', 'Growth'],
    sparkline: [10, 15, 20, 30, 38, 45, 52, 60, 68, 78],
  },
  {
    id: 4,
    rank: '04',
    name: 'NFT-Community',
    description: 'Community-owned game assets and DAO governance',
    trend: 98,
    tags: ['NFT', 'DAO', 'Community'],
    sparkline: [30, 32, 34, 35, 36, 38, 40, 42, 44, 46],
  },
];

// Narrative momentum chart data (90 days)
export const narrativeData = [
  { week: 'W1', 'AI Agent': 20, 'PolitiFi': 15, 'SocialFi': 10, 'NFT-Community': 30 },
  { week: 'W2', 'AI Agent': 25, 'PolitiFi': 18, 'SocialFi': 14, 'NFT-Community': 31 },
  { week: 'W3', 'AI Agent': 30, 'PolitiFi': 22, 'SocialFi': 18, 'NFT-Community': 32 },
  { week: 'W4', 'AI Agent': 38, 'PolitiFi': 30, 'SocialFi': 25, 'NFT-Community': 33 },
  { week: 'W5', 'AI Agent': 45, 'PolitiFi': 38, 'SocialFi': 32, 'NFT-Community': 34 },
  { week: 'W6', 'AI Agent': 55, 'PolitiFi': 48, 'SocialFi': 38, 'NFT-Community': 35 },
  { week: 'W7', 'AI Agent': 68, 'PolitiFi': 58, 'SocialFi': 45, 'NFT-Community': 36 },
  { week: 'W8', 'AI Agent': 78, 'PolitiFi': 72, 'SocialFi': 55, 'NFT-Community': 38 },
  { week: 'W9', 'AI Agent': 88, 'PolitiFi': 82, 'SocialFi': 62, 'NFT-Community': 40 },
  { week: 'W10', 'AI Agent': 95, 'PolitiFi': 90, 'SocialFi': 68, 'NFT-Community': 42 },
  { week: 'W11', 'AI Agent': 105, 'PolitiFi': 98, 'SocialFi': 72, 'NFT-Community': 44 },
  { week: 'W12', 'AI Agent': 120, 'PolitiFi': 110, 'SocialFi': 78, 'NFT-Community': 46 },
  { week: 'W13', 'AI Agent': 135, 'PolitiFi': 120, 'SocialFi': 85, 'NFT-Community': 48 },
];

// Competitor activity feed
export interface ActivityItem {
  id: number;
  competitor: string;
  action: string;
  time: string;
  type: 'Launch' | 'Partnership' | 'Content' | 'Update';
  tags: string[];
}

export const competitorActivityData: ActivityItem[] = [
  { id: 1, competitor: 'Bomb Crypto', action: 'Launched Season 3 with 12 new arenas and battle pass', time: '2h ago', type: 'Launch', tags: ['Launch', 'Season'] },
  { id: 2, competitor: 'SOL Arena', action: 'Partnered with Phantom Wallet for exclusive rewards', time: '5h ago', type: 'Partnership', tags: ['Partnership', 'Wallet'] },
  { id: 3, competitor: 'Catizen', action: 'Released PEPE character skin DLC for premium users', time: '8h ago', type: 'Update', tags: ['Update', 'DLC'] },
  { id: 4, competitor: 'Notcoin', action: 'Viral TikTok campaign hit 1M views in 24 hours', time: '12h ago', type: 'Content', tags: ['Content', 'Viral'] },
  { id: 5, competitor: 'Bomb Crypto', action: 'Announced $BOMB token staking with 45% APY', time: '1d ago', type: 'Launch', tags: ['Launch', 'Token'] },
  { id: 6, competitor: 'SOL Arena', action: 'Season 2 leaderboard reset with new ranking system', time: '1d ago', type: 'Update', tags: ['Update', 'Season'] },
  { id: 7, competitor: 'Catizen', action: 'Signed KOL partnership with CryptoBanter for 6 months', time: '2d ago', type: 'Partnership', tags: ['Partnership', 'KOL'] },
  { id: 8, competitor: 'Notcoin', action: 'Community meme contest launched with 10K prize pool', time: '2d ago', type: 'Content', tags: ['Content', 'Community'] },
];

// Meme coin tracker
export interface MemeCoin {
  id: number;
  name: string;
  symbol: string;
  price: string;
  priceChange: number;
  marketCap: string;
  sentiment: string;
  color: string;
  sparkline: number[];
}

export const memeCoinsData: MemeCoin[] = [
  {
    id: 1, name: 'PEPE', symbol: 'P', price: '$0.00001245', priceChange: 8.4,
    marketCap: '$5.2B', sentiment: 'Bullish', color: '#10B981',
    sparkline: [0.000010, 0.0000105, 0.000011, 0.0000112, 0.0000115, 0.0000118, 0.000012, 0.0000122, 0.0000123, 0.00001245],
  },
  {
    id: 2, name: 'DOGE', symbol: 'D', price: '$0.284', priceChange: 3.2,
    marketCap: '$41.1B', sentiment: 'Neutral', color: '#F59E0B',
    sparkline: [0.265, 0.268, 0.270, 0.272, 0.275, 0.278, 0.280, 0.281, 0.282, 0.284],
  },
  {
    id: 3, name: 'GIGA', symbol: 'G', price: '$0.048', priceChange: 15.7,
    marketCap: '$480M', sentiment: 'Very Bullish', color: '#8B5CF6',
    sparkline: [0.035, 0.037, 0.039, 0.040, 0.042, 0.043, 0.044, 0.045, 0.046, 0.048],
  },
  {
    id: 4, name: 'BONK', symbol: 'B', price: '$0.000028', priceChange: -2.4,
    marketCap: '$1.8B', sentiment: 'Bearish', color: '#EF4444',
    sparkline: [0.000030, 0.0000295, 0.000029, 0.0000292, 0.000029, 0.0000288, 0.0000285, 0.0000283, 0.0000281, 0.000028],
  },
];

// Meme coin social mentions data
export const memeMentionsData = [
  { day: '1', PEPE: 45, DOGE: 62, GIGA: 28, BONK: 35 },
  { day: '3', PEPE: 52, DOGE: 58, GIGA: 32, BONK: 33 },
  { day: '5', PEPE: 48, DOGE: 65, GIGA: 38, BONK: 30 },
  { day: '7', PEPE: 55, DOGE: 60, GIGA: 42, BONK: 28 },
  { day: '9', PEPE: 62, DOGE: 55, GIGA: 48, BONK: 26 },
  { day: '11', PEPE: 58, DOGE: 58, GIGA: 55, BONK: 24 },
  { day: '13', PEPE: 65, DOGE: 52, GIGA: 62, BONK: 22 },
  { day: '15', PEPE: 72, DOGE: 50, GIGA: 68, BONK: 20 },
  { day: '17', PEPE: 68, DOGE: 48, GIGA: 72, BONK: 18 },
  { day: '19', PEPE: 75, DOGE: 55, GIGA: 78, BONK: 16 },
  { day: '21', PEPE: 82, DOGE: 58, GIGA: 85, BONK: 15 },
  { day: '23', PEPE: 78, DOGE: 62, GIGA: 88, BONK: 14 },
  { day: '25', PEPE: 85, DOGE: 65, GIGA: 92, BONK: 13 },
  { day: '27', PEPE: 90, DOGE: 60, GIGA: 95, BONK: 12 },
  { day: '30', PEPE: 95, DOGE: 58, GIGA: 98, BONK: 10 },
];

// KOL Database
export interface KOLDatabaseEntry {
  id: number;
  name: string;
  handle: string;
  followers: string;
  platform: 'X' | 'TikTok' | 'YouTube' | 'Instagram' | 'Telegram';
  niche: string;
  status: 'Contacted' | 'In Negotiation' | 'Active' | 'Declined';
  revShare: string;
  engagement: number;
  lastContact: string;
}

export const kolDatabase: KOLDatabaseEntry[] = [
  { id: 1, name: 'CryptoGamer', handle: '@cryptogamer', followers: '125K', platform: 'X', niche: 'Gaming', status: 'Active', revShare: '15%', engagement: 4.2, lastContact: '2d ago' },
  { id: 2, name: 'MemeQueen', handle: '@memequeen', followers: '89K', platform: 'TikTok', niche: 'Memes', status: 'In Negotiation', revShare: '20%', engagement: 6.8, lastContact: '5d ago' },
  { id: 3, name: 'SolanaMaxi', handle: '@solanamaxi', followers: '210K', platform: 'X', niche: 'Solana', status: 'Contacted', revShare: 'Fixed $500', engagement: 3.1, lastContact: '1w ago' },
  { id: 4, name: 'Web3Watcher', handle: '@web3watcher', followers: '67K', platform: 'YouTube', niche: 'Crypto', status: 'Active', revShare: '10%', engagement: 2.9, lastContact: '3d ago' },
  { id: 5, name: 'PEPEArmy', handle: '@pepearmy', followers: '340K', platform: 'X', niche: 'Memes', status: 'In Negotiation', revShare: '12%', engagement: 5.4, lastContact: '4d ago' },
  { id: 6, name: 'GameFiDaily', handle: '@gamefii', followers: '45K', platform: 'Instagram', niche: 'Gaming', status: 'Declined', revShare: '—', engagement: 1.8, lastContact: '2w ago' },
  { id: 7, name: 'NFTCreator', handle: '@nftcreator', followers: '78K', platform: 'TikTok', niche: 'NFTs', status: 'Contacted', revShare: '18%', engagement: 3.7, lastContact: '6d ago' },
  { id: 8, name: 'CryptoBanter', handle: '@cryptobanter', followers: '520K', platform: 'YouTube', niche: 'Crypto', status: 'Active', revShare: '8%', engagement: 2.1, lastContact: '1d ago' },
  { id: 9, name: 'SolGaming', handle: '@solgaming', followers: '95K', platform: 'X', niche: 'Solana', status: 'Active', revShare: '14%', engagement: 3.9, lastContact: '2d ago' },
  { id: 10, name: 'MemeLord', handle: '@memelord', followers: '175K', platform: 'TikTok', niche: 'Memes', status: 'In Negotiation', revShare: '22%', engagement: 7.2, lastContact: '3d ago' },
];

// Virality prediction engine
export interface PredictionFactor {
  name: string;
  score: number;
}

export const defaultPredictionFactors: PredictionFactor[] = [
  { name: 'Action Appeal', score: 82 },
  { name: 'Character Popularity', score: 75 },
  { name: 'Platform Fit', score: 68 },
  { name: 'Timing Score', score: 71 },
  { name: 'Hashtag Power', score: 64 },
];

// News aggregator data
export interface NewsItem {
  id: number;
  source: string;
  sourceColor: string;
  headline: string;
  excerpt: string;
  time: string;
  tags: string[];
}

export const newsData: NewsItem[] = [
  {
    id: 1, source: 'DappRadar', sourceColor: '#8B5CF6',
    headline: 'Web3 Gaming Market Projected to Hit $45B by End of 2026',
    excerpt: 'New research from DappRadar shows exponential growth in blockchain gaming, driven by AI integration and SocialFi mechanics...',
    time: '2h ago', tags: ['Market', 'Growth'],
  },
  {
    id: 2, source: 'Decrypt', sourceColor: '#06B6D4',
    headline: 'Solana Gaming Ecosystem Sees 52% Transaction Volume Increase',
    excerpt: 'Solana has overtaken Ethereum as the leading chain for gaming transactions, with major studios migrating to the network...',
    time: '5h ago', tags: ['Solana', 'Gaming'],
  },
  {
    id: 3, source: 'Twitter', sourceColor: '#9CA3AF',
    headline: 'Bomb Crypto Season 3 Launch Drives 12K New Player Signups',
    excerpt: 'The highly anticipated Season 3 update has broken records with 12,000 new players joining within 48 hours of release...',
    time: '8h ago', tags: ['Competitor', 'Launch'],
  },
  {
    id: 4, source: 'Discord', sourceColor: '#26A5E4',
    headline: 'Bombermeme Alpha Testing Community Feedback Report',
    excerpt: 'Weekly community feedback highlights strong engagement with the new bomb trap mechanics and character abilities...',
    time: '1d ago', tags: ['Community', 'Dev'],
  },
  {
    id: 5, source: 'DappRadar', sourceColor: '#8B5CF6',
    headline: 'AI Agent Tokens Rally 340% as Gaming Integration Expands',
    excerpt: 'AI-powered gaming tokens are leading the market rally as more studios integrate autonomous NPC technology...',
    time: '1d ago', tags: ['AI', 'Trend'],
  },
  {
    id: 6, source: 'Decrypt', sourceColor: '#06B6D4',
    headline: 'Meme Coin Gaming: The Next Big Narrative in Web3',
    excerpt: 'Industry experts predict meme-coin themed games will dominate the next bull cycle with play-to-meme mechanics...',
    time: '2d ago', tags: ['Meme', 'Trend'],
  },
];
