import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Video,
  Image,
  FileText,
  Sparkles,
  Hash,
  Paperclip,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';
import PlatformIcon from '@/components/PlatformIcon';
import type { Platform } from '@/components/PlatformIcon';
import type { CalendarPost, ContentType } from '@/data/calendarData';
import { hashtagSuggestions } from '@/data/calendarData';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (post: CalendarPost) => void;
  initialDate?: string;
  initialTime?: string;
  prefilledPlatform?: Platform;
  prefilledCaption?: string;
}

const platforms: Platform[] = ['X', 'TikTok', 'Instagram', 'YouTube', 'Telegram'];
const contentTypes: ContentType[] = ['video', 'image', 'text'];
const contentTypeIcons = { video: Video, image: Image, text: FileText };
const statuses: Array<'draft' | 'scheduled'> = ['draft', 'scheduled'];

export default function QuickAddModal({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialTime = '12:00',
  prefilledPlatform,
  prefilledCaption = '',
}: QuickAddModalProps) {
  const [platform, setPlatform] = useState<Platform>(prefilledPlatform || 'X');
  const [caption, setCaption] = useState(prefilledCaption);
  const [hashtags, setHashtags] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [status, setStatus] = useState<'draft' | 'scheduled'>('scheduled');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialTime);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);
  const [aiGenerate, setAiGenerate] = useState(false);
  const [aiCaption, setAiCaption] = useState('');
  const [mediaAttached, setMediaAttached] = useState(false);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPlatform(prefilledPlatform || 'X');
      setCaption(prefilledCaption || '');
      setHashtags('');
      setContentType('text');
      setStatus('scheduled');
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setTime(initialTime);
      setAiGenerate(false);
      setAiCaption('');
      setMediaAttached(false);
    }
  }, [isOpen, initialDate, initialTime, prefilledPlatform, prefilledCaption]);

  const handleSave = () => {
    const captionText = aiGenerate && aiCaption ? aiCaption : caption;
    const allHashtags = [...hashtags.split(/\s+/).filter(Boolean)];
    // Extract hashtags from caption
    const captionHashtags = captionText.match(/#\w+/g) || [];
    const combinedHashtags = [...new Set([...allHashtags, ...captionHashtags])];

    const newPost: CalendarPost = {
      id: `post-${Date.now()}`,
      caption: captionText,
      platform,
      status,
      contentType,
      scheduledDate: date,
      scheduledTime: time,
      hashtags: combinedHashtags.length > 0 ? combinedHashtags : [],
      viralScore: Math.floor(Math.random() * 40) + 50,
    };
    onSave(newPost);
    onClose();
  };

  const generateAiCaption = () => {
    const templates = [
      `Just dropped a new ${contentType} featuring the latest Bombermeme action! The arena is on fire right now. `,
      `Community highlight: Check out this insane play from last nights tournament! `,
      `Dev update: We have been working on something special. Heres a sneak peek of what is coming! `,
      `When you think the round is over but then THIS happens... `,
    ];
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    setAiCaption(randomTemplate + `What do you think? Let us know in the comments! #Bombermeme #${platform}`);
  };

  const addHashtag = (tag: string) => {
    const current = hashtags.trim();
    setHashtags(current ? `${current} ${tag}` : tag);
    setShowHashtagSuggestions(false);
  };

  const isValid = (aiGenerate && aiCaption) || caption.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[rgba(10,10,15,0.7)] backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number] }}
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-auto md:left-1/2 md:-translate-x-1/2 
              md:w-full md:max-w-lg md:max-h-[85vh] bg-bg-surface rounded-2xl z-50 
              overflow-hidden flex flex-col border border-white/[0.06] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06] flex-shrink-0">
              <h2 className="font-orbitron text-lg font-semibold text-white">Create New Post</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-surface-hover transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* AI Toggle */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl border border-accent-purple/20"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(6,182,212,0.08) 100%)' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-accent-purple" />
                  <span className="text-sm font-medium text-white">AI-Generate Caption</span>
                </div>
                <button
                  onClick={() => {
                    setAiGenerate(!aiGenerate);
                    if (!aiGenerate) generateAiCaption();
                  }}
                  className={`
                    w-11 h-6 rounded-full transition-colors relative
                    ${aiGenerate ? 'bg-accent-purple' : 'bg-white/10'}
                  `}
                >
                  <motion.div
                    animate={{ x: aiGenerate ? 20 : 2 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
                  />
                </button>
              </motion.div>

              {/* Caption */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Post Content
                </label>
                {aiGenerate ? (
                  <div className="relative">
                    <textarea
                      value={aiCaption}
                      onChange={(e) => setAiCaption(e.target.value)}
                      className="w-full bg-bg-surface-raised border border-white/[0.08] rounded-lg p-3 text-sm text-white 
                        focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/30
                        resize-none min-h-[100px] transition-all"
                    />
                    <button
                      onClick={generateAiCaption}
                      className="absolute bottom-2 right-2 p-1.5 rounded-md bg-accent-purple/20 
                        text-accent-purple hover:bg-accent-purple/30 transition-colors"
                    >
                      <Sparkles size={14} />
                    </button>
                  </div>
                ) : (
                  <textarea
                    ref={captionRef}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write your caption here..."
                    className="w-full bg-bg-surface-raised border border-white/[0.08] rounded-lg p-3 text-sm text-white 
                      focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/30
                      resize-none min-h-[100px] transition-all placeholder:text-text-muted/50"
                  />
                )}
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-text-muted">
                    {(aiGenerate ? aiCaption : caption).length} chars
                  </span>
                  {aiGenerate && (
                    <span className="text-[11px] text-accent-purple flex items-center gap-1">
                      <Sparkles size={10} /> AI Generated
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Platform Selector */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="relative"
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Platform
                </label>
                <button
                  onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-bg-surface-raised 
                    border border-white/[0.08] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={platform} size={18} />
                    <span className="text-sm text-white">{platform}</span>
                  </div>
                  <ChevronDown size={16} className="text-text-muted" />
                </button>
                <AnimatePresence>
                  {showPlatformDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute z-20 w-full mt-1 py-1 rounded-lg bg-bg-surface-raised 
                        border border-white/[0.08] shadow-xl"
                    >
                      {platforms.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setPlatform(p);
                            setShowPlatformDropdown(false);
                          }}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            hover:bg-bg-surface-hover transition-colors
                            ${p === platform ? 'text-white bg-bg-surface-hover' : 'text-text-secondary'}
                          `}
                        >
                          <PlatformIcon platform={p} size={16} />
                          {p}
                          {p === platform && <Check size={14} className="ml-auto text-accent-purple" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Date & Time */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-bg-surface-raised border border-white/[0.08] 
                      text-sm text-white focus:border-accent-purple focus:outline-none
                      [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-bg-surface-raised border border-white/[0.08] 
                      text-sm text-white focus:border-accent-purple focus:outline-none
                      [color-scheme:dark]"
                  />
                </div>
              </motion.div>

              {/* Content Type */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Content Type
                </label>
                <div className="flex gap-2">
                  {contentTypes.map((type) => {
                    const Icon = contentTypeIcons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setContentType(type)}
                        className={`
                          flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm
                          transition-all capitalize
                          ${contentType === type
                            ? 'border-accent-purple bg-accent-purple/10 text-white'
                            : 'border-white/[0.08] bg-bg-surface-raised text-text-secondary hover:text-white hover:bg-bg-surface-hover'
                          }
                        `}
                      >
                        <Icon size={16} />
                        {type}
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Hashtags */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="relative"
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Hashtags
                </label>
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    onFocus={() => setShowHashtagSuggestions(true)}
                    placeholder="Type or select hashtags..."
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-bg-surface-raised border border-white/[0.08] 
                      text-sm text-white focus:border-accent-purple focus:outline-none
                      placeholder:text-text-muted/50"
                  />
                </div>
                {/* Hashtag suggestions */}
                <AnimatePresence>
                  {showHashtagSuggestions && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-20 w-full mt-1 p-2 rounded-lg bg-bg-surface-raised 
                        border border-white/[0.08] shadow-xl max-h-32 overflow-y-auto"
                    >
                      <div className="flex flex-wrap gap-1">
                        {hashtagSuggestions.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => addHashtag(tag)}
                            className="px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple text-xs
                              hover:bg-accent-purple/20 transition-colors flex items-center gap-1"
                          >
                            <Plus size={10} />
                            {tag}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {hashtags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hashtags.split(/\s+/).filter(Boolean).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Media Attachment */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Media Attachment
                </label>
                <button
                  onClick={() => setMediaAttached(!mediaAttached)}
                  className={`
                    w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed
                    transition-all text-sm
                    ${mediaAttached
                      ? 'border-accent-green bg-accent-green/10 text-accent-green'
                      : 'border-white/[0.08] text-text-muted hover:border-accent-purple/30 hover:text-text-secondary'
                    }
                  `}
                >
                  <Paperclip size={16} />
                  {mediaAttached ? 'Media Attached' : 'Attach Media (Optional)'}
                </button>
              </motion.div>

              {/* Status */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
              >
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                  Status
                </label>
                <div className="flex gap-2">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`
                        flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize
                        transition-all
                        ${status === s
                          ? s === 'scheduled'
                            ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                            : 'border-text-muted bg-text-muted/10 text-text-secondary'
                          : 'border-white/[0.08] bg-bg-surface-raised text-text-muted hover:text-white'
                        }
                      `}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-white/[0.06] flex gap-3 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={!isValid}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm
                  transition-all
                  ${isValid
                    ? 'bg-gradient-to-r from-accent-purple to-accent-cyan text-white hover:shadow-glow-purple'
                    : 'bg-bg-surface-raised text-text-muted cursor-not-allowed'
                  }
                `}
              >
                {status === 'scheduled' ? 'Schedule Post' : 'Save as Draft'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-white/[0.08] text-text-secondary 
                  hover:bg-bg-surface-hover hover:text-white transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
