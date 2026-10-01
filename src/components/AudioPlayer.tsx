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
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
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
        return next >= totalSec ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, totalSec]);

  const pct = (current / totalSec) * 100;
  const currentTimeStr = secondsToTime(current);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setCurrent(ratio * totalSec);
  };

  return (
    <div className={`bg-ink-100 rounded-xl ${compact ? 'p-3' : 'p-4'} border border-ink-200`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying(!playing)}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 transition-colors shadow-sm"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          {!compact && <p className="text-sm font-medium text-ink-800 truncate mb-1.5">{title}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink-500 tabular-nums w-9 text-right">{currentTimeStr}</span>
            <div className="flex-1 relative cursor-pointer group" onClick={handleSeek}>
              <div className="h-1.5 bg-ink-200 rounded-full" />
              <div className="absolute top-0 left-0 h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 bg-teal-600 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
              {timestampComments.map((tc) => {
                const tcPct = (timeToSeconds(tc.timestamp) / totalSec) * 100;
                return (
                  <div
                    key={tc.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-gold-400 rounded-full ring-2 ring-white cursor-pointer hover:scale-125 transition-transform"
                    style={{ left: `${tcPct}%` }}
                    title={`${tc.timestamp} - ${tc.text}`}
                    onClick={(e) => { e.stopPropagation(); onSeekTo?.(tc.timestamp); }}
                  />
                );
              })}
            </div>
            <span className="text-xs font-mono text-ink-500 tabular-nums w-9">{duration}</span>
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
