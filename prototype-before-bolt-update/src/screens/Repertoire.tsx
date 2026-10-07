import type { ScreenName } from '../types';
import { pieces } from '../data';
import { ArrowLeft, BookOpen, Plus, Music2, MoreVertical } from 'lucide-react';

interface RepertoireProps {
  navigate: (s: ScreenName) => void;
}

export default function Repertoire({ navigate }: RepertoireProps) {
  const repertoire = pieces.filter((p) => p.status === 'repertoire' || p.status === 'performed');
  const practicing = pieces.filter((p) => p.status === 'practicing');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('myPage')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> マイページ
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink-900 flex items-center gap-2">
          <BookOpen size={22} className="text-teal-600" /> レパートリー
        </h1>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm">
          <Plus size={16} /> 追加
        </button>
      </div>

      <section className="mb-6">
        <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">練習中</h2>
        <div className="space-y-2">
          {practicing.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 group hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center flex-shrink-0">
                <Music2 size={18} className="text-gold-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 text-sm">
                  <span className="italic text-ink-500">{p.composer}</span> / {p.title}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-gold-100 text-gold-700 rounded-md text-xs font-medium">練習中</span>
              </div>
              <button className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-ink-600 transition-opacity">
                <MoreVertical size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">レパートリー</h2>
        <div className="space-y-2">
          {repertoire.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 group hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Music2 size={18} className="text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 text-sm">
                  <span className="italic text-ink-500">{p.composer}</span> / {p.title}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium ${p.status === 'performed' ? 'bg-sage-100 text-sage-700' : 'bg-teal-100 text-teal-700'}`}>
                  {p.status === 'performed' ? '演奏済' : 'レパートリー'}
                </span>
              </div>
              <button className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-ink-600 transition-opacity">
                <MoreVertical size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
