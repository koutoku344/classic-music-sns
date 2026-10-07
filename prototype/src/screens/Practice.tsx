import { useState } from 'react';
import type { ScreenName } from '../types';
import { practiceRecords, practiceByPiece, practiceGoals, practiceStats } from '../data';
import PracticeCard from '../components/PracticeCard';
import AudioPlayer from '../components/AudioPlayer';
import { Plus, Target, ChevronLeft, ChevronRight, Calendar, Clock, Music2 } from 'lucide-react';

interface PracticeProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

type GoalPeriod = 'today' | 'week' | 'month';

const periodLabels: Record<GoalPeriod, string> = { today: '今日', week: '今週', month: '今月' };

export default function Practice({ navigate }: PracticeProps) {
  const [period, setPeriod] = useState<GoalPeriod>('today');
  const [goalSet, setGoalSet] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMonth, setHistoryMonth] = useState({ year: 2026, month: 9 });

  const periodData = {
    today: { current: practiceStats.today, goal: practiceGoals.daily },
    week: { current: practiceStats.week, goal: practiceGoals.weekly },
    month: { current: practiceStats.month, goal: practiceGoals.monthly },
  };

  const data = periodData[period];
  const pct = goalSet ? Math.min(100, (data.current / data.goal) * 100) : 0;
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - pct / 100);

  const maxBar = Math.max(...practiceByPiece.flatMap((p) => p.records.map((r) => r.minutes)), 1);

  const monthlyGoal = 1200;
  const monthlyCurrent = 980;
  const monthlyPct = Math.min(100, (monthlyCurrent / monthlyGoal) * 100);
  const monthlyDashOffset = circumference * (1 - monthlyPct / 100);

  const monthName = `${historyMonth.year}年${historyMonth.month}月`;

  const shiftMonth = (delta: number) => {
    let m = historyMonth.month + delta;
    let y = historyMonth.year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setHistoryMonth({ year: y, month: m });
  };

  if (showHistory) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => setShowHistory(false)} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
          <ChevronLeft size={18} /> 戻る
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl font-bold text-ink-900">過去の練習</h1>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button onClick={() => shiftMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-white border border-ink-200 rounded-xl font-serif font-bold text-ink-900 hover:bg-ink-50 transition-colors">
            <Calendar size={18} className="text-teal-600" />
            {monthName}
          </button>
          <button onClick={() => shiftMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Monthly goal donut */}
        <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-6">
          <h2 className="font-serif text-base font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <Target size={18} className="text-teal-600" /> {monthName}の練習目標
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#e7e5e4" strokeWidth="12" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#0d9488" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={monthlyDashOffset} transform="rotate(-90 60 60)" className="transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-ink-900">{monthlyCurrent}</p>
                <p className="text-xs text-ink-400">/ {monthlyGoal} min</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-700 mb-1">月の目標 <span className="font-bold text-teal-700">{monthlyGoal} min</span></p>
              <p className="text-xs text-ink-500">あと <span className="font-medium text-ink-700">{Math.max(0, monthlyGoal - monthlyCurrent)} min</span> で目標達成</p>
              <div className="mt-2 h-2 bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${monthlyPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Practice records with audio */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <h2 className="font-serif text-lg font-semibold text-ink-900">{monthName}の練習記録</h2>
            {practiceRecords.map((record) => (
              <div key={record.id} className="bg-white rounded-2xl border border-ink-100 overflow-hidden animate-slide-up">
                <div className="flex items-center justify-between bg-ink-50 px-4 py-2.5 border-b border-ink-100">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
                    <Calendar size={14} className="text-teal-600" /> {record.date}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-teal-700 font-medium">
                    <Clock size={12} /> {record.entries.reduce((s, e) => s + e.minutes, 0)} min
                  </span>
                </div>
                <div className="divide-y divide-ink-50">
                  {record.entries.map((entry, ei) => (
                    <div key={ei} className="p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <Music2 size={16} className="text-teal-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-800">
                            <span className="italic text-ink-500">{entry.piece.composer}</span> / {entry.piece.title}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-xs font-medium">{entry.minutes} min</span>
                        </div>
                      </div>
                      {entry.comment && <p className="text-xs text-ink-500 leading-relaxed pl-6 mb-2">{entry.comment}</p>}
                      {entry.audioTitle && entry.audioDuration && (
                        <div className="pl-6"><AudioPlayer title={entry.audioTitle} duration={entry.audioDuration} compact /></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
                      <div key={i} className="flex-1 bg-gradient-to-t from-teal-600 to-teal-400 rounded-sm transition-colors group relative" style={{ height: `${(r.minutes / maxBar) * 100}%` }}>
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink-900">練習管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 transition-colors"
          >
            <Calendar size={16} /> 過去の練習を見る
          </button>
          <button
            onClick={() => navigate('createPractice')}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> 練習を記録
          </button>
        </div>
      </div>

      {/* Practice goal donut chart */}
      <div className="bg-white rounded-2xl border border-ink-100 p-5 mb-6 relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-base font-semibold text-ink-900 flex items-center gap-2">
            <Target size={18} className="text-teal-600" /> 練習目標
          </h2>
          <div className="flex gap-1 bg-ink-50 rounded-lg p-0.5">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="120" height="120" viewBox="0 0 120 120" className={goalSet ? '' : 'opacity-30'}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e7e5e4" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#0d9488" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={goalSet ? dashOffset : circumference} transform="rotate(-90 60 60)" className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-2xl font-bold ${goalSet ? 'text-ink-900' : 'text-ink-300'}`}>{data.current}</p>
              <p className={`text-xs ${goalSet ? 'text-ink-400' : 'text-ink-300'}`}>/ {data.goal} min</p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {goalSet ? (
              <>
                <p className="text-sm text-ink-700 mb-1">{periodLabels[period]}の目標 <span className="font-bold text-teal-700">{data.goal} min</span></p>
                <p className="text-xs text-ink-500">あと <span className="font-medium text-ink-700">{Math.max(0, data.goal - data.current)} min</span> で目標達成</p>
                <div className="mt-2 h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-400 mb-1">目標未設定</p>
                <p className="text-xs text-ink-400 mb-3">練習目標を設定してみませんか？</p>
              </>
            )}
          </div>
        </div>

        {!goalSet && (
          <div className="absolute inset-0 bg-white/80 rounded-2xl flex flex-col items-center justify-center">
            <p className="text-sm text-ink-600 mb-3 text-center">練習目標を設定してみませんか？</p>
            <button onClick={() => setGoalSet(true)} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm">
              目標を設定
            </button>
          </div>
        )}
      </div>

      {/* Practice records & by-piece, filtered by period */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink-900">練習記録</h2>
          {practiceRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl border border-ink-100 overflow-hidden animate-slide-up">
              <div className="flex items-center justify-between bg-ink-50 px-4 py-2.5 border-b border-ink-100">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
                  <Calendar size={14} className="text-teal-600" /> {record.date}
                </span>
                <span className="flex items-center gap-1 text-xs text-teal-700 font-medium">
                  <Clock size={12} /> {record.entries.reduce((s, e) => s + e.minutes, 0)} min
                </span>
              </div>
              <div className="divide-y divide-ink-50">
                {record.entries.map((entry, ei) => (
                  <div key={ei} className="p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <Music2 size={16} className="text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-800">
                          <span className="italic text-ink-500">{entry.piece.composer}</span> / {entry.piece.title}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-xs font-medium">{entry.minutes} min</span>
                      </div>
                    </div>
                    {entry.comment && <p className="text-xs text-ink-500 leading-relaxed pl-6 mb-2">{entry.comment}</p>}
                    {entry.audioTitle && entry.audioDuration && (
                      <div className="pl-6"><AudioPlayer title={entry.audioTitle} duration={entry.audioDuration} compact /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
                    <div key={i} className="flex-1 bg-gradient-to-t from-teal-600 to-teal-400 rounded-sm transition-colors group relative" style={{ height: `${(r.minutes / maxBar) * 100}%` }}>
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
