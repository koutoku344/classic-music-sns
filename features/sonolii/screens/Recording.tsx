import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { uploadAudio } from '../lib/mediaApi';
import { withWebmDuration } from '../lib/webmDuration';
import { ArrowLeft, Mic, Circle, Check, X, RotateCcw, Calendar } from 'lucide-react';

interface RecordingProps {
  navigate: (screen: ScreenName, params?: Record<string, string>) => void;
}

type Phase = 'idle' | 'recording' | 'recorded';
const MAX_SECONDS = 30 * 60;
const MAX_BYTES = 200_000_000;

function durationString(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function Recording({ navigate }: RecordingProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [recordSec, setRecordSec] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  function releaseCapture() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      // Prevent the recorder from updating unmounted React state.
      if (recorder) {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }
      releaseCapture();
    };
  }, []);

  useEffect(() => {
    if (!audioFile) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  function clearRecording() {
    setAudioFile(null);
    setRecordSec(0);
    setPhase('idle');
    setError('');
  }

  async function startRecording() {
    if (saving || phase === 'recording') return;
    setError('');
    if (!isLoaded || !isSignedIn) {
      setError('録音するにはログインしてください。');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('このブラウザでは録音を利用できません。Chromeなどの対応ブラウザを使用してください。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(candidate => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const baseMime = recorder.mimeType.split(';')[0];
      if (baseMime !== 'audio/webm' && baseMime !== 'audio/mp4') {
        releaseCapture();
        setError('このブラウザの録音形式には対応していません。');
        return;
      }
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        releaseCapture();
        if (mountedRef.current) {
          setPhase('idle');
          setError('録音中にエラーが発生しました。録り直してください。');
        }
      };
      recorder.onstop = () => {
        releaseCapture();
        if (!mountedRef.current) return;
        const duration = Math.min(MAX_SECONDS, Math.max(1, Math.round(
          (Date.now() - startedRef.current) / 1000
        )));
        const blob = new Blob(chunksRef.current, { type: baseMime });
        chunksRef.current = [];
        setRecordSec(duration);
        if (blob.size === 0 || blob.size > MAX_BYTES) {
          setPhase('idle');
          setError('録音データが空、または200MBを超えています。');
          return;
        }
        const ext = baseMime === 'audio/mp4' ? 'm4a' : 'webm';
        const original = new File([blob], `recording-${Date.now()}.${ext}`, {
          type: baseMime,
        });
        void (async () => {
          const repaired = await withWebmDuration(original, duration * 1000);
          if (!mountedRef.current) return;
          setAudioFile(repaired);
          setPhase('recorded');
        })();
      };
      setAudioFile(null);
      setRecordSec(0);
      setPhase('recording');
      startedRef.current = Date.now();
      recorder.start(1000);
      intervalRef.current = setInterval(() => {
        setRecordSec(Math.min(MAX_SECONDS, Math.floor(
          (Date.now() - startedRef.current) / 1000
        )));
      }, 1000);
      timeoutRef.current = setTimeout(stopRecording, MAX_SECONDS * 1000);
    } catch {
      releaseCapture();
      setPhase('idle');
      setError('マイクにアクセスできません。ブラウザのマイク権限を確認してください。');
    }
  }

  async function confirmRecording() {
    if (!audioFile || saving || savedId) return;
    setSaving(true);
    setError('');
    try {
      const id = await uploadAudio(audioFile, getToken);
      if (mountedRef.current) {
        setSavedId(id);
        setAudioFile(null);
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : '音声の保存に失敗しました。');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button type="button" disabled={phase === 'recording' || saving}
        onClick={() => navigate('community')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium disabled:opacity-40">
        <ArrowLeft size={18} /> 戻る
      </button>

      <h1 className="sr-only">録音</h1>

      {!savedId && <div className="bg-white rounded-2xl border border-ink-100 p-6 sm:p-8 animate-slide-up">
        {error && <p role="alert" className="text-sm text-red-600 mb-5">{error}</p>}
        {phase === 'idle' && (
          <div className="text-center py-8">
            <button type="button" onClick={() => void startRecording()}
              disabled={!isLoaded || !isSignedIn || saving}
              className="border-2 border-dashed border-burgundy-300 bg-burgundy-50/30 rounded-2xl p-10 text-center hover:border-burgundy-400 hover:bg-burgundy-50/50 transition-colors w-full max-w-sm disabled:opacity-40">
              <Mic size={40} className="mx-auto text-burgundy-500 mb-3" />
              <p className="text-base text-ink-800 font-medium">今から録音する</p>
              <p className="text-xs text-ink-400 mt-1">マイクに向かって演奏（最大30分）</p>
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Circle size={14} className="text-burgundy-500 fill-burgundy-500 animate-pulse-soft" />
              <p className="text-sm text-burgundy-700 font-medium">録音中...</p>
            </div>
            <p className="text-5xl font-mono font-bold text-burgundy-700 mb-8 tabular-nums">
              {durationString(recordSec)}
            </p>
            <button type="button" onClick={stopRecording}
              className="inline-flex items-center gap-2 px-6 py-3 bg-burgundy-500 text-white rounded-xl text-sm font-medium hover:bg-burgundy-600 transition-colors shadow-sm">
              <span className="w-3.5 h-3.5 bg-white rounded-sm" /> 停止
            </button>
          </div>
        )}

        {phase === 'recorded' && !savedId && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-ink-500 mb-1">プレビュー</p>
              <p className="text-xs text-ink-400">録音時間 {durationString(recordSec)}
                {audioFile && ` ・ ${(audioFile.size / 1_000_000).toFixed(1)}MB`}
              </p>
            </div>
            {previewUrl && <audio controls preload="metadata" src={previewUrl} className="w-full" />}
            <p className="text-xs text-ink-400">
              WebMでは標準プレイヤーの時間が0:00になることがあります。上の録音時間が実測値です。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" disabled={saving} onClick={() => void startRecording()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 disabled:opacity-40">
                <RotateCcw size={16} /> 録り直す
              </button>
              <button type="button" disabled={saving} onClick={clearRecording}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-ink-50 disabled:opacity-40">
                <X size={16} /> クリア
              </button>
              <button type="button" disabled={saving || !audioFile}
                onClick={() => void confirmRecording()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 disabled:opacity-40">
                <Check size={16} /> {saving ? 'R2に保存中...' : '確定して保存'}
              </button>
            </div>
          </div>
        )}
      </div>}

      {savedId && (
        <div role="status" className="mt-5 bg-white rounded-2xl border border-ink-100 p-6 space-y-4">
          <h2 className="font-serif font-bold text-ink-900 text-lg">録音を保存しました</h2>
          <p className="text-sm text-ink-500">
            音声は非公開でR2に保存されています。練習記録を作る場合はこの音声が自動選択されます。
          </p>
          <button type="button"
            onClick={() => navigate('createPractice', { audioMediaId: savedId })}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium">
            <Calendar size={18} /> 練習として記録する
          </button>
          <button type="button"
            onClick={() => navigate('createPost', { audioMediaId: savedId })}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-teal-300 text-teal-700 text-sm font-medium">
            <Mic size={18} /> 演奏として投稿する
          </button>
          <button type="button" onClick={() => navigate('practice')}
            className="w-full py-3 rounded-xl border border-ink-200 text-sm text-ink-700">
            保存して終了
          </button>
        </div>
      )}
    </div>
  );
}
