import { useState } from 'react';
import type { ScreenName } from '../types';
import { pieces } from '../data';
import { ArrowLeft, Plus, X } from 'lucide-react';

interface CreatePracticeProps {
  navigate: (s: ScreenName) => void;
}

export default function CreatePractice({ navigate }: CreatePracticeProps) {
  const [entries, setEntries] = useState([{ pieceId: pieces[0].id, minutes: 30, comment: '' }]);

  const addEntry = () => setEntries([...entries, { pieceId: pieces[0].id, minutes: 30, comment: '' }]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateEntry = (i: number, key: string, value: string | number) =>
    setEntries(entries.map((e, idx) => idx === i ? { ...e, [key]: value } : e));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('practice')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">練習を記録</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 animate-slide-up">
        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className="bg-ink-50 rounded-xl p-4 relative">
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} className="absolute top-3 right-3 text-ink-400 hover:text-burgundy-500">
                  <X size={16} />
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-ink-600 mb-1">曲</label>
                  <select
                    value={entry.pieceId}
                    onChange={(e) => updateEntry(i, 'pieceId', e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    {pieces.map((p) => (
                      <option key={p.id} value={p.id}>{p.composer} / {p.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">時間（分）</label>
                  <input
                    type="number"
                    value={entry.minutes}
                    onChange={(e) => updateEntry(i, 'minutes', Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">メモ</label>
                <textarea
                  value={entry.comment}
                  onChange={(e) => updateEntry(i, 'comment', e.target.value)}
                  placeholder="練習内容や気づきを記録"
                  className="w-full px-3 py-2.5 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addEntry}
          className="mt-4 flex items-center gap-1.5 text-sm text-teal-700 font-medium hover:text-teal-800"
        >
          <Plus size={16} /> 曲を追加
        </button>

        <button
          onClick={() => navigate('practice')}
          className="w-full mt-6 py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          記録する
        </button>
      </div>
    </div>
  );
}
