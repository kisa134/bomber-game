// ============================================================
// Video Hub — Extended Mock Data
// ============================================================

export type MomentType = 'Kill' | 'Clutch' | 'Escape' | 'Win';

export interface DetectedMoment {
  id: number;
  type: MomentType;
  timestamp: string;     // "MM:SS"
  timestampSeconds: number;
  confidence: number;    // 0–100
  description: string;
  selected?: boolean;
}

export interface GeneratedClip {
  id: number;
  title: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'X' | 'Telegram';
  aspectRatio: string;
  viralScore: number;
  duration: string;
  thumbnail: string;
  status: 'published' | 'scheduled' | 'processing' | 'draft';
  caption: string;
  createdAt: string;
}

export interface PlatformCaption {
  platform: string;
  caption: string;
  characterLimit: number;
}

export interface HashtagCategory {
  name: string;
  tags: string[];
}

export interface ViralFactor {
  name: string;
  score: number;
}

export interface EngagementTip {
  type: 'mention' | 'time' | 'prediction';
  label: string;
  value: string;
  detail?: string;
}

// ---- Detected Moments --------------------------------------------------

export const detectedMoments: DetectedMoment[] = [
  { id: 1, type: 'Kill', timestamp: '00:32', timestampSeconds: 32, confidence: 96, description: 'PEPE 3-kill streak', selected: true },
  { id: 2, type: 'Clutch', timestamp: '01:24', timestampSeconds: 84, confidence: 91, description: '1v3 comeback win', selected: false },
  { id: 3, type: 'Escape', timestamp: '02:15', timestampSeconds: 135, confidence: 87, description: 'Near-death bomb dodge', selected: false },
  { id: 4, type: 'Win', timestamp: '03:08', timestampSeconds: 188, confidence: 98, description: 'Match victory + taunt', selected: false },
  { id: 5, type: 'Kill', timestamp: '03:45', timestampSeconds: 225, confidence: 82, description: 'Double kill with trap', selected: false },
  { id: 6, type: 'Escape', timestamp: '04:12', timestampSeconds: 252, confidence: 79, description: 'Last-second powerup grab', selected: false },
];

// ---- Generated Clips Gallery -------------------------------------------

export const generatedClips: GeneratedClip[] = [
  { id: 1, title: 'PEPE Clutch 1v3', platform: 'TikTok', aspectRatio: '9:16', viralScore: 87, duration: '00:32', thumbnail: '/assets/clip-thumb-1.jpg', status: 'published', caption: 'PEPE goes CLUTCH 1v3 \n#Bombermeme #PEPE', createdAt: '2024-01-15' },
  { id: 2, title: 'PEPE Clutch 1v3', platform: 'Instagram', aspectRatio: '1:1', viralScore: 84, duration: '00:32', thumbnail: '/assets/clip-thumb-1.jpg', status: 'published', caption: 'When PEPE hits that 1v3 clutch \n#Bombermeme #PEPE #Gaming', createdAt: '2024-01-15' },
  { id: 3, title: 'PEPE Clutch 1v3', platform: 'YouTube', aspectRatio: '9:16', viralScore: 89, duration: '00:30', thumbnail: '/assets/clip-thumb-1.jpg', status: 'scheduled', caption: 'PEPE 1v3 Clutch - Bombermeme Gameplay Highlights', createdAt: '2024-01-14' },
  { id: 4, title: 'DOGE Escape', platform: 'TikTok', aspectRatio: '9:16', viralScore: 74, duration: '00:18', thumbnail: '/assets/clip-thumb-2.jpg', status: 'published', caption: 'DOGE almost got rekt \n#Bombermeme #DOGE', createdAt: '2024-01-13' },
  { id: 5, title: 'DOGE Escape', platform: 'X', aspectRatio: '2:3', viralScore: 71, duration: '00:18', thumbnail: '/assets/clip-thumb-2.jpg', status: 'published', caption: 'Near-death escape in Bombermeme. DOGE lives to fight another day.', createdAt: '2024-01-13' },
  { id: 6, title: 'MUSK Kill Streak', platform: 'TikTok', aspectRatio: '9:16', viralScore: 91, duration: '00:45', thumbnail: '/assets/clip-thumb-3.jpg', status: 'scheduled', caption: 'MUSK is unstoppable \n#Bombermeme #MUSK', createdAt: '2024-01-12' },
  { id: 7, title: 'MUSK Kill Streak', platform: 'YouTube', aspectRatio: '9:16', viralScore: 93, duration: '00:45', thumbnail: '/assets/clip-thumb-3.jpg', status: 'published', caption: 'MUSK Epic Kill Streak - Bombermeme Gameplay', createdAt: '2024-01-12' },
  { id: 8, title: 'MUSK Kill Streak', platform: 'Instagram', aspectRatio: '1:1', viralScore: 88, duration: '00:45', thumbnail: '/assets/clip-thumb-3.jpg', status: 'draft', caption: 'The streak is REAL \n#Bombermeme #MUSK #Gaming', createdAt: '2024-01-11' },
];

// ---- AI-Generated Platform Captions ------------------------------------

export const platformCaptions: PlatformCaption[] = [
  { platform: 'X', caption: 'PEPE just dropped the sickest 1v3 clutch I\'ve ever seen \n#Bombermeme', characterLimit: 280 },
  { platform: 'TikTok', caption: 'this PEPE clutch had me SHOOK \n#Bombermeme #PEPE #Skill2Earn', characterLimit: 2200 },
  { platform: 'Instagram', caption: 'When the 1v3 clutch hits different \n#Bombermeme #PEPE #Web3Gaming #SolanaGaming #MemeCoin', characterLimit: 2200 },
  { platform: 'YouTube', caption: 'PEPE 1v3 Clutch - Bombermeme Gameplay Highlights. Watch PEPE pull off an incredible 1v3 comeback in this epic Bombermeme match. #Bombermeme #PEPE #Web3Gaming', characterLimit: 5000 },
];

// ---- Smart Hashtag Suggestions -----------------------------------------

export const hashtagCategories: HashtagCategory[] = [
  { name: 'Game Tags', tags: ['#Bombermeme', '#SolanaGaming', '#Skill2Earn'] },
  { name: 'Meme Tags', tags: ['#PEPE', '#DOGE', '#MUSK'] },
  { name: 'Trend Tags', tags: ['#Skill2Earn', '#Web3Gaming', '#GameFi'] },
  { name: 'Community', tags: ['#Web3', '#Solana', '#CryptoGaming'] },
];

// ---- Viral Score Factors -----------------------------------------------

export const viralFactors: ViralFactor[] = [
  { name: 'Action Intensity', score: 92 },
  { name: 'Meme Factor', score: 88 },
  { name: 'Audio Energy', score: 74 },
  { name: 'Visual Clarity', score: 85 },
  { name: 'Trend Alignment', score: 90 },
];

export const overallViralScore = 87;

export const viralScoreExplanation = 'This clip has high action intensity and strong meme appeal. The PEPE character\'s 3-kill streak aligns with current trending content.';

// ---- Engagement Tips ---------------------------------------------------

export const engagementTips: EngagementTip[] = [
  { type: 'mention', label: 'Tag', value: '@Bombermeme', detail: 'Official account for reshares' },
  { type: 'mention', label: 'Tag', value: '@PEPEcoin', detail: 'Community crossover potential' },
  { type: 'time', label: 'Best Time', value: '7:00–9:00 PM UTC', detail: 'Peak engagement window' },
  { type: 'prediction', label: 'Est. Reach', value: '12.5K views', detail: 'Based on similar clips' },
];

// ---- Platform Format Config --------------------------------------------

export interface PlatformFormat {
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'X' | 'Telegram';
  aspectRatio: string;
  resolution: string;
  durationLimit: string;
  color: string;
}

export const platformFormats: PlatformFormat[] = [
  { platform: 'TikTok', aspectRatio: '9:16', resolution: '375x667', durationLimit: '90s', color: '#EC4899' },
  { platform: 'Instagram', aspectRatio: '1:1', resolution: '400x400', durationLimit: '90s', color: '#E4405F' },
  { platform: 'YouTube', aspectRatio: '16:9', resolution: '480x270', durationLimit: '60s', color: '#FF0000' },
  { platform: 'X', aspectRatio: '2:3', resolution: '300x450', durationLimit: '140s', color: '#9CA3AF' },
  { platform: 'Telegram', aspectRatio: '16:9', resolution: '480x270', durationLimit: 'No limit', color: '#26A5E4' },
];

// ---- Upload State Helpers ----------------------------------------------

export const videoDuration = 330; // 5:30 in seconds

export const videoDurationFormatted = '05:30';
