import type { CSSProperties } from 'react';

export type DonutItem = { label: string; minutes: number };
const COLORS = ['#0f766e','#b45309','#6366f1','#be185d','#0891b2','#65a30d','#9333ea','#ea580c'];

export default function PracticeDonut({ items }: { items: DonutItem[] }) {
  const slices = items.filter(item => item.minutes > 0);
  const total = slices.reduce((sum, item) => sum + item.minutes, 0);
  let current = 0;
  const segments = slices.map((item, index) => {
    const from = current;
    current += item.minutes / total * 100;
    return `${COLORS[index % COLORS.length]} ${from}% ${current}%`;
  });
  const background: CSSProperties = {
    background: total ? `conic-gradient(${segments.join(', ')})` : '#e5e7eb',
  };
  return (
    <section className="bg-white border border-ink-100 rounded-2xl p-4 mb-5">
      <h2 className="font-semibold text-sm text-ink-800 mb-3">今月の練習時間の内訳</h2>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="relative w-44 h-44 rounded-full shrink-0" role="img"
          aria-label={`月合計${total}分。${slices.map(item => `${item.label} ${item.minutes}分`).join('、')}`} style={background}>
          <div className="absolute inset-7 bg-white rounded-full flex flex-col justify-center items-center">
            <strong className="text-teal-700 text-2xl">{total}</strong>
            <span className="text-xs text-ink-500">分 / 月</span>
          </div>
        </div>
        <ul className="w-full text-sm text-ink-700 space-y-2">
          {slices.map((item, index) => (
            <li key={item.label} className="flex items-start gap-2">
              <span className="w-2.5 h-2.5 mt-1.5 rounded-sm shrink-0" style={{ background: COLORS[index % COLORS.length] }} />
              <span className="flex-1 break-words">{item.label}</span>
              <span className="shrink-0 font-semibold">{item.minutes}分</span>
            </li>
          ))}
          {total === 0 && <li className="text-ink-500">この月の練習記録はまだありません。</li>}
        </ul>
      </div>
    </section>
  );
}
