import { useState } from 'react';
import type { ScreenName } from '../types';
import { recruitments } from '../data';
import RecruitmentCard from '../components/RecruitmentCard';

interface RecruitmentProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function Recruitment({ navigate }: RecruitmentProps) {
  const [instrument, setInstrument] = useState('all');
  const [region, setRegion] = useState('all');
  const [purpose, setPurpose] = useState('all');

  const filtered = recruitments.filter((r) => {
    if (instrument !== 'all' && r.instrument !== instrument) return false;
    if (region !== 'all' && r.region !== region) return false;
    if (purpose !== 'all' && r.purpose !== purpose) return false;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-2xl font-bold text-ink-900">アンサンブル募集</h1>
        <button
          onClick={() => navigate('createRecruitment')}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          募集する
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-ink-100 p-4 mb-5 grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">楽器</label>
          <select value={instrument} onChange={(e) => setInstrument(e.target.value)} className="w-full px-2 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="all">全て</option>
            <option>Piano</option><option>Violin</option><option>Cello</option><option>Flute</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">地域</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full px-2 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="all">全て</option>
            <option>東京</option><option>大阪</option><option>神奈川</option><option>京都</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-500 mb-1">目的</label>
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full px-2 py-2 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="all">全て</option>
            <option>アンサンブル</option><option>発表会</option><option>趣味で合わせ</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map((r) => (
          <RecruitmentCard
            key={r.id}
            recruitment={r}
            onClick={() => navigate('recruitmentDetail', { id: r.id })}
            onUserClick={() => navigate('userProfile', { id: r.user.id })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-ink-400">
            <p>該当する募集がありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
