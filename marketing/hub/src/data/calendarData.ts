export type Platform = 'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram';
export type PostStatus = 'draft' | 'scheduled' | 'published';
export type ContentType = 'video' | 'image' | 'text';

export interface CalendarPost {
  id: string;
  caption: string;
  platform: Platform;
  status: PostStatus;
  contentType: ContentType;
  scheduledDate: string; // ISO date string YYYY-MM-DD
  scheduledTime: string; // HH:mm
  hashtags: string[];
  viralScore?: number;
  mediaUrl?: string;
}

export const platformColors: Record<Platform, string> = {
  X: '#9CA3AF',
  TikTok: '#EC4899',
  Instagram: '#E4405F',
  YouTube: '#FF0000',
  Telegram: '#26A5E4',
};

export const platformBgColors: Record<Platform, string> = {
  X: 'rgba(156,163,175,0.1)',
  TikTok: 'rgba(236,72,153,0.1)',
  Instagram: 'rgba(228,64,95,0.1)',
  YouTube: 'rgba(255,0,0,0.1)',
  Telegram: 'rgba(38,165,228,0.1)',
};

export const platformBorderColors: Record<Platform, string> = {
  X: 'border-l-[#9CA3AF]',
  TikTok: 'border-l-[#EC4899]',
  Instagram: 'border-l-[#E4405F]',
  YouTube: 'border-l-[#FF0000]',
  Telegram: 'border-l-[#26A5E4]',
};

// Generate dates relative to today
const today = new Date();
const formatDate = (d: Date) => d.toISOString().split('T')[0];

const addDays = (d: Date, n: number) => {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
};

// Start from Monday of current week
const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const monday = getMonday(new Date(today));

export const calendarPosts: CalendarPost[] = [
  // Week 1 - Monday
  {
    id: 'post-001',
    caption: 'PEPE Clutch Win Reaction - This 1v3 clutch had the whole arena screaming! Watch the full replay and let us know your favorite moment.',
    platform: 'X',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(monday),
    scheduledTime: '19:00',
    hashtags: ['#PEPE', '#Bombermeme', '#GamingClips', '#Web3Gaming'],
    viralScore: 87,
  },
  {
    id: 'post-002',
    caption: 'Bomb Escape Clip #1 - When you think you are done for but the bomb saves you. Insane timing!',
    platform: 'TikTok',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(monday),
    scheduledTime: '21:00',
    hashtags: ['#TikTokGaming', '#BombEscape', '#ViralGaming', '#MemeCoin'],
    viralScore: 74,
  },
  {
    id: 'post-003',
    caption: 'Quick dev update: Season 2 patch notes are being finalized. New arena, new characters, new memes incoming!',
    platform: 'X',
    status: 'published',
    contentType: 'text',
    scheduledDate: formatDate(monday),
    scheduledTime: '14:30',
    hashtags: ['#DevUpdate', '#Bombermeme', '#GameDev'],
  },
  // Week 1 - Tuesday
  {
    id: 'post-004',
    caption: 'Dev Update Thread - Breaking down all the changes coming in Season 2. A thread. 1/8',
    platform: 'X',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 1)),
    scheduledTime: '18:30',
    hashtags: ['#DevUpdate', '#Bombermeme', '#Thread', '#Web3'],
    viralScore: 62,
  },
  {
    id: 'post-005',
    caption: 'Behind the scenes: How we designed the new DOGE arena. From sketch to final render!',
    platform: 'Instagram',
    status: 'draft',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 1)),
    scheduledTime: '16:00',
    hashtags: ['#BTS', '#GameDesign', '#DOGE', '#Bombermeme'],
  },
  // Week 1 - Wednesday
  {
    id: 'post-006',
    caption: 'MUSK Epic Kill Streak - 12 kills in 3 minutes. Absolute domination in the arena!',
    platform: 'TikTok',
    status: 'published',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 2)),
    scheduledTime: '20:00',
    hashtags: ['#MUSK', '#KillStreak', '#Gaming', '#TikTokGaming'],
    viralScore: 91,
  },
  {
    id: 'post-007',
    caption: 'Gameplay Highlight - Best moments from last nights tournament. Who had the best play?',
    platform: 'Instagram',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 2)),
    scheduledTime: '20:30',
    hashtags: ['#Gameplay', '#Highlight', '#Tournament', '#Gaming'],
    viralScore: 68,
  },
  {
    id: 'post-008',
    caption: 'Community Meme Repost - Our community never fails to make us laugh. Here are the best memes this week!',
    platform: 'X',
    status: 'draft',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 2)),
    scheduledTime: '21:00',
    hashtags: ['#Meme', '#Community', '#Bombermeme', '#MemeCoin'],
  },
  // Week 1 - Thursday
  {
    id: 'post-009',
    caption: 'Tutorial Tuesday: How to master bomb placement in the new arena. Tips from the pros!',
    platform: 'YouTube',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 3)),
    scheduledTime: '17:00',
    hashtags: ['#Tutorial', '#YouTube', '#GamingTips', '#Bombermeme'],
    viralScore: 55,
  },
  {
    id: 'post-010',
    caption: 'Throwback to our first alpha test. We have come so far! Thanks to everyone who believed in us.',
    platform: 'Instagram',
    status: 'published',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 3)),
    scheduledTime: '15:00',
    hashtags: ['#Throwback', '#Alpha', '#GameDev', '#Bombermeme'],
  },
  // Week 1 - Friday
  {
    id: 'post-011',
    caption: 'Weekly Recap - All the highlights, stats, and community moments from this week in Bombermeme!',
    platform: 'Telegram',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 4)),
    scheduledTime: '19:00',
    hashtags: ['#WeeklyRecap', '#Telegram', '#Community'],
  },
  {
    id: 'post-012',
    caption: 'DOGE Escape Compilation - The best DOGE escapes this week. You wont believe #3!',
    platform: 'TikTok',
    status: 'draft',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 4)),
    scheduledTime: '20:00',
    hashtags: ['#DOGE', '#Escape', '#Compilation', '#TikTok'],
    viralScore: 78,
  },
  {
    id: 'post-013',
    caption: 'Friday night tournament is LIVE! Who will take home the crown this week?',
    platform: 'X',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 4)),
    scheduledTime: '21:00',
    hashtags: ['#Tournament', '#Live', '#FridayNight', '#Bombermeme'],
  },
  // Week 1 - Saturday
  {
    id: 'post-014',
    caption: 'Behind the Scenes - A day in the life of a Bombermeme dev. Spoiler: lots of coffee!',
    platform: 'Instagram',
    status: 'scheduled',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 5)),
    scheduledTime: '15:00',
    hashtags: ['#BTS', '#DevLife', '#GameDev', '#Instagram'],
    viralScore: 63,
  },
  {
    id: 'post-015',
    caption: 'Saturday Showdown highlights - The most intense matches from this weekends event!',
    platform: 'YouTube',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 5)),
    scheduledTime: '18:00',
    hashtags: ['#SaturdayShowdown', '#YouTube', '#Highlights', '#Gaming'],
  },
  // Week 1 - Sunday
  {
    id: 'post-016',
    caption: 'Sunday Meme Drop - Fresh memes hot off the press. Tag someone who needs to see this!',
    platform: 'X',
    status: 'scheduled',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 6)),
    scheduledTime: '20:00',
    hashtags: ['#SundayMeme', '#MemeDrop', '#Bombermeme', '#MemeCoin'],
    viralScore: 82,
  },
  {
    id: 'post-017',
    caption: 'Community Spotlight: Meet the top player this week and their secrets to success!',
    platform: 'Telegram',
    status: 'published',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 6)),
    scheduledTime: '16:00',
    hashtags: ['#CommunitySpotlight', '#TopPlayer', '#Telegram'],
  },
  // Week 2 - Monday
  {
    id: 'post-018',
    caption: 'New week, new challenges! What are your goals in Bombermeme this week?',
    platform: 'X',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 7)),
    scheduledTime: '10:00',
    hashtags: ['#MondayMotivation', '#Bombermeme', '#Web3Gaming'],
  },
  {
    id: 'post-019',
    caption: 'SHIB Bomb Trap Masterclass - Learn from the best trap setter in the game!',
    platform: 'TikTok',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 7)),
    scheduledTime: '19:30',
    hashtags: ['#SHIB', '#BombTrap', '#Masterclass', '#TikTokGaming'],
    viralScore: 71,
  },
  // Week 2 - Tuesday
  {
    id: 'post-020',
    caption: 'Tokenomics deep dive: How our in-game economy is designed for sustainable growth.',
    platform: 'YouTube',
    status: 'draft',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 8)),
    scheduledTime: '18:00',
    hashtags: ['#Tokenomics', '#DeepDive', '#YouTube', '#Web3'],
  },
  {
    id: 'post-021',
    caption: 'Fan art Friday... on Tuesday? We could not wait to share this amazing piece from @artistname!',
    platform: 'Instagram',
    status: 'scheduled',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 8)),
    scheduledTime: '17:00',
    hashtags: ['#FanArt', '#Community', '#Instagram', '#Art'],
  },
  // Week 2 - Wednesday
  {
    id: 'post-022',
    caption: 'Mid-week tournament results are in! Check out who climbed the leaderboard!',
    platform: 'X',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 9)),
    scheduledTime: '19:00',
    hashtags: ['#Tournament', '#Leaderboard', '#Bombermeme', '#MidWeek'],
    viralScore: 59,
  },
  {
    id: 'post-023',
    caption: 'FLOKI Arena Domination - Watch how FLOKI players are taking over the new arena!',
    platform: 'TikTok',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 9)),
    scheduledTime: '20:30',
    hashtags: ['#FLOKI', '#Arena', '#Domination', '#TikTok'],
    viralScore: 85,
  },
  // Week 2 - Thursday
  {
    id: 'post-024',
    caption: 'Patch preview: Sneak peek at the balance changes coming next week. What do you think?',
    platform: 'X',
    status: 'draft',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 10)),
    scheduledTime: '18:00',
    hashtags: ['#PatchNotes', '#Preview', '#Bombermeme', '#GameUpdate'],
  },
  {
    id: 'post-025',
    caption: 'Telegram AMA announcement - Join us this Friday for a live AMA with the dev team!',
    platform: 'Telegram',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 10)),
    scheduledTime: '15:00',
    hashtags: ['#AMA', '#DevTeam', '#Telegram', '#Community'],
  },
  // Week 2 - Friday
  {
    id: 'post-026',
    caption: 'Friday Flashback: Our most viral clip ever. 5M views and counting!',
    platform: 'TikTok',
    status: 'published',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 11)),
    scheduledTime: '19:00',
    hashtags: ['#FridayFlashback', '#Viral', '#TikTok', '#5MViews'],
    viralScore: 95,
  },
  {
    id: 'post-027',
    caption: 'Weekend tournament announcement - Bigger prizes, new format, more fun! Register now!',
    platform: 'X',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 11)),
    scheduledTime: '17:00',
    hashtags: ['#Tournament', '#Weekend', '#Bombermeme', '#Register'],
  },
  // Week 2 - Saturday
  {
    id: 'post-028',
    caption: 'Livestream highlight: When chat decided the strategy and we somehow WON!',
    platform: 'YouTube',
    status: 'scheduled',
    contentType: 'video',
    scheduledDate: formatDate(addDays(new Date(monday), 12)),
    scheduledTime: '16:00',
    hashtags: ['#Livestream', '#Highlight', '#YouTube', '#ChatPlays'],
    viralScore: 70,
  },
  {
    id: 'post-029',
    caption: 'Community challenge results: You all crushed it! Here are the best submissions.',
    platform: 'Instagram',
    status: 'scheduled',
    contentType: 'image',
    scheduledDate: formatDate(addDays(new Date(monday), 12)),
    scheduledTime: '14:00',
    hashtags: ['#CommunityChallenge', '#Results', '#Instagram', '#BestOf'],
  },
  // Week 2 - Sunday
  {
    id: 'post-030',
    caption: 'Week 2 wrap-up: Thank you all for an amazing week. Here is what is coming next!',
    platform: 'Telegram',
    status: 'scheduled',
    contentType: 'text',
    scheduledDate: formatDate(addDays(new Date(monday), 13)),
    scheduledTime: '18:00',
    hashtags: ['#WrapUp', '#Week2', '#Telegram', '#ThankYou'],
  },
];

// AI Scheduling Suggestions
export interface AISuggestion {
  id: string;
  title: string;
  detail: string;
  expectedEngagement: string;
  platform: Platform;
  confidence: number;
  suggestedDate: string;
  suggestedTime: string;
  applied: boolean;
}

export const aiSuggestions: AISuggestion[] = [
  {
    id: 'ai-001',
    title: 'Schedule a PEPE clip for Wed 8 PM',
    detail: 'Your PEPE content gets 3x engagement on Wednesdays. Optimal window: 8-9 PM.',
    expectedEngagement: '+45% vs avg',
    platform: 'TikTok',
    confidence: 91,
    suggestedDate: formatDate(addDays(new Date(monday), 2)),
    suggestedTime: '20:00',
    applied: false,
  },
  {
    id: 'ai-002',
    title: 'Add a second X post on Friday',
    detail: 'Friday evening posts have 28% higher reach for gaming content.',
    expectedEngagement: '+28% reach',
    platform: 'X',
    confidence: 84,
    suggestedDate: formatDate(addDays(new Date(monday), 4)),
    suggestedTime: '19:30',
    applied: false,
  },
  {
    id: 'ai-003',
    title: 'Telegram community update overdue',
    detail: 'No Telegram post in 5 days. Community engagement drops 15% after 4 days.',
    expectedEngagement: 'Re-engage',
    platform: 'Telegram',
    confidence: 78,
    suggestedDate: formatDate(addDays(new Date(monday), 1)),
    suggestedTime: '12:00',
    applied: false,
  },
];

// Optimal posting times by platform (hour ranges in UTC)
export interface OptimalTime {
  platform: Platform;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startHour: number; // UTC hour
  endHour: number; // UTC hour
  engagementScore: number;
}

export const optimalTimes: OptimalTime[] = [
  { platform: 'TikTok', dayOfWeek: 1, startHour: 19, endHour: 21, engagementScore: 92 },
  { platform: 'TikTok', dayOfWeek: 3, startHour: 20, endHour: 22, engagementScore: 88 },
  { platform: 'TikTok', dayOfWeek: 5, startHour: 19, endHour: 21, engagementScore: 90 },
  { platform: 'X', dayOfWeek: 1, startHour: 13, endHour: 15, engagementScore: 85 },
  { platform: 'X', dayOfWeek: 2, startHour: 18, endHour: 20, engagementScore: 87 },
  { platform: 'X', dayOfWeek: 5, startHour: 19, endHour: 21, engagementScore: 89 },
  { platform: 'Instagram', dayOfWeek: 2, startHour: 15, endHour: 17, engagementScore: 82 },
  { platform: 'Instagram', dayOfWeek: 6, startHour: 14, endHour: 16, engagementScore: 84 },
  { platform: 'YouTube', dayOfWeek: 3, startHour: 16, endHour: 19, engagementScore: 80 },
  { platform: 'Telegram', dayOfWeek: 5, startHour: 18, endHour: 20, engagementScore: 75 },
];

// Stats data
export const getCalendarStats = (posts: CalendarPost[]) => {
  const scheduled = posts.filter(p => p.status === 'scheduled').length;
  const published = posts.filter(p => p.status === 'published').length;
  const drafts = posts.filter(p => p.status === 'draft').length;
  const optimalSlots = optimalTimes.length;
  return { scheduled, published, drafts, optimalSlots };
};

// Platform breakdown data
export interface PlatformBreakdown {
  platform: Platform;
  total: number;
  scheduled: number;
  published: number;
  draft: number;
  estReach: number;
}

export const getPlatformBreakdown = (posts: CalendarPost[]): PlatformBreakdown[] => {
  const platforms: Platform[] = ['X', 'TikTok', 'Instagram', 'YouTube', 'Telegram'];
  return platforms.map(platform => {
    const platformPosts = posts.filter(p => p.platform === platform);
    return {
      platform,
      total: platformPosts.length,
      scheduled: platformPosts.filter(p => p.status === 'scheduled').length,
      published: platformPosts.filter(p => p.status === 'published').length,
      draft: platformPosts.filter(p => p.status === 'draft').length,
      estReach: platformPosts.reduce((acc, p) => acc + (p.viralScore || 0) * 2, 0),
    };
  });
};

// Predefined hashtag suggestions
export const hashtagSuggestions = [
  '#Bombermeme', '#Web3Gaming', '#MemeCoin', '#PEPE', '#DOGE',
  '#GamingClips', '#TikTokGaming', '#GameDev', '#CryptoGaming',
  '#NFTGaming', '#BlockchainGaming', '#PlayToEarn', '#ViralGaming',
  '#Community', '#Tournament', '#LiveStream', '#GamingHighlight',
];
