import { useState, useMemo } from 'react';
import type { ScreenName, Piece } from '../types';
import { pieces, practiceRecords, recentPieceIds } from '../data';
import PiecePicker from '../components/PiecePicker';
import { ArrowLeft, Plus, X, FileAudio, Mic, Circle, Clock, Check, RotateCcw, Share2 } from 'lucide-react';
import AudioPreview from '../components/AudioPreview';

interface CreatePracticeProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

interface PracticeEntryDraft {
  piece: Piece | null;
  minutes: number;
  comment: string;
  audioMode: 'upload' | 'record' | 'done' | null;
  isRecording: boolean;
}

function newEntry(): PracticeEntryDraft {
  return { piece: null, minutes: 30, comment: '', audioMode: null, isRecording: false };
}

const recentPieces = pieces.filter((p) => recentPieceIds.includes(p.id));

export default function CreatePractice({ navigate }: CreatePracticeProps) {
  const [date, setDate] = useState('2026/10/05');
  const [entries, setEntries] = useState<PracticeEntryDraft[]>([newEntry()]);
  const [pieceMode, setPieceMode] = useState<'new' | 'past'>('new');
  const [showPostPrompt, setShowPostPrompt] = useState(false);

  const pastPieces = useMemo(() => {
    const map = new Map<string, Piece>();
    practiceRecords.forEach((r) => r.entries.forEach((e) => map.set(e.piece.id, e.piece)));
    return [...map.values()];
  }, []);

  const update = (i: number, patch: Partial<PracticeEntryDraft>) =>
    setEntries(entries.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const addEntry = () => setEntries([...entries, newEntry()]);
  const removeEntry = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));

  const hasAudio = entries.some((e) => e.audioMode === 'done');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('practice')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">練習を記録</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 animate-slide-up">
        <div className="mb-5">
          <label className="block text-sm font-medium text-ink-700 mb-2">練習日</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>

        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className="bg-ink-50 rounded-xl p-4 relative">
              {entries.length > 1 && (
                <button onClick={() => removeEntry(i)} className="absolute top-3 right-3 text-ink-400 hover:text-burgundy-500 z-10">
                  <X size={16} />
                </button>
              )}

              {/* Piece mode switch */}
              <div className="mb-3">
                <div className="flex gap-1 bg-white rounded-lg p-1 mb-3">
                  <button
                    onClick={() => { update(i, { piece: null }); setPieceMode('new'); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${pieceMode === 'new' ? 'bg-ink-50 text-ink-900' : 'text-ink-500'}`}
                  >
                    新しい曲を記録
                  </button>
                  <button
                    onClick={() => { update(i, { piece: null }); setPieceMode('past'); }}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${pieceMode === 'past' ? 'bg-ink-50 text-ink-900' : 'text-ink-500'}`}
                  >
                    過去練習した曲から記録
                  </button>
                </div>

                {pieceMode === 'new' ? (
                  <PiecePicker
                    pieces={pieces}
                    selectedPiece={entry.piece}
                    onSelect={(p) => update(i, { piece: p })}
                    label="練習した曲"
                    recentPieces={recentPieces}
                  />
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-ink-600">過去に練習した曲</label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-ink-100 bg-white divide-y divide-ink-50">
                      {pastPieces.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => update(i, { piece: p })}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-teal-50/50 transition-colors text-left"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-serif text-ink-800 truncate">
                              <span className="italic text-ink-500">{p.composer}</span> / {p.title}
                            </p>
                          </div>
                          {entry.piece?.id === p.id ? (
                            <Check size={14} className="text-teal-600 flex-shrink-0 ml-2" />
                          ) : (
                            <Plus size={14} className="text-teal-600 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Audio recording */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-ink-600 mb-1.5">録音（任意）</label>
                {entry.audioMode === null ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => update(i, { audioMode: 'upload' })}
                      className="border-2 border-dashed border-ink-200 rounded-lg p-3 text-center hover:border-teal-400 transition-colors"
                    >
                      <FileAudio size={20} className="mx-auto text-ink-400 mb-1" />
                      <p className="text-xs text-ink-700 font-medium">ファイルを選択</p>
                    </button>
                    <button
                      onClick={() => update(i, { audioMode: 'record' })}
                      className="border-2 border-dashed border-ink-200 rounded-lg p-3 text-center hover:border-burgundy-400 transition-colors"
                    >
                      <Mic size={20} className="mx-auto text-ink-400 mb-1" />
                      <p className="text-xs text-ink-700 font-medium">今から録音する</p>
                    </button>
                  </div>
                ) : entry.audioMode === 'upload' ? (
                  <div>
                    <div className="border-2 border-dashed border-teal-300 bg-teal-50/30 rounded-lg p-4 text-center">
                      <FileAudio size={24} className="mx-auto text-teal-600 mb-1" />
                      <p className="text-xs text-ink-700 font-medium">ファイルを選択</p>
                      <p className="text-[10px] text-ink-400 mt-0.5">MP3, WAV, M4A</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => update(i, { audioMode: 'done' })} className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">
                        <Check size={12} /> 使用
                      </button>
                      <button onClick={() => update(i, { audioMode: null })} className="flex items-center gap-1 text-xs text-ink-500 hover:text-burgundy-500">
                        <X size={12} /> クリア
                      </button>
                    </div>
                  </div>
                ) : entry.audioMode === 'record' ? (
                  <div>
                    <div className="border-2 border-dashed border-burgundy-300 bg-burgundy-50/30 rounded-lg p-4 text-center">
                      {entry.isRecording ? (
                        <>
                          <div className="flex items-center justify-center gap-1.5 mb-2">
                            <Circle size={10} className="text-burgundy-500 fill-burgundy-500 animate-pulse-soft" />
                            <p className="text-xs text-burgundy-700 font-medium">録音中...</p>
                          </div>
                          <p className="text-xl font-mono font-bold text-burgundy-700 mb-2">00:15</p>
                          <button onClick={() => update(i, { isRecording: false })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-burgundy-500 text-white rounded-lg text-xs font-medium hover:bg-burgundy-600">
                            停止
                          </button>
                        </>
                      ) : (
                        <>
                          <Mic size={24} className="mx-auto text-burgundy-500 mb-1" />
                          <p className="text-xs text-ink-700 font-medium mb-1">録音の準備ができました</p>
                          <button onClick={() => update(i, { isRecording: true })} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-burgundy-500 text-white rounded-lg text-xs font-medium hover:bg-burgundy-600">
                            <Circle size={12} className="fill-white" /> 録音開始
                          </button>
                        </>
                      )}
                    </div>
                    {!entry.isRecording && (
                      <div className="flex items-center gap-2 mt-1">
                        <button onClick={() => update(i, { audioMode: 'done' })} className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700">
                          <Check size={12} /> この音声を使用
                        </button>
                        <button onClick={() => update(i, { isRecording: true })} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-ink-200 text-ink-700 rounded-lg text-xs font-medium hover:bg-ink-50">
                          <RotateCcw size={12} /> 録り直す
                        </button>
                        <button onClick={() => update(i, { audioMode: null, isRecording: false })} className="flex items-center gap-1 text-xs text-ink-500 hover:text-burgundy-500">
                          <X size={12} /> クリア
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AudioPreview durationSec={30} label="録音した音声" />
                    <div className="flex items-center gap-2">
                      <button onClick={() => update(i, { audioMode: 'record', isRecording: false })} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-ink-200 text-ink-700 rounded-lg text-xs font-medium hover:bg-ink-50">
                        <RotateCcw size={12} /> 録り直す
                      </button>
                      <button onClick={() => update(i, { audioMode: null, isRecording: false })} className="flex items-center gap-1 text-xs text-ink-500 hover:text-burgundy-500">
                        <X size={12} /> クリア
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Time */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-ink-600 mb-1">練習時間（分）</label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="number"
                    value={entry.minutes}
                    onChange={(e) => update(i, { minutes: Number(e.target.value) })}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">メモ</label>
                <textarea
                  value={entry.comment}
                  onChange={(e) => update(i, { comment: e.target.value })}
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
          onClick={() => setShowPostPrompt(true)}
          className="w-full mt-6 py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          記録する
        </button>
      </div>

      {showPostPrompt && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-900/40 animate-fade-in" onClick={() => { setShowPostPrompt(false); navigate('practice'); }} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up p-6">
            <div className="w-12 h-1 bg-ink-200 rounded-full mx-auto mb-4" />
            <h3 className="font-serif font-bold text-ink-900 text-lg mb-2">練習を記録しました</h3>
            <p className="text-sm text-ink-500 mb-5">この演奏をコミュニティに共有しますか？</p>
            <div className="space-y-3">
              {hasAudio ? (
                <button
                  onClick={() => { setShowPostPrompt(false); navigate('createPost'); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  <Share2 size={18} /> この演奏を投稿する
                </button>
              ) : (
                <p className="text-xs text-ink-400 text-center">音声を録音・アップロードすると演奏を投稿できます</p>
              )}
              <button
                onClick={() => { setShowPostPrompt(false); navigate('practice'); }}
                className="w-full py-3.5 bg-ink-100 text-ink-700 rounded-xl font-medium hover:bg-ink-200 transition-colors"
              >
                記録のみ保存する
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
