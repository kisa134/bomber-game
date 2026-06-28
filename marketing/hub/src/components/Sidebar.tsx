import type { FC } from 'react';
import { NavLink, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Coins,
  Trophy,
  Activity,
  Brain,
  Plug,
  Video,
  BarChart3,
  CalendarDays,
  Globe,
  ChevronLeft,
  ChevronRight,
  Bomb,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  // Реальные операции (живые данные проекта)
  { path: '/', label: 'Пульт', icon: LayoutDashboard, group: 'ops' },
  { path: '/players', label: 'Игроки', icon: Users, group: 'ops' },
  { path: '/money', label: 'Деньги', icon: Coins, group: 'ops' },
  { path: '/tournaments', label: 'Турниры', icon: Trophy, group: 'ops' },
  { path: '/system', label: 'Система', icon: Activity, group: 'ops' },
  { path: '/connections', label: 'Подключения', icon: Plug, group: 'ops' },
  { path: '/ai', label: 'ИИ-директор', icon: Brain, group: 'ops' },
  // Маркетинг / контент (demo-данные до подключения соц-API)
  { path: '/market-intel', label: 'Аналитика рынка', icon: Globe, group: 'mkt' },
  { path: '/content', label: 'Контент-хаб', icon: Video, group: 'mkt' },
  { path: '/calendar', label: 'Календарь', icon: CalendarDays, group: 'mkt' },
  { path: '/analytics', label: 'Аналитика соц', icon: BarChart3, group: 'mkt' },
  { path: '/video-hub', label: 'Видео', icon: Video, group: 'mkt' },
];

const Sidebar: FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="
        fixed left-0 top-0 bottom-0 z-40
        bg-bg-surface border-r border-white/[0.06]
        flex flex-col
      "
    >
      {/* Logo area */}
      <div className="h-14 flex items-center px-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center flex-shrink-0">
            <Bomb size={18} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-orbitron text-[15px] font-bold text-white whitespace-nowrap overflow-hidden"
              >
                BOMBERMEME
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item, idx) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const divider = item.group === 'mkt' && navItems[idx - 1]?.group !== 'mkt';

          return (
            <div key={item.path}>
            {divider && !collapsed && <div className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Marketing</div>}
            {divider && collapsed && <div className="my-2 mx-3 border-t border-white/[0.06]" />}
            <NavLink
              to={item.path}
              className={`
                relative flex items-center gap-3 h-10 px-3 rounded-lg
                transition-all duration-200 group
                ${isActive
                  ? 'text-white'
                  : 'text-text-secondary hover:text-white hover:bg-bg-surface-hover'
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-accent-purple"
                  transition={{ duration: 0.2 }}
                />
              )}
              {isActive && (
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'rgba(139, 92, 246, 0.08)' }}
                />
              )}

              <Icon
                size={20}
                className={`
                  flex-shrink-0 relative z-10
                  ${isActive ? 'text-accent-purple' : 'text-text-secondary group-hover:text-white'}
                `}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`
                      text-sm font-medium whitespace-nowrap overflow-hidden relative z-10
                      ${isActive ? 'text-white' : ''}
                    `}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-white/[0.06] space-y-1">
        <button
          onClick={onToggle}
          className="
            w-full flex items-center justify-center gap-2 h-9 px-3 rounded-lg
            text-text-secondary hover:text-white hover:bg-bg-surface-hover
            transition-all duration-200
          "
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <span className="text-[11px] font-mono text-text-muted">v1.0.0</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
