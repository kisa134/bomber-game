import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, Check, Zap } from 'lucide-react';
import PlatformIcon from '@/components/PlatformIcon';
import type { AISuggestion } from '@/data/calendarData';

interface AISuggestionsPanelProps {
  suggestions: AISuggestion[];
  onSchedule: (suggestion: AISuggestion) => void;
}

export default function AISuggestionsPanel({ suggestions, onSchedule }: AISuggestionsPanelProps) {
  const [appliedIds, setAppliedIds] = useState<string[]>([]);

  const handleSchedule = (suggestion: AISuggestion) => {
    setAppliedIds((prev) => [...prev, suggestion.id]);
    onSchedule(suggestion);
  };

  return (
    <div
      className="rounded-2xl border border-white/[0.06] backdrop-blur-2xl p-6 relative overflow-hidden"
      style={{ background: 'rgba(26, 26, 38, 0.4)' }}
    >
      {/* Top accent gradient border */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4, #EC4899)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-accent-purple" />
          <h3 className="font-orbitron text-lg font-semibold text-white">
            AI Scheduling Assistant
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
          </span>
          <span className="text-[11px] font-mono text-accent-green uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="space-y-4">
        {suggestions.map((suggestion, idx) => {
          const isApplied = appliedIds.includes(suggestion.id);

          return (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              className={`
                flex items-start gap-4 p-4 rounded-xl border transition-all
                ${isApplied
                  ? 'border-accent-green/20 bg-accent-green/5'
                  : 'border-white/[0.06] bg-bg-surface-raised/50 hover:border-white/[0.10]'
                }
              `}
            >
              {/* Left: Time icon with float animation */}
              <motion.div
                animate={!isApplied ? { y: [-1.5, 1.5, -1.5] } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-bg-surface-raised 
                  flex items-center justify-center border border-white/[0.06]"
              >
                <Clock size={18} className="text-accent-purple" />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-white mb-1">
                  {suggestion.title}
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed mb-2">
                  {suggestion.detail}
                </p>

                {/* Metrics row */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Zap size={10} className="text-accent-amber" />
                    <span className="text-[11px] font-mono text-accent-amber">
                      {suggestion.expectedEngagement}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PlatformIcon platform={suggestion.platform} size={12} />
                    <span className="text-[11px] text-text-muted">{suggestion.platform}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${suggestion.confidence}%` }}
                        transition={{ delay: idx * 0.1 + 0.3, duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">
                      {suggestion.confidence}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action button */}
              <div className="flex-shrink-0">
                {isApplied ? (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent-green/10 text-accent-green">
                    <Check size={14} />
                    <span className="text-[11px] font-medium">Applied</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSchedule(suggestion)}
                    className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs font-medium
                      text-text-secondary hover:text-white hover:border-accent-purple/30 
                      hover:bg-accent-purple/10 transition-all"
                  >
                    Schedule It
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
