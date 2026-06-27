import type { FC, ReactElement } from 'react';

export type Platform = 'X' | 'TikTok' | 'Instagram' | 'YouTube' | 'Telegram';

interface PlatformIconProps {
  platform: Platform;
  size?: number;
  className?: string;
}

const platformColors: Record<Platform, string> = {
  X: '#9CA3AF',
  TikTok: '#EC4899',
  Instagram: '#E4405F',
  YouTube: '#FF0000',
  Telegram: '#26A5E4',
};

const PlatformIcon: FC<PlatformIconProps> = ({ platform, size = 20, className = '' }) => {
  const color = platformColors[platform];

  const icons: Record<Platform, ReactElement> = {
    X: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill={color} />
      </svg>
    ),
    TikTok: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0011.22 4.05v-7.15a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-3.77-1.52 4.83 4.83 0 003.77-1.52V6.69h-.55z" fill={color} />
      </svg>
    ),
    Instagram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke={color} strokeWidth="2" fill="none" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" stroke={color} strokeWidth="2" fill="none" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    YouTube: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.13c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.46z" fill={color} />
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#fff" />
      </svg>
    ),
    Telegram: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill={color} />
      </svg>
    ),
  };

  return icons[platform] || null;
};

export default PlatformIcon;
