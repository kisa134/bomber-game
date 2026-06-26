import type { FC } from 'react';
import { Bell, Search, Settings, Menu } from 'lucide-react';
import { useLocation } from 'react-router';

interface TopNavbarProps {
  onMenuToggle: () => void;
}

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/video-hub': 'Video Hub',
  '/analytics': 'Analytics',
  '/calendar': 'Calendar',
  '/market-intel': 'Market Intel',
};

const TopNavbar: FC<TopNavbarProps> = ({ onMenuToggle }) => {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header
      className="
        sticky top-0 z-30 h-14
        flex items-center justify-between
        px-4 lg:px-6
        border-b border-white/[0.06]
      "
      style={{
        background: 'rgba(18, 18, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: Hamburger + Page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="
            lg:hidden
            p-2 rounded-lg
            text-text-secondary hover:text-white hover:bg-bg-surface-hover
            transition-colors
          "
        >
          <Menu size={20} />
        </button>
        <h1 className="font-inter text-lg font-semibold text-white tracking-tight">
          {pageTitle}
        </h1>
      </div>

      {/* Center: AI Status Pill */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
        </span>
        <span className="text-[11px] font-mono font-medium text-accent-green tracking-wide">
          AI Engine Online
        </span>
      </div>

      {/* Right: Search, Notifications, Avatar, Settings */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-surface-raised border border-white/[0.06] focus-within:border-accent-purple/50 transition-colors">
          <Search size={16} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-white placeholder:text-text-muted outline-none w-32 lg:w-48"
          />
        </div>

        {/* Notification bell */}
        <button className="relative p-2 rounded-lg text-text-secondary hover:text-white hover:bg-bg-surface-hover transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-pink rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-bg-surface-hover transition-colors">
          <Settings size={20} />
        </button>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center cursor-pointer">
          <span className="text-white text-sm font-semibold">BM</span>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
