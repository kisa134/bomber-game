import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Play, Check, AlertTriangle, Sparkles, RefreshCw,
  Download, Trash2, Edit3, AtSign, Clock, TrendingUp,
  Diamond, Target, Volume2, Hash, Copy, Plus,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import GradientButton from '@/components/GradientButton';
import PlatformIcon from '@/components/PlatformIcon';
import type { Platform } from '@/components/PlatformIcon';
import ViralScore from '@/components/ViralScore';
import { analyzeVideo, revokeVideoUrl, generateSyntheticAnalysis } from '@/lib/videoAnalyzer';
import type {
  DetectedMoment as AnalyzerDetectedMoment,
  VideoAnalysisResult,
  GeneratedClip,
} from '@/lib/videoAnalyzer';

// ─── Easing ────────────────────────────────────────────────────────
const easeOut = [0, 0, 0.2, 1] as [number, number, number, number];
const easeSpring = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

// ─── Format Time ───────────────────────────────────────────────────
const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ─── Moment Type Config ────────────────────────────────────────────
const momentConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  kill:   { color: '#EC4899', bgColor: 'bg-accent-pink/15',    label: 'Kill' },
  clutch: { color: '#8B5CF6', bgColor: 'bg-accent-purple/15',  label: 'Clutch' },
  escape: { color: '#06B6D4', bgColor: 'bg-accent-cyan/15',    label: 'Escape' },
  win:    { color: '#10B981', bgColor: 'bg-accent-green/15',   label: 'Win' },
};

// ═══════════════════════════════════════════════════════════════════
//  SECTION 1 — Upload Zone
// ═══════════════════════════════════════════════════════════════════
interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  onDemo?: () => void;
}

function UploadZone({ onFileSelected, onDemo }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompletedRef = useRef(false);

  const clearUploadInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Real file reading progress via FileReader
  const readFileWithProgress = useCallback((file: File) => {
    hasCompletedRef.current = false;
    setFileName(file.name);
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
    setUploadState('uploading');
    setProgress(0);

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = (e.loaded / e.total) * 100;
        setProgress(pct);
      }
    };

    reader.onload = () => {
      setProgress(100);
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        setTimeout(() => {
          setUploadState('complete');
          setTimeout(() => onFileSelected(file), 600);
        }, 200);
      }
    };

    reader.onerror = () => {
      setUploadState('error');
    };

    // Read as array buffer to track progress
    reader.readAsArrayBuffer(file);
  }, [onFileSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) readFileWithProgress(files[0]);
  }, [readFileWithProgress]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/quicktime,video/x-matroska';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) readFileWithProgress(file);
    };
    input.click();
  }, [readFileWithProgress]);

  const cancelUpload = useCallback(() => {
    clearUploadInterval();
    hasCompletedRef.current = false;
    setUploadState('idle');
    setProgress(0);
    setFileName('');
    setFileSize('');
  }, [clearUploadInterval]);

  useEffect(() => () => { clearUploadInterval(); }, [clearUploadInterval]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: easeSpring }}
    >
      <GlassCard noPadding className="h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated gradient background */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.03) 0%, transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.03) 0%, transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.03) 0%, transparent 70%)',
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer relative z-10"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={uploadState === 'idle' || uploadState === 'error' ? handleClick : undefined}
          animate={{
            border: isDragOver
              ? '2px solid #8B5CF6'
              : uploadState === 'error'
                ? '2px dashed #EF4444'
                : '2px dashed rgba(139,92,246,0.4)',
            background: isDragOver
              ? 'rgba(139,92,246,0.06)'
              : 'transparent',
          }}
          style={{
            borderRadius: '16px',
            margin: '24px',
            width: 'calc(100% - 48px)',
            height: 'calc(100% - 48px)',
            boxShadow: isDragOver ? '0 0 30px rgba(139,92,246,0.15)' : 'none',
          }}
          whileHover={uploadState === 'idle' ? { scale: 1.01 } : {}}
          transition={{ duration: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {uploadState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Upload className="w-16 h-16 text-accent-purple" />
                </motion.div>
                <h2 className="font-inter text-2xl font-semibold text-white tracking-tight">
                  Drop your gameplay video here
                </h2>
                <p className="text-accent-cyan text-sm">or click to browse</p>
                <p className="text-text-muted text-[13px]">MP4, MOV, MKV — up to 500MB</p>
                <div className="flex gap-2 mt-2">
                  {['MP4', 'MOV', 'MKV'].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono text-text-muted border border-white/[0.06]"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
                {onDemo && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => { e.stopPropagation(); onDemo(); }}
                    className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-purple/20 to-accent-cyan/20 border border-accent-purple/30 text-accent-purple text-[13px] font-medium hover:border-accent-purple/60 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Try Demo Video — Instant AI Analysis
                  </motion.button>
                )}
              </motion.div>
            )}

            {uploadState === 'uploading' && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 w-full max-w-md px-8"
              >
                {/* AI Processing Indicator */}
                <div className="flex items-center gap-2 mb-2">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-accent-green"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-accent-green text-[13px] font-mono">Reading file...</span>
                </div>

                <p className="text-white text-sm font-medium">{fileName}</p>
                <p className="text-text-muted text-[11px] font-mono">{fileSize}</p>

                {/* Progress bar */}
                <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)',
                      width: `${Math.min(progress, 100)}%`,
                    }}
                  />
                </div>
                <p className="font-mono text-2xl font-bold text-white">{Math.min(Math.round(progress), 100)}%</p>

                <button
                  onClick={(e) => { e.stopPropagation(); cancelUpload(); }}
                  className="flex items-center gap-1.5 text-text-muted text-[13px] hover:text-white transition-colors mt-2"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </motion.div>
            )}

            {uploadState === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: [0, 1.2, 1] }}
                transition={{ duration: 0.4, ease: easeSpring }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-accent-green/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-accent-green" />
                </div>
                <p className="text-white font-medium">Upload complete!</p>
              </motion.div>
            )}

            {uploadState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <AlertTriangle className="w-12 h-12 text-accent-red" />
                <p className="text-accent-red text-sm">Upload failed. Please try again.</p>
                <GradientButton size="sm" onClick={handleClick}>Retry</GradientButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </GlassCard>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 1b — AI Analyzing State
// ═══════════════════════════════════════════════════════════════════
function AIAnalyzingState() {
  const steps = [
    'Loading video metadata...',
    'Extracting frames at key timestamps...',
    'Analyzing pixel data & brightness...',
    'Detecting motion & scene changes...',
    'Generating AI captions...',
    'Computing viral score...',
  ];
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: easeSpring }}
    >
      <GlassCard noPadding className="h-[500px] flex flex-col items-center justify-center relative overflow-hidden">
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(6,182,212,0.06) 0%, transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(236,72,153,0.06) 0%, transparent 70%)',
              'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="flex flex-col items-center gap-6 relative z-10">
          {/* Animated brain icon */}
          <motion.div
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/30 to-accent-cyan/30 flex items-center justify-center border border-accent-purple/30">
              <Sparkles className="w-10 h-10 text-accent-purple" />
            </div>
          </motion.div>

          <div className="text-center">
            <h2 className="font-inter text-2xl font-semibold text-white tracking-tight mb-2">
              AI Analyzing Video...
            </h2>
            <p className="text-text-muted text-[13px]">
              Processing frames and detecting highlight moments
            </p>
          </div>

          {/* Progress steps */}
          <div className="w-full max-w-xs space-y-2 mt-4">
            {steps.map((step, i) => (
              <motion.div
                key={step}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{
                  opacity: i <= currentStep ? 1 : 0.3,
                  x: 0,
                }}
                transition={{ delay: i * 0.05 }}
              >
                <motion.div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    i < currentStep
                      ? 'bg-accent-green'
                      : i === currentStep
                        ? 'bg-accent-purple'
                        : 'bg-white/10'
                  }`}
                  animate={i === currentStep ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span
                  className={`text-[12px] ${
                    i <= currentStep ? 'text-text-secondary' : 'text-text-muted'
                  }`}
                >
                  {step}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Spinner bar */}
          <div className="w-48 h-1 bg-white/[0.06] rounded-full overflow-hidden mt-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 2 — Video Player (REAL video)
// ═══════════════════════════════════════════════════════════════════
interface RealVideoPlayerProps {
  videoUrl: string;
  duration: number;
  durationFormatted: string;
  fileName: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

function RealVideoPlayer({
  videoUrl,
  duration,
  durationFormatted,
  fileName,
  isPlaying,
  onTogglePlay,
  currentTime,
  onSeek,
}: RealVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Sync play/pause state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying]);

  // Sync external seek
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - currentTime) > 0.5) {
      v.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    // Update parent via onSeek
    if (Math.abs(v.currentTime - currentTime) > 0.3) {
      onSeek(v.currentTime);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    onSeek(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <GlassCard noPadding className="overflow-hidden">
      <div className="aspect-video relative bg-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => onTogglePlay()}
            playsInline
            muted
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(10,10,15,1) 50%, rgba(6,182,212,0.15) 100%)',
            }}
          >
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(139,92,246,0.15) 60px, rgba(139,92,246,0.15) 61px),
                               repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(6,182,212,0.15) 60px, rgba(6,182,212,0.15) 61px)`,
            }} />
            <div className="text-center relative z-10">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles className="w-16 h-16 text-accent-purple/50 mx-auto mb-3" />
              </motion.div>
              <p className="text-white/60 font-inter font-medium">Demo Mode</p>
              <p className="text-text-muted text-[13px] font-mono mt-1">Upload a real video to see actual analysis</p>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onTogglePlay}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"
            >
              {isPlaying
                ? <div className="flex gap-0.5"><div className="w-1 h-3 bg-black rounded-sm" /><div className="w-1 h-3 bg-black rounded-sm" /></div>
                : <Play className="w-4 h-4 text-black ml-0.5" />
              }
            </motion.button>

            {/* Timeline */}
            <div
              ref={progressRef}
              className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent-purple to-accent-cyan"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Time */}
            <span className="text-white text-[11px] font-mono flex-shrink-0">
              {formatTime(currentTime)} / {durationFormatted}
            </span>

            {/* Volume */}
            <Volume2 className="w-4 h-4 text-white/60 flex-shrink-0" />
          </div>

          {/* File name */}
          <p className="text-text-muted text-[11px] font-mono mt-2 truncate">{fileName}</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 3 — AI Timeline
// ═══════════════════════════════════════════════════════════════════
interface AITimelineProps {
  moments: AnalyzerDetectedMoment[];
  currentTime: number;
  totalDuration: number;
  onSeek: (seconds: number) => void;
  selectedMomentId: number | null;
  onSelectMoment: (id: number) => void;
}

function AITimeline({ moments, currentTime, totalDuration, onSeek, selectedMomentId, onSelectMoment }: AITimelineProps) {
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    onSeek(pct * totalDuration);
  };

  return (
    <GlassCard className="mt-4">
      {/* Timeline Track */}
      <div className="relative w-full h-10 flex items-center">
        {/* Track background */}
        <div
          className="absolute w-full h-1.5 rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onClick={handleTrackClick}
        >
          {/* Filled portion */}
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)',
              width: `${progress}%`,
            }}
          />
        </div>

        {/* Moment markers */}
        {moments.map((moment, index) => {
          const left = totalDuration > 0 ? (moment.timestampSeconds / totalDuration) * 100 : 0;
          const cfg = momentConfig[moment.type] || momentConfig.kill;
          const isSelected = selectedMomentId === moment.id;

          return (
            <motion.div
              key={moment.id}
              className="absolute cursor-pointer group"
              style={{ left: `${left}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3, ease: easeSpring }}
              onClick={(e) => { e.stopPropagation(); onSeek(moment.timestampSeconds); onSelectMoment(moment.id); }}
            >
              {/* Diamond marker */}
              <motion.div
                className="relative"
                whileHover={{ scale: 1.3 }}
                animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                <Diamond
                  className="w-3.5 h-3.5 drop-shadow-lg"
                  fill={cfg.color}
                  color={cfg.color}
                  style={{
                    filter: isSelected ? `0 0 8px ${cfg.color}` : 'none',
                  }}
                />
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ boxShadow: `0 0 8px ${cfg.color}` }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                <div className="rounded-lg border border-white/[0.08] p-2.5 backdrop-blur-xl whitespace-nowrap" style={{ background: 'rgba(18,18,26,0.95)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Diamond className="w-3 h-3" fill={cfg.color} color={cfg.color} />
                    <span className="text-white text-[11px] font-semibold">{cfg.label}</span>
                  </div>
                  <p className="text-text-muted text-[11px] font-mono">{moment.timestamp}</p>
                  <p className="text-accent-green text-[11px] font-mono">{moment.confidence}% confidence</p>
                  <p className="text-text-secondary text-[11px] mt-0.5 max-w-[160px] truncate">{moment.description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Scrubber handle */}
        <motion.div
          className="absolute w-4 h-4 rounded-full bg-accent-cyan border-2 border-white pointer-events-none"
          style={{
            left: `${progress}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 12px rgba(6,182,212,0.5)',
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {(Object.entries(momentConfig) as [string, { color: string; bgColor: string; label: string }][]).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5">
            <Diamond className="w-3 h-3" fill={cfg.color} color={cfg.color} />
            <span className="text-text-muted text-[11px]">{cfg.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 4 — Detected Moments Panel
// ═══════════════════════════════════════════════════════════════════
interface DetectedMomentsPanelProps {
  moments: AnalyzerDetectedMoment[];
  selectedMomentId: number | null;
  onSelectMoment: (id: number) => void;
}

function DetectedMomentsPanel({ moments, selectedMomentId, onSelectMoment }: DetectedMomentsPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Initialize with first moment selected
  useEffect(() => {
    if (moments.length > 0 && selected.size === 0) {
      setSelected(new Set([moments[0].id]));
    }
  }, [moments]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onSelectMoment(id);
  };

  const selectAll = () => {
    if (selected.size === moments.length) setSelected(new Set());
    else setSelected(new Set(moments.map((m) => m.id)));
  };

  return (
    <div className="mt-6">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-inter text-xl font-semibold text-white tracking-tight">AI Detected Moments</h2>
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full bg-accent-green"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-accent-green text-[11px] font-mono">AI Active</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-[13px] font-mono">{moments.length} moments found</span>
          <button
            onClick={selectAll}
            className="text-text-secondary text-[13px] hover:text-white transition-colors"
          >
            {selected.size === moments.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Horizontal Scroll Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {moments.map((moment, index) => {
          const cfg = momentConfig[moment.type] || momentConfig.kill;
          const isSel = selected.has(moment.id);
          const isActive = selectedMomentId === moment.id;

          return (
            <motion.div
              key={moment.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.4, ease: easeOut }}
              onClick={() => toggleSelect(moment.id)}
              className={`
                relative flex-shrink-0 w-[240px] rounded-2xl border cursor-pointer overflow-hidden
                transition-all duration-300 backdrop-blur-2xl
                ${isActive ? 'border-opacity-40' : 'border-white/[0.06] hover:border-white/[0.12]'}
              `}
              style={{
                background: 'rgba(26, 26, 38, 0.4)',
                borderColor: isActive ? cfg.color : undefined,
              }}
              whileHover={{ y: -2 }}
            >
              {/* Checkbox */}
              <motion.div
                className={`
                  absolute top-2 right-2 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center
                  ${isSel ? 'bg-accent-purple border-accent-purple' : 'border-white/20 bg-black/30'}
                `}
                animate={isSel ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                {isSel && <Check className="w-3 h-3 text-white" />}
              </motion.div>

              {/* Thumbnail area with colored strip */}
              <div className="relative h-[100px] overflow-hidden">
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${cfg.color}15 0%, ${cfg.color}08 100%)`,
                  }}
                >
                  <Play className="w-8 h-8 text-white/40" />
                </div>
                <motion.div
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </motion.div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${cfg.bgColor}`} style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-text-muted text-[11px] font-mono">{moment.timestamp}</span>
                </div>
                <p className="text-text-secondary text-[12px] truncate mb-1.5">{moment.description}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: cfg.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${moment.confidence}%` }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-mono"
                    style={{
                      color: moment.confidence > 80 ? '#10B981' : moment.confidence > 50 ? '#F59E0B' : '#EF4444',
                    }}
                  >
                    {moment.confidence}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 5 — Platform Format Preview
// ═══════════════════════════════════════════════════════════════════
interface PlatformPreviewProps {
  selectedMoment: AnalyzerDetectedMoment | null;
  result: VideoAnalysisResult;
}

const captionStyles = ['Gaming', 'Cyberpunk', 'Minimal', 'Meme'] as const;
type CaptionStyle = typeof captionStyles[number];

function PlatformPreview({ selectedMoment, result }: PlatformPreviewProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(['TikTok']));
  const [activePreview, setActivePreview] = useState<string>('TikTok');
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('Gaming');
  const [autoExtend, setAutoExtend] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const platformFormats = result.platformFormats;

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        if (next.size > 1) next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
    setActivePreview(platform);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 800);
  };

  const activeFormat = platformFormats.find((f) => f.platform === activePreview);

  const aspectRatioClass = {
    '9:16': 'aspect-[9/16] max-w-[280px]',
    '1:1': 'aspect-square max-w-[360px]',
    '16:9': 'aspect-video max-w-[480px]',
    '2:3': 'aspect-[2/3] max-w-[260px]',
  }[activeFormat?.aspectRatio || '9:16'];

  const captionText = result.captions[activePreview] || '';

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Left — Format Selector */}
      <GlassCard title="Export Format" subtitle="Select platforms for export">
        <div className="flex flex-col gap-1">
          {platformFormats.map((fmt) => {
            const isSelected = selectedPlatforms.has(fmt.platform);
            const isActive = activePreview === fmt.platform;
            return (
              <motion.button
                key={fmt.platform}
                onClick={() => togglePlatform(fmt.platform)}
                className={`
                  relative flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200
                  ${isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}
                `}
                whileTap={{ scale: 0.98 }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="platformIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full"
                    style={{ background: fmt.color }}
                    transition={{ duration: 0.2 }}
                  />
                )}

                <div className={isSelected ? '' : 'opacity-40'}>
                  <PlatformIcon platform={fmt.platform as Platform} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
                      {fmt.platform}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${fmt.color}15`, color: fmt.color }}>
                      {fmt.aspectRatio}
                    </span>
                  </div>
                  <p className="text-text-muted text-[11px]">{fmt.resolution} · Limit: {fmt.durationLimit}</p>
                </div>
                <div
                  className={`
                    w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected ? 'border-transparent' : 'border-white/20'}
                  `}
                  style={isSelected ? { background: fmt.color } : {}}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Clip Settings */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <h4 className="text-white text-[13px] font-medium mb-3">Clip Settings</h4>

          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="text-text-muted text-[11px] block mb-1">Start</label>
              <div className="px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white text-[12px] font-mono">
                {selectedMoment?.timestamp || '00:00'}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-text-muted text-[11px] block mb-1">End</label>
              <div className="px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-white text-[12px] font-mono">
                {selectedMoment ? formatTime(selectedMoment.timestampSeconds + 15) : '00:15'}
              </div>
            </div>
          </div>

          {/* Auto-extend toggle */}
          <button
            onClick={() => setAutoExtend(!autoExtend)}
            className="flex items-center gap-2 w-full mb-3"
          >
            <div
              className={`w-8 rounded-full relative transition-colors ${autoExtend ? 'bg-accent-purple' : 'bg-white/10'}`}
              style={{ height: '20px' }}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                animate={{ left: autoExtend ? '14px' : '2px' }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <span className="text-text-secondary text-[12px]">Auto-extend 3s buffer</span>
          </button>

          {/* Caption style */}
          <label className="text-text-muted text-[11px] block mb-1.5">Caption Style</label>
          <div className="flex flex-wrap gap-1.5">
            {captionStyles.map((style) => (
              <button
                key={style}
                onClick={() => setCaptionStyle(style)}
                className={`
                  px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
                  ${captionStyle === style
                    ? 'bg-accent-purple text-white'
                    : 'bg-white/[0.05] text-text-secondary hover:text-white hover:bg-white/[0.08]'
                  }
                `}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Right — Preview Canvas + Caption */}
      <div className="flex flex-col gap-6">
        {/* Preview Area */}
        <GlassCard className="flex-1">
          <div className="flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePreview + captionStyle}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`${aspectRatioClass} w-full relative rounded-xl overflow-hidden flex flex-col`}
                style={{ background: '#0A0A0F' }}
              >
                {/* Video frame placeholder */}
                <div className="flex-1 relative overflow-hidden">
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.1) 50%, rgba(236,72,153,0.1) 100%)`,
                    }}
                  >
                    {/* Gameplay simulation pattern */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(139,92,246,0.1) 40px, rgba(139,92,246,0.1) 41px),
                                       repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(6,182,212,0.1) 40px, rgba(6,182,212,0.1) 41px)`,
                    }} />
                    <div className="text-center relative z-10">
                      <Target className="w-12 h-12 text-accent-purple/40 mx-auto mb-2" />
                      <p className="text-text-muted text-[12px] font-mono">{result.resolution.width}×{result.resolution.height}</p>
                      <p className="text-white/60 text-[11px] mt-1">
                        {selectedMoment?.description || 'Select a moment'}
                      </p>
                    </div>
                  </div>

                  {/* Viral Score badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <ViralScore score={result.viralScore} size={28} />
                    <span className="text-white text-[11px] font-mono font-semibold">{result.viralScore}</span>
                  </div>

                  {/* Platform watermark */}
                  <div className="absolute bottom-2 right-2 opacity-20">
                    <PlatformIcon platform={activePreview as Platform} size={16} />
                  </div>
                </div>

                {/* Caption Overlay */}
                <motion.div
                  className="relative z-10 border-l-4 px-3 py-2"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    borderLeftColor: captionStyle === 'Gaming' ? '#10B981' : captionStyle === 'Cyberpunk' ? '#06B6D4' : captionStyle === 'Meme' ? '#EC4899' : '#FFFFFF',
                  }}
                  animate={regenerating ? { opacity: [1, 0, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <p className={`
                    text-white text-[13px] font-semibold
                    ${captionStyle === 'Gaming' ? 'uppercase tracking-wide' : ''}
                    ${captionStyle === 'Meme' ? 'font-bold' : ''}
                  `}
                    style={captionStyle === 'Cyberpunk' ? { textShadow: '1px 0 0 rgba(6,182,212,0.5), -1px 0 0 rgba(236,72,153,0.3)' } : {}}
                  >
                    {captionText}
                  </p>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </GlassCard>

        {/* AI Caption Generator */}
        <GlassCard
          title={
            <span className="flex items-center gap-2">
              AI-Generated Captions
              <Sparkles className="w-4 h-4 text-accent-purple" />
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            {/* Platform caption tabs */}
            <div className="flex gap-1.5 flex-wrap">
              {Object.keys(result.captions).map((platform) => (
                <button
                  key={platform}
                  className={`
                    px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all
                    ${activePreview === platform
                      ? 'bg-accent-purple text-white'
                      : 'bg-white/[0.05] text-text-secondary hover:text-white'
                    }
                  `}
                  onClick={() => setActivePreview(platform)}
                >
                  {platform}
                </button>
              ))}
            </div>

            {/* Caption text */}
            <motion.div
              className="relative"
              animate={regenerating ? { filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'] } : {}}
              transition={{ duration: 0.4 }}
            >
              <textarea
                value={captionText}
                readOnly
                className="w-full h-20 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-text-secondary text-[13px] resize-none focus:outline-none focus:border-accent-purple/30 transition-colors"
              />
              <span className="absolute bottom-2 right-2 text-[11px] font-mono text-text-muted">
                {captionText.length}/{activePreview === 'X' ? 280 : activePreview === 'YouTube' ? 5000 : 2200}
              </span>
            </motion.div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-text-secondary text-[12px] hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(captionText)}
                className="flex items-center gap-1.5 text-accent-cyan text-[12px] hover:text-accent-cyan/80 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 6 — Viral Score Predictor
// ═══════════════════════════════════════════════════════════════════
interface ViralScorePredictorProps {
  result: VideoAnalysisResult;
}

function ViralScorePredictor({ result }: ViralScorePredictorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const getScoreLabel = (score: number) => {
    if (score <= 30) return { text: 'Low virality potential', color: 'text-accent-red' };
    if (score <= 60) return { text: 'Moderate — could trend', color: 'text-accent-amber' };
    if (score <= 85) return { text: 'High — strong viral potential', color: 'text-accent-purple' };
    return { text: 'Viral — exceptional potential', color: 'text-transparent bg-clip-text bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-pink' };
  };

  const scoreInfo = getScoreLabel(result.viralScore);

  return (
    <div ref={ref}>
      <GlassCard>
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Score Ring (Left) */}
          <div className="flex flex-col items-center">
            <ViralScore score={isVisible ? result.viralScore : 0} size={96} />
            <p className="text-text-muted text-[11px] font-semibold tracking-[0.08em] uppercase mt-3">VIRAL SCORE</p>
            <p className={`text-[13px] font-medium mt-1 ${scoreInfo.color}`}>{scoreInfo.text}</p>
          </div>

          {/* Factor Breakdown (Right) */}
          <div className="flex-1 w-full">
            <div className="flex flex-col gap-3">
              {result.viralFactors.map((factor, index) => (
                <div key={factor.name} className="flex items-center gap-3 group">
                  <span className="text-text-secondary text-[13px] font-medium w-[120px] text-right flex-shrink-0">
                    {factor.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #8B5CF6, #06B6D4, #EC4899)' }}
                      initial={{ width: 0 }}
                      animate={{ width: isVisible ? `${factor.score}%` : 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1, ease: easeOut }}
                    />
                  </div>
                  <span className="text-text-muted text-[11px] font-mono w-8 text-right">{factor.score}</span>
                </div>
              ))}
            </div>

            <p className="text-text-secondary text-[13px] mt-4 leading-relaxed">
              {result.viralScoreExplanation}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 7 — Smart Hashtags
// ═══════════════════════════════════════════════════════════════════
interface SmartHashtagsProps {
  result: VideoAnalysisResult;
}

function SmartHashtags({ result }: SmartHashtagsProps) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set(['#Bombermeme', '#Skill2Earn']));

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // Initialize active tags with first tag from each category
  useEffect(() => {
    const initial = new Set<string>();
    result.hashtags.forEach((cat) => {
      if (cat.tags[0]) initial.add(cat.tags[0]);
    });
    if (initial.size > 0) setActiveTags(initial);
  }, [result.hashtags]);

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-accent-purple" />
          Smart Hashtag Suggestions
        </span>
      }
      subtitle="AI-curated hashtags for maximum reach"
    >
      <div className="flex flex-col gap-4">
        {result.hashtags.map((category) => (
          <div key={category.category}>
            <h4 className="text-text-muted text-[11px] font-semibold tracking-[0.08em] uppercase mb-2">
              {category.category}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {category.tags.map((tag) => {
                const isActive = activeTags.has(tag);
                return (
                  <motion.button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`
                      px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all duration-200
                      ${isActive
                        ? 'bg-accent-purple text-white'
                        : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-white'
                      }
                    `}
                    whileTap={{ scale: 0.95 }}
                    layout
                  >
                    {tag}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Selected count */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-text-muted text-[11px]">
            {activeTags.size} tags selected
          </span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(Array.from(activeTags).join(' '));
            }}
            className="flex items-center gap-1 text-accent-cyan text-[11px] hover:text-accent-cyan/80 transition-colors"
          >
            <Copy className="w-3 h-3" /> Copy All
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 8 — Mentions & Engagement Tips
// ═══════════════════════════════════════════════════════════════════
interface MentionsEngagementProps {
  result: VideoAnalysisResult;
}

function MentionsEngagement({ result }: MentionsEngagementProps) {
  const tips = [
    ...result.mentions.map((m) => ({
      type: 'mention' as const,
      label: 'Tag',
      value: m.handle,
      detail: m.reason,
    })),
    {
      type: 'time' as const,
      label: 'Best Time',
      value: result.engagement.bestTime,
      detail: 'Peak engagement window',
    },
    {
      type: 'prediction' as const,
      label: 'Est. Reach',
      value: result.engagement.estimatedReach,
      detail: 'Based on similar clips',
    },
  ];

  return (
    <GlassCard
      title={
        <span className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-cyan" />
          Mentions & Engagement
        </span>
      }
      subtitle="Optimize your post for maximum reach"
    >
      <div className="flex flex-col gap-3">
        {tips.map((tip, index) => (
          <motion.div
            key={`${tip.label}-${tip.value}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
          >
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
              ${tip.type === 'mention' ? 'bg-accent-purple/15' : tip.type === 'time' ? 'bg-accent-amber/15' : 'bg-accent-green/15'}
            `}>
              {tip.type === 'mention' && <AtSign className="w-4 h-4 text-accent-purple" />}
              {tip.type === 'time' && <Clock className="w-4 h-4 text-accent-amber" />}
              {tip.type === 'prediction' && <TrendingUp className="w-4 h-4 text-accent-green" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-[11px]">{tip.label}</span>
                <span className="text-white text-[13px] font-semibold">{tip.value}</span>
              </div>
              {tip.detail && (
                <p className="text-text-muted text-[11px] mt-0.5">{tip.detail}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SECTION 9 — Clips Gallery
// ═══════════════════════════════════════════════════════════════════
interface ClipsGalleryProps {
  clips: GeneratedClip[];
}

function ClipsGallery({ clips }: ClipsGalleryProps) {
  const [filter, setFilter] = useState<string>('All');

  const filters = ['All', 'TikTok', 'Instagram', 'YouTube', 'X', 'Telegram'];
  const filtered = filter === 'All' ? clips : clips.filter((c) => c.platform === filter);

  return (
    <div className="mt-6">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="font-inter text-xl font-semibold text-white tracking-tight">Generated Clips</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-3 py-1 rounded-lg text-[12px] font-medium transition-all duration-200
                ${filter === f
                  ? 'bg-accent-purple text-white'
                  : 'bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] hover:text-white'
                }
              `}
            >
              {f}
            </button>
          ))}
          <GradientButton size="sm" icon={<Download className="w-3.5 h-3.5" />} className="ml-2">
            Download All
          </GradientButton>
        </div>
      </div>

      {/* Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {filtered.map((clip, index) => {
            const platformColor = {
              TikTok: '#EC4899', Instagram: '#E4405F', YouTube: '#FF0000', X: '#9CA3AF', Telegram: '#26A5E4',
            }[clip.platform];

            const aspectClass = {
              '9:16': 'aspect-[9/16]', '1:1': 'aspect-square', '16:9': 'aspect-video', '2:3': 'aspect-[2/3]',
            }[clip.aspectRatio] || 'aspect-video';

            return (
              <motion.div
                key={clip.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.06, duration: 0.4, ease: easeOut }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="rounded-2xl border border-white/[0.06] backdrop-blur-2xl overflow-hidden transition-all duration-300 hover:border-accent-purple/20 hover:shadow-glow-purple"
                style={{ background: 'rgba(26, 26, 38, 0.4)' }}
              >
                {/* Thumbnail */}
                <div className={`relative ${aspectClass} overflow-hidden group`}>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${platformColor}15 0%, ${platformColor}08 100%)`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-10 h-10 text-white/30" />
                    </div>
                  </div>

                  {/* Hover play */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[11px] font-mono text-white bg-black/60">
                    {clip.duration}
                  </div>

                  {/* Platform icon */}
                  <div className="absolute top-2 left-2">
                    <PlatformIcon platform={clip.platform as Platform} size={16} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-white text-[13px] font-semibold leading-tight truncate flex-1">
                      {clip.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <ViralScore score={clip.viralScore} size={28} />
                    <span className="text-text-muted text-[11px] font-mono">{clip.viralScore}/100</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full capitalize" style={{
                      background: `${platformColor}15`, color: platformColor,
                    }}>
                      {clip.platform}
                    </span>
                  </div>

                  <p className="text-text-muted text-[11px] truncate mb-3">{clip.caption}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-2 border-t border-white/[0.06]">
                    {[
                      { icon: Play, label: 'Play' },
                      { icon: Edit3, label: 'Edit' },
                      { icon: Download, label: 'Download' },
                      { icon: Trash2, label: 'Delete' },
                    ].map(({ icon: Icon, label }) => (
                      <button
                        key={label}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white hover:bg-white/[0.08] transition-all"
                        title={label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN: Video Hub Page
// ═══════════════════════════════════════════════════════════════════
export default function VideoHub() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedMomentId, setSelectedMomentId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Handle file selection
  const handleFileSelected = useCallback(async (file: File) => {
    setVideoLoaded(true);
    setIsAnalyzing(true);
    setCurrentTime(0);

    try {
      const result = await analyzeVideo(file);
      // Create object URL for the video player
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setAnalysisResult(result);
      if (result.detectedMoments.length > 0) {
        setSelectedMomentId(result.detectedMoments[0].id);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleDemo = useCallback(() => {
    // Use synthetic analysis for instant demo without real video
    setVideoLoaded(true);
    setIsAnalyzing(true);
    setCurrentTime(0);

    // Simulate brief analysis delay for UX
    setTimeout(() => {
      const result = generateSyntheticAnalysis();
      setVideoUrl(''); // No real video for demo
      setAnalysisResult(result);
      if (result.detectedMoments.length > 0) {
        setSelectedMomentId(result.detectedMoments[0].id);
      }
      setIsAnalyzing(false);
    }, 1800);
  }, []);

  const handleReset = useCallback(() => {
    if (videoUrl) {
      revokeVideoUrl(videoUrl);
    }
    setVideoLoaded(false);
    setIsAnalyzing(false);
    setCurrentTime(0);
    setSelectedMomentId(null);
    setIsPlaying(false);
    setAnalysisResult(null);
    setVideoUrl('');
  }, [videoUrl]);

  const handleSeek = useCallback((seconds: number) => {
    setCurrentTime(seconds);
  }, []);

  const handleSelectMoment = useCallback((id: number) => {
    setSelectedMomentId(id);
    if (analysisResult) {
      const moment = analysisResult.detectedMoments.find((m) => m.id === id);
      if (moment) setCurrentTime(moment.timestampSeconds);
    }
  }, [analysisResult]);

  const selectedMoment = analysisResult?.detectedMoments.find((m) => m.id === selectedMomentId) || null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) revokeVideoUrl(videoUrl);
    };
  }, [videoUrl]);

  return (
    <div className="space-y-6 pb-8">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[200px] -left-[200px] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -bottom-[200px] -right-[200px] w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Section 1: Upload Area (Empty State) */}
        {!videoLoaded && <UploadZone onFileSelected={handleFileSelected} onDemo={handleDemo} />}

        {/* Section 1b: AI Analyzing State */}
        <AnimatePresence>
          {videoLoaded && isAnalyzing && <AIAnalyzingState />}
        </AnimatePresence>

        {/* Section 2: Video Workspace */}
        <AnimatePresence>
          {videoLoaded && !isAnalyzing && analysisResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Real Video Player */}
              <RealVideoPlayer
                videoUrl={videoUrl}
                duration={analysisResult.duration}
                durationFormatted={analysisResult.durationFormatted}
                fileName={analysisResult.fileName}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                currentTime={currentTime}
                onSeek={handleSeek}
              />

              {/* Workspace Header */}
              <div className="flex items-center justify-between mt-6">
                <div>
                  <h2 className="font-orbitron text-lg text-white tracking-wide">AI Analysis Results</h2>
                  <p className="text-text-muted text-[13px] mt-0.5">{analysisResult.detectedMoments.length} highlight moments detected · {analysisResult.resolution.width}×{analysisResult.resolution.height} · {analysisResult.durationFormatted}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 border border-white/[0.08] text-text-secondary text-[13px] hover:text-white hover:border-accent-purple/40 transition-all"
                >
                  <Plus className="w-4 h-4" /> Upload New Video
                </motion.button>
              </div>

              {/* AI Timeline */}
              <AITimeline
                moments={analysisResult.detectedMoments}
                currentTime={currentTime}
                totalDuration={analysisResult.duration}
                onSeek={handleSeek}
                selectedMomentId={selectedMomentId}
                onSelectMoment={handleSelectMoment}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section 3: Detected Moments */}
        {videoLoaded && !isAnalyzing && analysisResult && (
          <DetectedMomentsPanel
            moments={analysisResult.detectedMoments}
            selectedMomentId={selectedMomentId}
            onSelectMoment={handleSelectMoment}
          />
        )}

        {/* Section 4: Platform Preview + Captions */}
        {videoLoaded && !isAnalyzing && analysisResult && (
          <PlatformPreview selectedMoment={selectedMoment} result={analysisResult} />
        )}

        {/* Section 5: Viral Score */}
        {videoLoaded && !isAnalyzing && analysisResult && <ViralScorePredictor result={analysisResult} />}

        {/* Section 6: Hashtags + Engagement (side by side) */}
        {videoLoaded && !isAnalyzing && analysisResult && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SmartHashtags result={analysisResult} />
            <MentionsEngagement result={analysisResult} />
          </div>
        )}

        {/* Section 7: Clips Gallery */}
        {videoLoaded && !isAnalyzing && analysisResult && <ClipsGallery clips={analysisResult.clips} />}
      </div>
    </div>
  );
}
