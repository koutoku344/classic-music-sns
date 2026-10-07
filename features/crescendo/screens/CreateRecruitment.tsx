import { useState, useRef, useEffect } from 'react';
import type { ScreenName, Piece } from '../types';
import { pieces, recentPieceIds } from '../data';
import PiecePicker from '../components/PiecePicker';
import AudioPreview from '../components/AudioPreview';
import { ArrowLeft, Check, X, Mic, Circle, RotateCcw } from 'lucide-react';

interface CreateRecruitmentProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

const inputCls = "w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400";
const recentPieces = pieces.filter((p) => recentPieceIds.includes(p.id));

const allInstruments = ['Piano', 'Violin', 'Cello', 'Viola', 'Flute', 'Clarinet', 'Oboe', 'Trumpet', 'Guitar', 'その他'];
const allRegions = ['東京', '大阪', '神奈川', '京都', '愛知', '兵庫', '福岡', 'オンライン'];

type AudioPhase = 'none' | 'recording' | 'preview';

export default function CreateRecruitment({ navigate }: CreateRecruitmentProps) {
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [audioPhase, setAudioPhase] = useState<AudioPhase>('none');
  const [recordSec, setRecordSec] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const toggleInstrument = (inst: string) => {
    setSelectedInstruments(prev => prev.includes(inst) ? prev.filter(i => i !== inst) : [...prev, inst]);
  };
  const toggleRegion = (region: string) => {
    setSelectedRegions(prev => prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]);
  };

  const durationStr = `${Math.floor(recordSec / 60)}:${(recordSec % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (!isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const handleStartRecord = () => {
    setRecordSec(0);
    setIsRecording(true);
  };

  const handleStopRecord = () => {
    setIsRecording(false);
    setAudioPhase('preview');
  };

  const handleClearAudio = () => {
    setAudioPhase('none');
    setRecordSec(0);
    setIsRecording(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">アンサンブル募集を作成</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
        <PiecePicker
          pieces={pieces}
          selectedPiece={selectedPiece}
          onSelect={setSelectedPiece}
          label="演奏曲目"
          recentPieces={recentPieces}
        />

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">募集楽器（複数選択可）</label>
          <div className="flex flex-wrap gap-2">
            {allInstruments.map((inst) => (
              <button
                key={inst}
                onClick={() => toggleInstrument(inst)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                  selectedInstruments.includes(inst)
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">地域（複数選択可）</label>
          <div className="flex flex-wrap gap-2">
            {allRegions.map((region) => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${
                  selectedRegions.includes(region)
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">レベル</label>
            <select className={inputCls}>
              <option>初級</option><option>中級</option><option>上級</option><option>問わない</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">目的</label>
            <select className={inputCls}>
              <option>アンサンブル</option><option>発表会</option><option>趣味で合わせ</option><option>その他</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1.5">募集内容</label>
          <textarea
            placeholder="練習の頻度、合わせの日程、歓迎する条件などを書きましょう"
            className={`${inputCls} resize-none`}
            rows={5}
          />
        </div>

        {/* Audio recording (optional demo recording) */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">演奏録音（任意）</label>
          {audioPhase === 'none' && (
            <button
              onClick={() => setAudioPhase('recording')}
              className="w-full border-2 border-dashed border-ink-200 rounded-xl p-4 text-center hover:border-burgundy-400 hover:bg-burgundy-50/30 transition-colors"
            >
              <Mic size={24} className="mx-auto text-ink-400 mb-1.5" />
              <p className="text-sm text-ink-700 font-medium">今から録音する</p>
              <p className="text-xs text-ink-400 mt-0.5">参考演奏を録音して募集に添える</p>
            </button>
          )}

          {audioPhase === 'recording' && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-burgundy-300 bg-burgundy-50/30 rounded-xl p-6 text-center">
                {isRecording ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Circle size={12} className="text-burgundy-500 fill-burgundy-500 animate-pulse-soft" />
                      <p className="text-sm text-burgundy-700 font-medium">録音中...</p>
                    </div>
                    <p className="text-3xl font-mono font-bold text-burgundy-700 mb-3 tabular-nums">{durationStr}</p>
                    <button
                      onClick={handleStopRecord}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-burgundy-500 text-white rounded-lg text-sm font-medium hover:bg-burgundy-600"
                    >
                      停止
                    </button>
                  </>
                ) : (
                  <>
                    <Mic size={28} className="mx-auto text-burgundy-500 mb-2" />
                    <p className="text-sm text-ink-700 font-medium mb-1">録音の準備ができました</p>
                    <p className="text-xs text-ink-400 mb-3">マイクに向かって演奏を始めてください</p>
                    <button
                      onClick={handleStartRecord}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-burgundy-500 text-white rounded-lg text-sm font-medium hover:bg-burgundy-600"
                    >
                      <Circle size={14} className="fill-white" /> 録音開始
                    </button>
                  </>
                )}
              </div>
              {!isRecording && (
                <button onClick={() => setAudioPhase('none')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-burgundy-500 font-medium">
                  <X size={16} /> クリア
                </button>
              )}
            </div>
          )}

          {audioPhase === 'preview' && (
            <div className="space-y-3">
              <div className="text-center">
                <p className="text-sm text-ink-500 mb-1">プレビュー</p>
                <p className="text-xs text-ink-400">録音時間 {durationStr}</p>
              </div>
              <AudioPreview durationSec={recordSec} label="録音した音声" />
              <div className="flex items-center gap-3">
                <button onClick={handleStartRecord} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-ink-200 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-50">
                  <RotateCcw size={16} /> 録り直す
                </button>
                <button onClick={handleClearAudio} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-burgundy-500 font-medium">
                  <X size={16} /> クリア
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('community')}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          募集を投稿する
        </button>
      </div>
    </div>
  );
}
