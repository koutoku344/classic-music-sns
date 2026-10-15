import { useEffect, useRef, useState } from 'react';
import { Mic, Upload, Library, StopCircle, RotateCcw, X } from 'lucide-react';
import { audioReadUrl, listPastAudio, uploadAudio } from '../lib/mediaApi';
import type { MediaRow, TokenGetter } from '../lib/mediaApi';

type Props = {
  getToken: TokenGetter;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

const MAX_SECONDS = 30 * 60;

export default function PracticeAudioPicker({ getToken, value, onChange, disabled = false, onBusyChange }: Props) {
  const [mode, setMode] = useState<'record' | 'file' | 'past'>('record');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recorded, setRecorded] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [recordPreview, setRecordPreview] = useState('');
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [past, setPast] = useState<MediaRow[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedParts = useRef<Blob[]>([]);
  const recordStartedRef = useRef(0);
  const playbackUrlRef = useRef('');
  const getTokenRef = useRef(getToken);
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  getTokenRef.current = getToken;

  useEffect(() => {
    onBusyChangeRef.current?.(recording || uploading);
  }, [recording, uploading]);

  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  function endCapture() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null;
    stopTimeoutRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  function clearPreview() {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = '';
    setPreview('');
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      endCapture();
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recorded) { setRecordPreview(''); return; }
    const url = URL.createObjectURL(recorded);
    setRecordPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [recorded]);

  useEffect(() => {
    let active = true;
    if (!value) {
      clearPreview();
      return () => { active = false; };
    }
    clearPreview();
    (async () => {
      try {
        const url = await audioReadUrl(value, getTokenRef.current);
        if (active) setPreview(url);
      } catch {
        if (active) setError('選択した音声のプレビューを取得できません。');
      }
    })();
    return () => { active = false; };
  }, [value]);

  function clearRecording() {
    setRecorded(null);
    setRecordedSeconds(0);
    setSeconds(0);
    setError('');
  }

  async function startRecording() {
    setError('');
    setRecorded(null);
    setRecordedSeconds(0);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('このブラウザでは録音できません。Chrome等の対応ブラウザでお試しください。');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const type = types.find(t => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      recorderRef.current = recorder;
      recordedParts.current = [];
      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordedParts.current.push(e.data);
      };
      recorder.onstop = () => {
        setRecordedSeconds(Math.max(1, Math.round((Date.now() - recordStartedRef.current) / 1000)));
        endCapture();
        setRecording(false);
        const mime = recorder.mimeType.split(';')[0];
        const ext = mime === 'audio/mp4' ? 'm4a' : 'webm';
        const blob = new Blob(recordedParts.current, { type: mime });
        recordedParts.current = [];
        if (blob.size < 1 || blob.size > 200_000_000) {
          setError('録音データが空、または200MBを超えています。');
          return;
        }
        setRecorded(new File([blob], `recording-${Date.now()}.${ext}`, { type: mime }));
      };
      recorder.onerror = () => {
        setError('録音中にエラーが発生しました。再度お試しください。');
        endCapture();
        setRecording(false);
      };
      recorder.start(1000);
      recordStartedRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds(Math.min(MAX_SECONDS, Math.floor((Date.now() - recordStartedRef.current) / 1000)));
      }, 1000);
      stopTimeoutRef.current = setTimeout(stop, MAX_SECONDS * 1000);
    } catch {
      endCapture();
      setRecording(false);
      setError('マイクの利用を許可してください。録音はHTTPS環境で利用できます。');
    }
  }

  async function saveFile(file: File) {
    if (uploading || disabled) return;
    setUploading(true);
    setError('');
    try {
      const id = await uploadAudio(file, getToken);
      onChange(id);
      setRecorded(null);
      setPast([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました。');
    } finally {
      setUploading(false);
    }
  }

  async function loadPast() {
    setMode('past');
    setLoadingPast(true);
    setError('');
    try {
      setPast(await listPastAudio(getToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : '過去の録音を取得できませんでした。');
    } finally {
      setLoadingPast(false);
    }
  }

  const minutes = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <section className="border border-ink-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-800">音声（任意・最大1件）</h2>
        {value && (
          <button type="button" disabled={disabled || uploading}
            onClick={() => { onChange(null); setError(''); }}
            className="text-xs text-red-600 disabled:opacity-50">紐づけを解除</button>
        )}
      </div>
      <p className="text-xs text-ink-500">音声は非公開で保存されます。練習記録から外しても音声自体は残ります。</p>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" onClick={() => setMode('record')} disabled={disabled || uploading || recording}
          className={`px-2 py-2 rounded-lg text-xs flex flex-col items-center gap-1 border ${mode === 'record' ? 'border-teal-500 bg-teal-50' : 'border-ink-200'}`}>
          <Mic size={16} /> 録音
        </button>
        <button type="button" onClick={() => setMode('file')} disabled={disabled || uploading || recording}
          className={`px-2 py-2 rounded-lg text-xs flex flex-col items-center gap-1 border ${mode === 'file' ? 'border-teal-500 bg-teal-50' : 'border-ink-200'}`}>
          <Upload size={16} /> ファイル
        </button>
        <button type="button" onClick={() => void loadPast()} disabled={disabled || uploading || recording}
          className={`px-2 py-2 rounded-lg text-xs flex flex-col items-center gap-1 border ${mode === 'past' ? 'border-teal-500 bg-teal-50' : 'border-ink-200'}`}>
          <Library size={16} /> 過去の音声
        </button>
      </div>
      {mode === 'record' && (
        <div className="space-y-2">
          <p className="text-xs text-ink-500">録音は30分で自動停止します。</p>
          {recording ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-red-700">● {minutes}</span>
              <button type="button" onClick={stop} className="text-sm text-red-700 flex items-center gap-1"><StopCircle size={16}/>停止</button>
            </div>
          ) : !recorded && (
            <button type="button" onClick={() => void startRecording()} disabled={disabled || uploading}
              className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50">録音を開始</button>
          )}
          {recorded && !recording && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink-700">録音完了・プレビュー</p>
              <p className="text-xs text-ink-500">
                録音時間 {Math.floor(recordedSeconds / 60)}:{String(recordedSeconds % 60).padStart(2, '0')}
                {' ・ '}{(recorded.size / 1_000_000).toFixed(1)}MB
              </p>
              {recordPreview && <audio controls preload="metadata" src={recordPreview} className="w-full" />}
              <p className="text-xs text-ink-500">WebM形式では、Chromeの標準プレイヤーが再生時間を0:00と表示する場合があります。上記の録音時間が実測値です。</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={uploading || disabled}
                  onClick={() => void startRecording()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ink-200 text-sm disabled:opacity-50">
                  <RotateCcw size={16} /> 録り直す
                </button>
                <button type="button" disabled={uploading || disabled} onClick={clearRecording}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ink-200 text-sm disabled:opacity-50">
                  <X size={16} /> クリア
                </button>
                <button type="button" disabled={uploading || disabled} onClick={() => void saveFile(recorded)}
                  className="px-3 py-2 text-sm rounded-lg bg-teal-600 text-white disabled:opacity-50">
                  {uploading ? '保存中...' : 'この音声を保存して選択'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {mode === 'file' && (
        <div className="space-y-2">
          <p className="text-xs text-ink-500">MP3・M4A・WAV・WebM / 200MB以下</p>
          <input type="file" accept=".mp3,.m4a,.wav,.webm" disabled={uploading || disabled}
            onChange={e => { const f = e.target.files?.[0]; if (f) void saveFile(f); e.target.value = ''; }}
            className="block w-full text-sm" />
        </div>
      )}
      {mode === 'past' && (
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {loadingPast && <p className="text-xs text-ink-500">読み込み中...</p>}
          {!loadingPast && past.length === 0 && <p className="text-xs text-ink-500">保存済み音声がありません。</p>}
          {past.map(item => (
            <button type="button" key={item.id} disabled={disabled || uploading}
              onClick={() => { onChange(item.id); setError(''); }}
              className={`w-full text-left p-2 rounded-lg text-xs border ${value === item.id ? 'border-teal-500 bg-teal-50' : 'border-ink-200'}`}>
              {new Date(item.created_at).toLocaleString('ja-JP')} ・ {(item.size_bytes / 1_000_000).toFixed(1)}MB
            </button>
          ))}
        </div>
      )}
      {uploading && <p role="status" className="text-sm text-ink-600">R2にアップロードしています。画面を閉じずにお待ちください。</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {value && <div className="space-y-2">
        <p className="text-xs text-teal-700">音声を選択中（練習記録の保存で紐づけ確定）</p>
        {preview && <audio controls src={preview} className="w-full" />}
      </div>}
    </section>
  );
}
