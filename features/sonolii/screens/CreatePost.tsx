import { useState, useRef, useEffect } from 'react';
import type { ScreenName, Piece } from '../types';
import { pieces, recentPieceIds } from '../data';
import PiecePicker from '../components/PiecePicker';
import AudioPreview from '../components/AudioPreview';
import { ArrowLeft, Image as ImageIcon, Mic, FileAudio, X, Circle, Check, RotateCcw, Play, Pause } from 'lucide-react';

interface CreatePostProps {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

const recentPieces = pieces.filter((p) => recentPieceIds.includes(p.id));

type AudioPhase = 'none' | 'upload' | 'recording' | 'preview';

export default function CreatePost({ navigate }: CreatePostProps) {
  const [body, setBody] = useState('');
  const [prefs, setPrefs] = useState<string[]>([]);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [audioPhase, setAudioPhase] = useState<AudioPhase>('none');
  const [hasImage, setHasImage] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const allPrefs = ['感想歓迎', 'Advice歓迎', '厳しめAdvice歓迎'];

  const togglePref = (p: string) => {
    setPrefs(prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p]);
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

  const hasAudio = audioPhase === 'preview';

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

      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">演奏を投稿</h1>

      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5 animate-slide-up">
        {/* Body text */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">メッセージ</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="練習の感想や、フィードバックしてほしいことなどを書きましょう"
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            rows={3}
          />
        </div>

        {/* Image */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">画像（任意）</label>
          {hasImage ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src="https://images.pexels.com/photos/6647870/pexels-photo-6647870.jpeg?auto=compress&cs=tinysrgb&h=400&w=600" alt="" className="w-full h-40 object-cover" />
              <button onClick={() => setHasImage(false)} className="absolute top-2 right-2 w-8 h-8 bg-ink-900/60 text-white rounded-full flex items-center justify-center hover:bg-ink-900/80">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setHasImage(true)}
              className="w-full border-2 border-dashed border-ink-200 rounded-xl p-5 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
            >
              <ImageIcon size={24} className="mx-auto text-ink-400 mb-1" />
              <p className="text-xs text-ink-400">画像を追加</p>
            </button>
          )}
        </div>

        {/* Audio */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">音声（任意）</label>
          {audioPhase === 'none' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAudioPhase('upload')}
                className="border-2 border-dashed border-ink-200 rounded-xl p-4 text-center hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
              >
                <FileAudio size={24} className="mx-auto text-ink-400 mb-1.5" />
                <p className="text-sm text-ink-700 font-medium">ファイルを選択</p>
                <p className="text-xs text-ink-400 mt-0.5">MP3, WAV, M4A</p>
              </button>
              <button
                onClick={() => setAudioPhase('recording')}
                className="border-2 border-dashed border-ink-200 rounded-xl p-4 text-center hover:border-burgundy-400 hover:bg-burgundy-50/30 transition-colors"
              >
                <Mic size={24} className="mx-auto text-ink-400 mb-1.5" />
                <p className="text-sm text-ink-700 font-medium">今から録音する</p>
                <p className="text-xs text-ink-400 mt-0.5">マイクに向かって演奏</p>
              </button>
            </div>
          )}

          {audioPhase === 'upload' && (
            <div className="space-y-2">
              <div className="border-2 border-dashed border-teal-300 bg-teal-50/30 rounded-xl p-5 text-center">
                <FileAudio size={28} className="mx-auto text-teal-600 mb-2" />
                <p className="text-sm text-ink-700 font-medium">ファイルを選択</p>
                <p className="text-xs text-ink-400 mt-1">MP3, WAV, M4A (最大50MB)</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setRecordSec(45); setAudioPhase('preview'); }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                  <Check size={16} /> この音声を使用
                </button>
                <button onClick={() => setAudioPhase('none')} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-burgundy-500 font-medium">
                  <X size={16} /> クリア
                </button>
              </div>
            </div>
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
              <AudioPreview durationSec={recordSec || 45} label="録音した音声" />
              <div className="flex items-center gap-3">
                {recordSec > 0 && (
                  <button onClick={handleStartRecord} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-ink-200 text-ink-700 rounded-lg text-sm font-medium hover:bg-ink-50">
                    <RotateCcw size={16} /> 録り直す
                  </button>
                )}
                <button onClick={handleClearAudio} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-burgundy-500 font-medium">
                  <X size={16} /> クリア
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Piece selection - only show after audio is set */}
        {hasAudio && (
          <PiecePicker
            pieces={pieces}
            selectedPiece={selectedPiece}
            onSelect={setSelectedPiece}
            label="演奏した曲"
            recentPieces={recentPieces}
          />
        )}

        {/* Feedback prefs */}
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">フィードバック希望</label>
          <div className="flex flex-wrap gap-2">
            {allPrefs.map((p) => (
              <button
                key={p}
                onClick={() => togglePref(p)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  prefs.includes(p) ? 'bg-gold-100 text-gold-700 border-2 border-gold-300' : 'bg-white text-ink-600 border-2 border-ink-200 hover:border-ink-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Comments toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink-700">コメント受付</label>
          <button
            onClick={() => setCommentsEnabled(!commentsEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${commentsEnabled ? 'bg-teal-600' : 'bg-ink-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${commentsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button
          onClick={() => navigate('community')}
          disabled={!body && !hasImage && !hasAudio}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          投稿する
        </button>
      </div>
    </div>
  );
}
