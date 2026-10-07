import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPreviewProps {
  durationSec: number;
  label?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPreview({ durationSec, label }: AudioPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number>(0);

  const total = Math.max(1, durationSec);

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
        if (next >= total) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, total]);

  const pct = (current / total) * 100;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrent(ratio * total);
  };

  return (
    <div className="bg-ink-100 rounded-xl p-4 border border-ink-200">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying(!playing)}
          className="flex-shrink-0 w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          {label && <p className="text-sm font-medium text-ink-800 truncate mb-1.5">{label}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink-500 tabular-nums w-10 text-right">{formatTime(current)}</span>
            <div className="flex-1 relative cursor-pointer group" onClick={handleSeek}>
              <div className="h-2 bg-ink-200 rounded-full" />
              <div className="absolute top-0 left-0 h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
              <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 bg-teal-600 rounded-full shadow-md ring-2 ring-white opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-ink-500 tabular-nums w-10">{formatTime(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
