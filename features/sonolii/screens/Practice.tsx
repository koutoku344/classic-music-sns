import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { getAllPractices, todayLocal } from '../lib/practiceApi';
import type { PracticeRow } from '../lib/practiceApi';
import PracticeDonut, { type DonutItem } from '../components/PracticeDonut';
import { Calendar, ChevronLeft, ChevronRight, Clock, Music2, Plus } from 'lucide-react';

type Props = { navigate: (s: ScreenName, params?: Record<string, string>) => void };
type View = 'date' | 'piece';
type Period = 'today' | 'week' | 'month';
const ymd = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
function bounds(period: Period, date: Date) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(a);
  if (period === 'week') a.setDate(a.getDate() - ((a.getDay() + 6) % 7));
  if (period === 'month') a.setDate(1);
  if (period === 'week') b.setDate(a.getDate() + 6);
  if (period === 'month') b.setMonth(b.getMonth() + 1, 0);
  return [ymd(a), ymd(b)];
}
function monthBounds(year: number, month: number): [string, string] {
  return [ymd(new Date(year, month - 1, 1)), ymd(new Date(year, month, 0))];
}

export default function Practice({ navigate }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [records, setRecords] = useState<PracticeRow[]>([]);
  const [period, setPeriod] = useState<Period>('week');
  const [view, setView] = useState<View>('date');
  const [history, setHistory] = useState(false);
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fromTo = history ? monthBounds(month.year, month.month) : undefined;

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const rows = await getAllPractices(getToken, fromTo?.[0], fromTo?.[1]);
        if (active) {
          setRecords(rows);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : '練習記録を取得できませんでした。');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken, history, month.year, month.month]);

  const now = todayLocal();
  const today = new Date(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1, Number(now.slice(8, 10)));
  const periodRange = bounds(period, today);
  const actualMinutes = records
    .filter(
      (record) =>
        record.practice_date >= periodRange[0] &&
        record.practice_date <= periodRange[1],
    )
    .reduce((sum, record) => sum + record.duration_minutes, 0);
  const currentMonth = history ? month : { year: today.getFullYear(), month: today.getMonth() + 1 };
  const monthRange = monthBounds(currentMonth.year, currentMonth.month);
  const monthRecords = records.filter(r => r.practice_date >= monthRange[0] && r.practice_date <= monthRange[1]);
  const dailyMinutes = new Map<string, number>();
  const pieceMinutes = new Map<string, DonutItem>();
  for (const record of monthRecords) {
    dailyMinutes.set(record.practice_date, (dailyMinutes.get(record.practice_date) ?? 0) + record.duration_minutes);
    const pieceKey = record.user_piece_id ?? record.piece_id ?? record.piece_title;
    const old = pieceMinutes.get(pieceKey);
    pieceMinutes.set(pieceKey, {
      label: `${record.composer_name} / ${record.piece_title}`,
      minutes: (old?.minutes ?? 0) + record.duration_minutes,
    });
  }
  const chartItems: DonutItem[] = view === 'date'
    ? [...dailyMinutes].sort(([a], [b]) => a.localeCompare(b)).map(([label, minutes]) => ({ label, minutes }))
    : [...pieceMinutes.values()].sort((a, b) => b.minutes - a.minutes);
  const dayGroups = useMemo(() => {
    const map = new Map<string, PracticeRow[]>();
    records.forEach((record) => {
      const existing = map.get(record.practice_date) ?? [];
      map.set(record.practice_date, [...existing, record]);
    });
    return [...map];
  }, [records]);
  const byPiece = useMemo(() => {
    const map = new Map<string, { composer: string; title: string; total: number; count: number; records: PracticeRow[] }>();
    records.forEach(r => {
      const key = r.user_piece_id ? `user:${r.user_piece_id}` : `master:${r.piece_id}`;
      const item = map.get(key) ?? { composer: r.composer_name, title: r.piece_title, total: 0, count: 0, records: [] };
      item.total += r.duration_minutes;
      item.count++;
      item.records.push(r);
      map.set(key, item);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [records]);

  function shiftMonth(delta: number) {
    const d = new Date(month.year, month.month - 1 + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="sr-only">{history ? '過去の練習' : '練習管理'}</h1>
        <div className="flex gap-2">
          <button onClick={() => setHistory(!history)}
            className="px-3 py-2 border border-ink-200 rounded-xl bg-white text-sm">
            {history ? '練習管理へ戻る' : '過去の練習を見る'}
          </button>
          <button onClick={() => navigate('createPractice')}
            className="flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> 練習を記録
          </button>
        </div>
      </div>
      {history ? (
        <div className="flex items-center justify-center gap-5 my-5">
          <button onClick={() => shiftMonth(-1)} aria-label="前月"><ChevronLeft /></button>
          <strong className="text-lg">{month.year}年{month.month}月</strong>
          <button onClick={() => shiftMonth(1)} aria-label="翌月"><ChevronRight /></button>
        </div>
      ) : (
        <div className="bg-white border border-ink-100 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-ink-800">練習時間の実績</h2>
            <div className="flex gap-1 bg-ink-50 rounded-lg p-1">
              {(['today', 'week', 'month'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs ${period === p ? 'bg-white text-ink-900 shadow' : 'text-ink-500'}`}>
                  {p === 'today' ? '今日' : p === 'week' ? '今週' : '今月'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-3xl font-semibold text-teal-700">{actualMinutes} <span
            className="text-base font-normal">分</span></p>

        </div>
      )}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('date')}
          className={`px-4 py-2 rounded-lg text-sm ${view === 'date' ? 'bg-teal-600 text-white' : 'bg-white border border-ink-200'}`}>日付別</button>
        <button onClick={() => setView('piece')}
          className={`px-4 py-2 rounded-lg text-sm ${view === 'piece' ? 'bg-teal-600 text-white' : 'bg-white border border-ink-200'}`}>曲別</button>
      </div>
      {loading && <p className="text-sm text-ink-600">練習記録を読み込み中...</p>}
      {!loading && !error && isSignedIn && <PracticeDonut items={chartItems} />}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!isSignedIn && isLoaded && <p>練習記録を見るにはログインしてください。</p>}
      {!loading && !error && isSignedIn && records.length === 0 && <p className="bg-white p-5 rounded-xl text-ink-500">練習記録はまだありません。</p>}
      {!loading && !error && view === 'date' && (
        <div className="space-y-5">
          {dayGroups.map(([date, rows]) => (
            <section key={date} className="space-y-2">
              <div className="flex justify-between items-center text-sm text-ink-700">
                <h2 className="font-semibold flex gap-2 items-center"><Calendar size={16} /> {date}</h2>
                <span><Clock size={14}
                  className="inline" /> 合計 {rows.reduce((sum, r) => sum + r.duration_minutes, 0)} 分</span>
              </div>
              {rows.map(r => (
                <button key={r.id} onClick={() => navigate('practiceDetail', { id: r.id })}
                  className="w-full bg-white rounded-xl border border-ink-100 p-4 text-left hover:border-teal-300 hover:shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-ink-900">
                      <Music2 size={16} className="text-teal-600" />
                      <span><span
                        className="italic text-ink-500">{r.composer_name}</span> / {r.piece_title}</span>
                    </span>
                    <span className="text-teal-700 text-sm font-semibold whitespace-nowrap">{r.duration_minutes}分</span>
                  </div>
                  {r.comment && <p className="text-xs text-ink-500 mt-2 pl-6">{r.comment}</p>}
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
      {!loading && !error && view === 'piece' && (
        <div className="space-y-4">
          {byPiece.map((p, i) => (
            <div key={i} className="bg-white border border-ink-100 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-ink-900">{p.composer} / {p.title}</h2>
              <p className="text-sm text-teal-700 mt-1">{p.total}分・{p.count}回</p>
              <div className="mt-3 space-y-1">
                {p.records.map(r => (
                  <button key={r.id} onClick={() => navigate('practiceDetail', { id: r.id })}
                    className="w-full flex justify-between text-xs px-3 py-2 rounded-md bg-ink-50 hover:bg-teal-50">
                    <span>{r.practice_date}</span><span>{r.duration_minutes}分</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
