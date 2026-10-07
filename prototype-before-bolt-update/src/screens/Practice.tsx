import type { ScreenName } from '../types';
import { practiceRecords, practiceByPiece } from '../data';
import PracticeCard from '../components/PracticeCard';
import { Plus, TrendingUp, Clock, Music2 } from 'lucide-react';

interface PracticeProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function Practice({ navigate }: PracticeProps) {
  const totalMinutes = practiceByPiece.reduce((s, p) => s + p.total, 0);
  const todayMinutes = practiceRecords[0]?.entries.reduce((s, e) => s + e.minutes, 0) || 0;
  const practiceDays = practiceRecords.length;
  const maxBar = Math.max(...practiceByPiece.flatMap((p) => p.records.map((r) => r.minutes)), 1);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink-900">練習管理</h1>
        <button
          onClick={() => navigate('createPractice')}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> 練習を記録
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Clock} label="今日の練習" value={`${todayMinutes} min`} color="teal" />
        <StatCard icon={Music2} label="練習曲数" value={`${practiceByPiece.length} 曲`} color="gold" />
        <StatCard icon={TrendingUp} label="今週合計" value={`${totalMinutes} min`} color="sage" />
        <StatCard icon={Clock} label="練習日数" value={`${practiceDays} 日`} color="burgundy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink-900">練習記録</h2>
          {practiceRecords.map((r) => (
            <PracticeCard key={r.id} record={r} onClick={() => navigate('practiceDetail', { id: r.id })} />
          ))}
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-serif text-lg font-semibold text-ink-900 mb-4">曲目別練習時間</h2>
          <div className="bg-white rounded-2xl border border-ink-100 p-5 space-y-5">
            {practiceByPiece.map((item) => (
              <div key={item.piece.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-ink-800 truncate flex-1">
                    <span className="italic text-ink-500">{item.piece.composer}</span> / {item.piece.title}
                  </p>
                  <span className="text-sm text-teal-700 font-medium ml-2 flex-shrink-0">{item.total} min</span>
                </div>
                <div className="flex items-end gap-1 h-16 bg-ink-50 rounded-lg p-1.5">
                  {item.records.map((r, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-teal-600 to-teal-400 rounded-sm hover:from-teal-700 hover:to-teal-500 transition-colors group relative"
                      style={{ height: `${(r.minutes / maxBar) * 100}%` }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{r.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
    gold: 'bg-gold-50 text-gold-700 border-gold-200',
    sage: 'bg-sage-50 text-sage-700 border-sage-200',
    burgundy: 'bg-burgundy-50 text-burgundy-700 border-burgundy-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <Icon size={18} className="mb-2" />
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}
