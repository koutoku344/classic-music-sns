import { useState, useRef, useEffect } from 'react';
import type { ScreenName } from '../types';
import AudioPreview from '../components/AudioPreview';
import { ArrowLeft, Mic, Circle, Check, X, RotateCcw, Share2, Calendar } from 'lucide-react';

interface RecordingProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

type Phase = 'idle' | 'recording' | 'recorded';

export default function Recording({ navigate }: RecordingProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [recordSec, setRecordSec] = useState(0);
  const [showChoice, setShowChoice] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const durationStr = `${Math.floor(recordSec / 60)}:${(recordSec % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    if (phase !== 'recording') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = window.setInterval(() => setRecordSec((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const handleStartRecord = () => {
    setRecordSec(0);
    setPhase('recording');
  };

  const handleStopRecord = () => {
    setPhase('recorded');
  };

  const handleClear = () => {
    setPhase('idle');
    setRecordSec(0);
  };

  const handleConfirm = () => {
    setShowChoice(true);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">録音</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-6 sm:p-8 animate-slide-up">
        {phase === 'idle' && (
          <div className="text-center py-8">
            <button
              onClick={handleStartRecord}
              className="border-2 border-dashed border-burgundy-300 bg-burgundy-50/30 rounded-2xl p-10 text-center hover:border-burgundy-400 hover:bg-burgundy-50/50 transition-colors w-full max-w-sm"
            >
              <Mic size={40} className="mx-auto text-burgundy-500 mb-3" />
              <p className="text-base text-ink-800 font-medium">今から録音する</p>
              <p className="text-xs text-ink-400 mt-1">マイクに向かって演奏</p>
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Circle size={14} className="text-burgundy-500 fill-burgundy-500 animate-pulse-soft" />
              <p className="text-sm text-burgundy-700 font-medium">録音中...</p>
            </div>
            <p className="text-5xl font-mono font-bold text-burgundy-700 mb-8 tabular-nums">{durationStr}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleStopRecord}
                className="inline-flex items-center gap-2 px-6 py-3 bg-burgundy-500 text-white rounded-xl text-sm font-medium hover:bg-burgundy-600 transition-colors shadow-sm"
              >
                <span className="w-3.5 h-3.5 bg-white rounded-sm" /> 停止
              </button>
            </div>
          </div>
        )}

        {phase === 'recorded' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-ink-500 mb-1">プレビュー</p>
              <p className="text-xs text-ink-400">録音時間 {durationStr}</p>
            </div>

            <AudioPreview durationSec={recordSec} label="録音した音声" />

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleStartRecord}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 transition-colors"
              >
                <RotateCcw size={16} /> 録り直す
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 transition-colors"
              >
                <X size={16} /> クリア
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Check size={16} /> 確定
              </button>
            </div>
          </div>
        )}
      </div>

      {showChoice && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-900/40 animate-fade-in" onClick={() => setShowChoice(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up p-6">
            <div className="w-12 h-1 bg-ink-200 rounded-full mx-auto mb-4" />
            <h3 className="font-serif font-bold text-ink-900 text-lg mb-1">録音を確定しました</h3>
            <p className="text-sm text-ink-500 mb-5">この録音をどうしますか？</p>
            <div className="divide-y divide-ink-100">
              <button
                onClick={() => { setShowChoice(false); navigate('createPost', { fromRecording: 'true' }); }}
                className="w-full flex items-center gap-3 py-3.5 text-sm text-ink-700 hover:bg-teal-50 transition-colors -mx-2 px-2 rounded-lg"
              >
                <Share2 size={18} className="text-teal-600" /> 演奏を投稿する
              </button>
              <button
                onClick={() => { setShowChoice(false); navigate('createPractice', { fromRecording: 'true' }); }}
                className="w-full flex items-center gap-3 py-3.5 text-sm text-ink-700 hover:bg-teal-50 transition-colors -mx-2 px-2 rounded-lg"
              >
                <Calendar size={18} className="text-teal-600" /> 練習として記録する
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
