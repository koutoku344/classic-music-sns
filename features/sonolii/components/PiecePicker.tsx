import { useState, useMemo } from 'react';
import type { Piece } from '../types';
import { Search, X, Plus, Check, Music2, ChevronLeft, Clock } from 'lucide-react';

interface PiecePickerProps {
  pieces: Piece[];
  selectedPiece: Piece | null;
  onSelect: (piece: Piece | null) => void;
  label?: string;
  allowFreeInput?: boolean;
  recentPieces?: Piece[];
}

type SearchMode = 'composer' | 'title';

export default function PiecePicker({ pieces, selectedPiece, onSelect, label = '曲', allowFreeInput = true, recentPieces = [] }: PiecePickerProps) {
  const [open, setOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('composer');
  const [composerQuery, setComposerQuery] = useState('');
  const [selectedComposer, setSelectedComposer] = useState<string | null>(null);
  const [titleQuery, setTitleQuery] = useState('');
  const [showFreeInput, setShowFreeInput] = useState(false);
  const [freeComposer, setFreeComposer] = useState('');
  const [freeTitle, setFreeTitle] = useState('');

  const composers = useMemo(
    () => [...new Set(pieces.map((p) => p.composer))],
    [pieces]
  );

  const filteredComposers = useMemo(() => {
    if (!composerQuery.trim()) return composers;
    const q = composerQuery.toLowerCase();
    return composers.filter((c) => c.toLowerCase().includes(q));
  }, [composers, composerQuery]);

  const composerPieces = useMemo(
    () => selectedComposer ? pieces.filter((p) => p.composer === selectedComposer) : [],
    [pieces, selectedComposer]
  );

  const filteredComposerPieces = useMemo(() => {
    if (!titleQuery.trim()) return composerPieces;
    const q = titleQuery.toLowerCase();
    return composerPieces.filter((p) => p.title.toLowerCase().includes(q));
  }, [composerPieces, titleQuery]);

  const titleResults = useMemo(() => {
    if (!titleQuery.trim()) return [];
    const q = titleQuery.toLowerCase();
    return pieces.filter((p) => p.title.toLowerCase().includes(q));
  }, [pieces, titleQuery]);

  const resetSearch = () => {
    setComposerQuery('');
    setSelectedComposer(null);
    setTitleQuery('');
    setShowFreeInput(false);
    setFreeComposer('');
    setFreeTitle('');
  };

  const handleClose = () => {
    setOpen(false);
    resetSearch();
  };

  const handleSelectPiece = (p: Piece) => {
    onSelect(p);
    handleClose();
  };

  const handleFreeConfirm = () => {
    if (freeComposer.trim() && freeTitle.trim()) {
      handleSelectPiece({
        id: `free-${Date.now()}`,
        composer: freeComposer.trim(),
        title: freeTitle.trim(),
        status: 'practicing',
      });
    }
  };

  if (selectedPiece) {
    return (
      <div>
        {label && <label className="block text-sm font-medium text-ink-700 mb-1.5">{label}</label>}
        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Music2 size={18} className="text-teal-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-serif italic text-ink-600 truncate">{selectedPiece.composer}</p>
              <p className="text-sm font-medium text-ink-900 truncate">{selectedPiece.title}</p>
            </div>
          </div>
          <button
            onClick={() => { onSelect(null); resetSearch(); }}
            className="flex-shrink-0 ml-2 w-7 h-7 flex items-center justify-center text-ink-400 hover:text-burgundy-500 hover:bg-burgundy-50 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-ink-700 mb-1.5">{label}</label>}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-ink-200 rounded-xl text-sm font-medium text-ink-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30 transition-colors"
      >
        <Plus size={18} /> 曲を選択
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-900/40 animate-fade-in" onClick={handleClose} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 flex-shrink-0">
              <h3 className="font-serif font-bold text-ink-900">曲を選択</h3>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-600 hover:bg-ink-50 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex-1">
              {showFreeInput ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-700">手動入力</p>
                    <button onClick={() => setShowFreeInput(false)} className="text-ink-400 hover:text-burgundy-500">
                      <X size={18} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">作曲者</label>
                    <input
                      type="text"
                      value={freeComposer}
                      onChange={(e) => setFreeComposer(e.target.value)}
                      placeholder="例: J.S. Bach"
                      className="w-full px-3 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">曲名</label>
                    <input
                      type="text"
                      value={freeTitle}
                      onChange={(e) => setFreeTitle(e.target.value)}
                      placeholder="例: Partita No.2 Sinfonia"
                      className="w-full px-3 py-2.5 bg-ink-50 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <button
                    onClick={handleFreeConfirm}
                    disabled={!freeComposer.trim() || !freeTitle.trim()}
                    className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    この曲で登録する
                  </button>
                </div>
              ) : (
                <>
                  {/* Recent pieces */}
                  {recentPieces.length > 0 && !composerQuery && !titleQuery && !selectedComposer && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-ink-500 mb-2 flex items-center gap-1">
                        <Clock size={12} /> 最近使った曲
                      </p>
                      <div className="space-y-1">
                        {recentPieces.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPiece(p)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-teal-50/50 transition-colors text-left"
                          >
                            <Music2 size={16} className="text-teal-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-serif text-ink-800 truncate">{p.title}</p>
                              <p className="text-xs font-serif italic text-ink-500 truncate">{p.composer}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-ink-100 my-4" />
                    </div>
                  )}

                  {/* Tab switch */}
                  <div className="flex gap-1 bg-ink-50 rounded-xl p-1 mb-3">
                    <button
                      onClick={() => { setSearchMode('composer'); resetSearch(); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${searchMode === 'composer' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
                    >
                      作曲者から探す
                    </button>
                    <button
                      onClick={() => { setSearchMode('title'); resetSearch(); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${searchMode === 'title' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
                    >
                      曲名から探す
                    </button>
                  </div>

                  {searchMode === 'composer' && !selectedComposer && (
                    <>
                      <div className="relative mb-2">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={composerQuery}
                          onChange={(e) => setComposerQuery(e.target.value)}
                          placeholder="作曲者名を入力"
                          className="w-full pl-10 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-50 bg-white">
                        {filteredComposers.map((c) => (
                          <button
                            key={c}
                            onClick={() => { setSelectedComposer(c); setComposerQuery(''); }}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50/50 transition-colors text-left"
                          >
                            <span className="text-sm font-serif text-ink-800">{c}</span>
                            <span className="text-xs text-ink-400">{pieces.filter((p) => p.composer === c).length}曲</span>
                          </button>
                        ))}
                        {filteredComposers.length === 0 && (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-ink-400 mb-2">該当する作曲者が見つかりませんでした</p>
                            {allowFreeInput && (
                              <button
                                onClick={() => { setShowFreeInput(true); setFreeComposer(composerQuery); }}
                                className="inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium"
                              >
                                <Plus size={16} /> 手動で入力する
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {searchMode === 'composer' && selectedComposer && (
                    <>
                      <button
                        onClick={() => { setSelectedComposer(null); setTitleQuery(''); }}
                        className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-700 font-medium mb-2"
                      >
                        <ChevronLeft size={16} /> 作曲者一覧へ戻る
                      </button>
                      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 mb-2">
                        <Check size={16} className="text-teal-600" />
                        <span className="text-sm font-serif text-ink-800">{selectedComposer}</span>
                      </div>
                      <div className="relative mb-2">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={titleQuery}
                          onChange={(e) => setTitleQuery(e.target.value)}
                          placeholder="曲名で絞り込み"
                          className="w-full pl-10 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-50 bg-white">
                        {filteredComposerPieces.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPiece(p)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50/50 transition-colors text-left"
                          >
                            <span className="text-sm font-serif text-ink-800 truncate">{p.title}</span>
                            <Plus size={16} className="text-teal-600 flex-shrink-0 ml-2" />
                          </button>
                        ))}
                        {filteredComposerPieces.length === 0 && (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-ink-400 mb-2">該当する曲が見つかりませんでした</p>
                            {allowFreeInput && (
                              <button
                                onClick={() => { setShowFreeInput(true); setFreeComposer(selectedComposer); }}
                                className="inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium"
                              >
                                <Plus size={16} /> 手動で入力する
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {searchMode === 'title' && (
                    <>
                      <div className="relative mb-2">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          value={titleQuery}
                          onChange={(e) => setTitleQuery(e.target.value)}
                          placeholder="曲名を入力"
                          className="w-full pl-10 pr-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-ink-100 divide-y divide-ink-50 bg-white">
                        {titleQuery.trim() && titleResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSelectPiece(p)}
                            className="w-full px-4 py-2.5 hover:bg-teal-50/50 transition-colors text-left"
                          >
                            <p className="text-sm font-serif text-ink-800 truncate">{p.title}</p>
                            <p className="text-xs font-serif italic text-ink-500 mt-0.5">{p.composer}</p>
                          </button>
                        ))}
                        {titleQuery.trim() && titleResults.length === 0 && (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-ink-400 mb-2">該当する曲が見つかりませんでした</p>
                            {allowFreeInput && (
                              <button
                                onClick={() => { setShowFreeInput(true); setFreeTitle(titleQuery); }}
                                className="inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium"
                              >
                                <Plus size={16} /> 手動で入力する
                              </button>
                            )}
                          </div>
                        )}
                        {!titleQuery.trim() && (
                          <div className="px-4 py-8 text-center">
                            <Search size={24} className="mx-auto text-ink-300 mb-2" />
                            <p className="text-sm text-ink-400">曲名を入力して検索してください</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {allowFreeInput && (
                    <button
                      onClick={() => setShowFreeInput(true)}
                      className="mt-4 flex items-center gap-1.5 text-sm text-ink-500 hover:text-teal-700 font-medium"
                    >
                      <Plus size={16} /> 曲が見つからない場合は手動入力
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
