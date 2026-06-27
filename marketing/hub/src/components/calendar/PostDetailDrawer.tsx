import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  Hash,
  TrendingUp,
  Video,
  Image,
  FileText,
  Sparkles,
  RotateCcw,
  Save,
} from 'lucide-react';
import PlatformIcon from '@/components/PlatformIcon';
import type { CalendarPost } from '@/data/calendarData';
import { platformColors } from '@/data/calendarData';

interface PostDetailDrawerProps {
  post: CalendarPost | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (postId: string) => void;
  onReschedule: (postId: string, newDate: string, newTime: string) => void;
  onStatusChange: (postId: string, status: 'draft' | 'scheduled' | 'published') => void;
  onSave: (post: CalendarPost) => void;
}

const contentTypeIcons = {
  video: Video,
  image: Image,
  text: FileText,
};

const statusConfig = {
  draft: { label: 'Draft', color: 'text-text-muted', bg: 'bg-text-muted/15' },
  scheduled: { label: 'Scheduled', color: 'text-accent-amber', bg: 'bg-accent-amber/15' },
  published: { label: 'Published', color: 'text-accent-green', bg: 'bg-accent-amber/15' },
};

export default function PostDetailDrawer({
  post,
  isOpen,
  onClose,
  onDelete,
  onReschedule,
  onStatusChange,
  onSave,
}: PostDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [editedHashtags, setEditedHashtags] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!post) return null;

  const ContentIcon = contentTypeIcons[post.contentType];
  const platformColor = platformColors[post.platform];
  const status = statusConfig[post.status];

  const handleEdit = () => {
    setEditedCaption(post.caption);
    setEditedHashtags(post.hashtags.join(' '));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (post) {
      onSave({
        ...post,
        caption: editedCaption,
        hashtags: editedHashtags.split(/\s+/).filter(Boolean),
      });
      setIsEditing(false);
    }
  };

  const handleRescheduleToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onReschedule(post.id, tomorrow.toISOString().split('T')[0], post.scheduledTime);
  };

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

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] as [number, number, number, number] }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-bg-surface z-50 overflow-y-auto"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-bg-surface/95 backdrop-blur-sm border-b border-white/[0.06]">
              <h2 className="font-orbitron text-xl font-semibold text-white">
                {isEditing ? 'Edit Post' : 'Post Details'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-bg-surface-hover transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Platform badge + Status */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center gap-3"
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: `${platformColor}15` }}
                >
                  <PlatformIcon platform={post.platform} size={18} />
                  <span className="text-sm font-medium" style={{ color: platformColor }}>
                    {post.platform}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-bg-surface-raised">
                  <ContentIcon size={12} className="text-text-muted" />
                  <span className="text-[11px] text-text-muted capitalize">{post.contentType}</span>
                </div>
              </motion.div>

              {/* Date & Time */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 text-sm text-text-secondary"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-text-muted" />
                  <span className="font-mono">{post.scheduledDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-text-muted" />
                  <span className="font-mono">{post.scheduledTime}</span>
                </div>
              </motion.div>

              {/* Caption */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Caption
                </h3>
                {isEditing ? (
                  <textarea
                    value={editedCaption}
                    onChange={(e) => setEditedCaption(e.target.value)}
                    className="w-full bg-bg-surface-raised border border-white/[0.08] rounded-lg p-3 text-sm text-white 
                      focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/30
                      resize-none min-h-[100px] transition-all"
                  />
                ) : (
                  <p className="text-sm text-white leading-relaxed bg-bg-surface-raised/50 rounded-lg p-3">
                    {post.caption}
                  </p>
                )}
              </motion.div>

              {/* Hashtags */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Hashtags
                </h3>
                {isEditing ? (
                  <textarea
                    value={editedHashtags}
                    onChange={(e) => setEditedHashtags(e.target.value)}
                    className="w-full bg-bg-surface-raised border border-white/[0.08] rounded-lg p-3 text-sm text-white 
                      focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple/30
                      resize-none min-h-[60px] transition-all"
                    placeholder="Enter hashtags separated by spaces..."
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {post.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple text-xs font-medium"
                      >
                        <Hash size={10} />
                        {tag.replace('#', '')}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Viral Score */}
              {post.viralScore !== undefined && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-xl p-4 border border-white/[0.06]"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(6,182,212,0.08) 100%)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className="text-accent-purple" />
                      <span className="text-sm font-medium text-white">Viral Score</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-white">{post.viralScore}</span>
                      <span className="text-xs text-text-muted">/100</span>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${post.viralScore}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          post.viralScore >= 86
                            ? 'linear-gradient(90deg, #8B5CF6, #EC4899)'
                            : post.viralScore >= 61
                              ? 'linear-gradient(90deg, #8B5CF6, #06B6D4)'
                              : post.viralScore >= 31
                                ? 'linear-gradient(90deg, #F59E0B, #8B5CF6)'
                                : 'linear-gradient(90deg, #EF4444, #F59E0B)',
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {post.viralScore >= 80
                      ? 'Excellent viral potential! This content is predicted to perform exceptionally well.'
                      : post.viralScore >= 60
                        ? 'Good viral potential. With optimal timing, this could reach a wide audience.'
                        : 'Moderate viral potential. Consider tweaking the caption or hashtags for better reach.'}
                  </p>
                </motion.div>
              )}

              {/* Platform Preview */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Platform Preview
                </h3>
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: `${platformColor}20`,
                    backgroundColor: `${platformColor}08`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <PlatformIcon platform={post.platform} size={16} />
                    <span className="text-xs font-medium" style={{ color: platformColor }}>
                      {post.platform} Preview
                    </span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {post.caption.slice(0, 120)}{post.caption.length > 120 ? '...' : ''}
                  </p>
                  {post.hashtags.length > 0 && (
                    <p className="mt-2 text-xs text-accent-purple">
                      {post.hashtags.slice(0, 3).join(' ')}
                      {post.hashtags.length > 3 && ` +${post.hashtags.length - 3} more`}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex flex-col gap-2 pt-4 border-t border-white/[0.06]"
              >
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                        bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-medium text-sm
                        hover:shadow-glow-purple transition-shadow"
                    >
                      <Save size={16} />
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="w-full py-2.5 rounded-lg border border-white/[0.08] text-text-secondary
                        hover:bg-bg-surface-hover hover:text-white transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEdit}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                        bg-bg-surface-raised border border-white/[0.08] text-white font-medium text-sm
                        hover:border-accent-purple/30 hover:bg-bg-surface-hover transition-all"
                    >
                      <Pencil size={16} />
                      Edit Post
                    </button>
                    <button
                      onClick={handleRescheduleToTomorrow}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                        bg-bg-surface-raised border border-white/[0.08] text-white font-medium text-sm
                        hover:border-accent-cyan/30 hover:bg-bg-surface-hover transition-all"
                    >
                      <RotateCcw size={16} />
                      Reschedule to Tomorrow
                    </button>

                    {/* Status change buttons */}
                    {post.status !== 'published' && (
                      <div className="flex gap-2">
                        {post.status === 'draft' ? (
                          <button
                            onClick={() => onStatusChange(post.id, 'scheduled')}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg
                              bg-accent-amber/10 border border-accent-amber/20 text-accent-amber text-sm
                              hover:bg-accent-amber/20 transition-colors"
                          >
                            <Sparkles size={14} />
                            Schedule
                          </button>
                        ) : (
                          <button
                            onClick={() => onStatusChange(post.id, 'draft')}
                            className="flex-1 py-2 rounded-lg bg-text-muted/10 border border-text-muted/20
                              text-text-secondary text-sm hover:bg-text-muted/20 transition-colors"
                          >
                            Move to Draft
                          </button>
                        )}
                      </div>
                    )}

                    {/* Delete */}
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                          text-accent-red/70 text-sm hover:text-accent-red hover:bg-accent-red/10 transition-all"
                      >
                        <Trash2 size={16} />
                        Delete Post
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onDelete(post.id);
                            setShowDeleteConfirm(false);
                          }}
                          className="flex-1 py-2 rounded-lg bg-accent-red/20 border border-accent-red/30
                            text-accent-red text-sm font-medium hover:bg-accent-red/30 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-2 rounded-lg bg-bg-surface-raised border border-white/[0.08]
                            text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
