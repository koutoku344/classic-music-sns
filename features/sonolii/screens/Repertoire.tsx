import { useState } from 'react';
import type { ScreenName, Piece } from '../types';
import { pieces } from '../data';
import PiecePicker from '../components/PiecePicker';
import { ArrowLeft, BookOpen, Plus, Music2, MoreVertical, X, Trash2 } from 'lucide-react';

interface RepertoireProps {
  navigate: (s: ScreenName) => void;
}

const statusOrder: Record<string, number> = { practicing: 0, repertoire: 1, performed: 2 };
const statusLabels: Record<string, string> = { practicing: '練習中', repertoire: 'レパートリー', performed: '演奏済' };
const statusBadgeColors: Record<string, string> = {
  practicing: 'bg-gold-100 text-gold-700',
  repertoire: 'bg-teal-100 text-teal-700',
  performed: 'bg-sage-100 text-sage-700',
};
const statusIconColors: Record<string, string> = {
  practicing: 'bg-gold-50 text-gold-600',
  repertoire: 'bg-teal-50 text-teal-600',
  performed: 'bg-sage-50 text-sage-600',
};

export default function Repertoire({ navigate }: RepertoireProps) {
  const [repertoire, setRepertoire] = useState<Piece[]>(pieces);
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [newStatus, setNewStatus] = useState<'practicing' | 'repertoire'>('practicing');

  const sorted = [...repertoire].sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  const practicing = sorted.filter((p) => p.status === 'practicing');
  const repertoireList = sorted.filter((p) => p.status === 'repertoire' || p.status === 'performed');

  const handleAdd = () => {
    if (!selectedPiece) return;
    const newPiece: Piece = { ...selectedPiece, status: newStatus };
    setRepertoire([...repertoire, newPiece]);
    setSelectedPiece(null);
    setNewStatus('practicing');
    setShowAdd(false);
  };

  const cycleStatus = (id: string) => {
    setRepertoire(repertoire.map((p) => {
      if (p.id !== id) return p;
      const order: Piece['status'][] = ['practicing', 'repertoire'];
      const idx = order.indexOf(p.status);
      return { ...p, status: order[(idx + 1) % order.length] };
    }));
  };

  const deletePiece = (id: string) => {
    setRepertoire(repertoire.filter((p) => p.id !== id));
    setMenuOpenId(null);
  };

  const renderItem = (p: Piece) => (
    <div key={p.id} className="bg-white rounded-xl border border-ink-100 p-4 flex items-center gap-3 group hover:shadow-sm transition-shadow relative">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusIconColors[p.status]}`}>
        <Music2 size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 text-sm">
          <span className="italic text-ink-500">{p.composer}</span> / {p.title}
        </p>
        <button
          onClick={() => cycleStatus(p.id)}
          className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors hover:opacity-80 ${statusBadgeColors[p.status]}`}
        >
          {statusLabels[p.status]} · タップで変更
        </button>
      </div>
      <button
        onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
        className="text-ink-400 hover:text-ink-600 transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      {menuOpenId === p.id && (
        <div className="absolute right-4 top-12 z-20 bg-white rounded-xl shadow-lg border border-ink-100 py-1 min-w-[120px] animate-scale-in">
          <button
            onClick={() => deletePiece(p.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-burgundy-600 hover:bg-burgundy-50 transition-colors"
          >
            <Trash2 size={14} /> 削除
          </button>
          <button
            onClick={() => setMenuOpenId(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
          >
            <X size={14} /> キャンセル
          </button>
        </div>
      )}
    </div>
  );

  if (showAdd) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => { setShowAdd(false); setSelectedPiece(null); setNewStatus('practicing'); }} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
          <ArrowLeft size={18} /> 戻る
        </button>

        <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">レパートリーを追加</h1>

        <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
          <PiecePicker
            pieces={pieces}
            selectedPiece={selectedPiece}
            onSelect={setSelectedPiece}
            label="曲"
          />

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">ステータス</label>
            <div className="flex gap-2">
              {(['practicing', 'repertoire'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${
                    newStatus === s
                      ? s === 'practicing'
                        ? 'bg-gold-100 text-gold-700 border-gold-300'
                        : 'bg-teal-100 text-teal-700 border-teal-300'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                  }`}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!selectedPiece}
            className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            追加する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('myPage')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> マイページ
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink-900 flex items-center gap-2">
          <BookOpen size={22} className="text-teal-600" /> レパートリー
        </h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> 追加
        </button>
      </div>

      <section className="mb-6">
        <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">練習中</h2>
        <div className="space-y-2">
          {practicing.map(renderItem)}
          {practicing.length === 0 && (
            <p className="text-sm text-ink-400 text-center py-8">練習中の曲はありません</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-lg font-semibold text-ink-800 mb-3">レパートリー</h2>
        <div className="space-y-2">
          {repertoireList.map(renderItem)}
          {repertoireList.length === 0 && (
            <p className="text-sm text-ink-400 text-center py-8">レパートリーはありません</p>
          )}
        </div>
      </section>
    </div>
  );
}
