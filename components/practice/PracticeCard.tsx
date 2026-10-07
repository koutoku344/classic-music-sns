import { Music2, Clock } from 'lucide-react';
import type { PracticeRecord } from '../types';

interface PracticeCardProps {
  record: PracticeRecord;
  onClick?: () => void;
}

export default function PracticeCard({ record, onClick }: PracticeCardProps) {
  const total = record.entries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl border border-ink-100 p-5 hover:shadow-md transition-shadow cursor-pointer animate-slide-up"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif font-semibold text-ink-900">{record.date}</h3>
        <span className="flex items-center gap-1.5 text-sm text-teal-700 font-medium">
          <Clock size={15} />
          Total {total} min
        </span>
      </div>
      <div className="space-y-3">
        {record.entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-3">
            <Music2 size={16} className="text-teal-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-800">
                <span className="italic text-ink-500">{entry.piece.composer}</span> / {entry.piece.title}
              </p>
              {entry.comment && <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{entry.comment}</p>}
            </div>
            <span className="text-sm text-ink-600 font-medium tabular-nums flex-shrink-0">{entry.minutes} min</span>
          </div>
        ))}
      </div>
    </div>
  );
}
