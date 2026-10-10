import type { ScreenName } from '../types';
import { practiceRecords } from '../data';
import { ArrowLeft, Clock, Music2 } from 'lucide-react';

interface PracticeDetailProps {
  recordId: string;
  navigate: (s: ScreenName) => void;
}

export default function PracticeDetail({ recordId, navigate }: PracticeDetailProps) {
  const record = practiceRecords.find((r) => r.id === recordId) || practiceRecords[0];
  const total = record.entries.reduce((s, e) => s + e.minutes, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('practice')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 練習一覧
      </button>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-ink-900">{record.date}</h1>
          <span className="flex items-center gap-1.5 text-sm text-teal-700 font-medium">
            <Clock size={16} /> Total {total} min
          </span>
        </div>

        <div className="space-y-4">
          {record.entries.map((entry, i) => (
            <div key={i} className="bg-ink-50 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-2">
                <Music2 size={18} className="text-teal-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900">
                    <span className="italic text-ink-500">{entry.piece.composer}</span> / {entry.piece.title}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md text-xs font-medium">{entry.minutes} min</span>
                </div>
              </div>
              {entry.comment && (
                <p className="text-sm text-ink-600 leading-relaxed pl-7 mt-2">{entry.comment}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
