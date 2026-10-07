import { useEffect, useRef, useState } from 'react';
import { Play, Pause, MessageSquarePlus } from 'lucide-react';

interface AudioPlayerProps {
  title: string;
  duration: string;
  onTimestampComment?: (time: string) => void;
  timestampComments?: { id: string; timestamp: string; text: string }[];
  onSeekTo?: (time: string) => void;
  compact?: boolean;
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] || 0);
}

function secondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ title, duration, onTimestampComment, timestampComments = [], onSeekTo, compact }: AudioPlayerProps) {
  const totalSec = timeToSeconds(duration);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setCurrent((prev) => {
        const next = prev + dt;
        if (next >= totalSec) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, totalSec]);

  const pct = totalSec > 0 ? (current / totalSec) * 100 : 0;
  const currentTimeStr = secondsToTime(current);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrent(ratio * totalSec);
  };

  const handleTimestampClick = (e: React.MouseEvent, timestamp: string) => {
    e.stopPropagation();
    const sec = timeToSeconds(timestamp);
    setCurrent(sec);
    setPlaying(true);
    onSeekTo?.(timestamp);
  };

  return (
    <div className={`bg-ink-100 rounded-xl ${compact ? 'p-3' : 'p-4'} border border-ink-200`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying(!playing)}
          className="flex-shrink-0 w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
          aria-label={playing ? '停止' : '再生'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          {!compact && <p className="text-sm font-medium text-ink-800 truncate mb-2">{title}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink-500 tabular-nums w-10 text-right">{currentTimeStr}</span>
            <div className="flex-1 relative cursor-pointer group" onClick={handleSeek}>
              <div className="h-2 bg-ink-200 rounded-full" />
              <div className="absolute top-0 left-0 h-full bg-teal-500 rounded-full transition-[width] duration-100" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 bg-teal-600 rounded-full shadow-md ring-2 ring-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
              {timestampComments.map((tc) => {
                const tcPct = totalSec > 0 ? (timeToSeconds(tc.timestamp) / totalSec) * 100 : 0;
                return (
                  <div
                    key={tc.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-gold-400 rounded-full ring-2 ring-white cursor-pointer hover:scale-125 transition-transform z-10"
                    style={{ left: `${tcPct}%` }}
                    title={`${tc.timestamp} - ${tc.text}`}
                    onClick={(e) => handleTimestampClick(e, tc.timestamp)}
                  />
                );
              })}
            </div>
            <span className="text-xs font-mono text-ink-500 tabular-nums w-10">{duration}</span>
          </div>
        </div>
      </div>
      {onTimestampComment && (
        <button
          onClick={() => onTimestampComment(currentTimeStr)}
          className="mt-3 flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 font-medium transition-colors"
        >
          <MessageSquarePlus size={14} />
          {currentTimeStr} にコメント
        </button>
      )}
    </div>
  );
}
