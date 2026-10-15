import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import type { SelectablePiece, PracticeRow } from '../lib/practiceApi';
import {
  apiFetch, getAllPractices, getOwnedPieces, loadCatalog, resolvePiece,
  toSelectablePiece, todayLocal,
} from '../lib/practiceApi';
import PiecePicker from '../components/PiecePicker';
import PracticeAudioPicker from '../components/PracticeAudioPicker';
import { ArrowLeft, Clock } from 'lucide-react';

type Props = {
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
  editId?: string;
};

export default function CreatePractice({ navigate, editId }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [date, setDate] = useState(todayLocal);
  const [piece, setPiece] = useState<SelectablePiece | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [comment, setComment] = useState('');
  const [audioMediaId, setAudioMediaId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<SelectablePiece[]>([]);
  const [owned, setOwned] = useState<SelectablePiece[]>([]);
  const [past, setPast] = useState<SelectablePiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [catalogRows, ownedRows, practiceRows] = await Promise.all([
          loadCatalog(),
          getOwnedPieces(getToken),
          getAllPractices(getToken),
        ]);
        const masterById = new Map(catalogRows.map(p => [p.id, p]));
        const recent = new Map<string, SelectablePiece>();
        practiceRows.forEach(r => {
          const key = `${r.user_piece_id ? 'user' : 'master'}:${r.user_piece_id ?? r.piece_id}`;
          if (!recent.has(key)) recent.set(key, toSelectablePiece(r));
        });
        if (!active) {
          return;
        }
        setCatalog(catalogRows);
        setPast([...recent.values()]);
        const masterOwned = practiceRows
          .filter((record) => record.piece_id)
          .map(
            (record) =>
              masterById.get(record.piece_id!) ?? toSelectablePiece(record),
          );
        const ownedMap = new Map(
          [...ownedRows, ...masterOwned].map((item) => [
            `${item.source}:${item.id}`,
            item,
          ]),
        );
        setOwned([...ownedMap.values()]);
        if (editId) {
          const res = await apiFetch(`/practices/${encodeURIComponent(editId)}`, getToken);
          const data = await res.json() as { practice: PracticeRow };
          if (!active) {
            return;
          }
          setDate(data.practice.practice_date);
          setMinutes(data.practice.duration_minutes);
          setComment(data.practice.comment);
          setAudioMediaId(data.practice.audio_media_id ?? null);
          setPiece(toSelectablePiece(data.practice));
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'データの取得に失敗しました。');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken, editId]);

  async function save() {
    if (!piece || !isSignedIn || saving || loading || audioBusy) {
      return;
    }
    if (
      !date ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 1440 ||
      comment.length > 2000
    ) {
      setError('日付、練習時間（1〜1440分）、メモ（2000文字以内）を確認してください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reference = await resolvePiece(piece, getToken);
      const res = await apiFetch(editId ? `/practices/${encodeURIComponent(editId)}` : '/practices',
        getToken,
        {
          method: editId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            practiceDate: date,
            ...reference,
            durationMinutes: minutes,
            comment,
            audioMediaId,
          }),
        });
      const data = await res.json() as { practice: PracticeRow };
      navigate('practiceDetail', { id: data.practice.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => editId ? navigate('practiceDetail', { id: editId }) : navigate('practice')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 戻る
      </button>
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-6">{editId ? '練習記録を編集' : '練習を記録'}</h1>
      <div className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5">
        {loading && <p className="text-ink-500 text-sm">読み込み中...</p>}
        {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
        <div>
          <label htmlFor="practice-date"
            className="block text-sm font-medium text-ink-700 mb-2">練習日</label>
          <input id="practice-date" type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm" />
        </div>
        <PiecePicker
          pieces={catalog}
          ownedPieces={owned}
          selectedPiece={piece}
          onSelect={value => setPiece(value as SelectablePiece | null)}
          recentPieces={past}
          label="練習した曲"
        />
        <div>
          <label htmlFor="practice-minutes"
            className="block text-sm font-medium text-ink-700 mb-2">練習時間（分）</label>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-ink-400" />
            <input id="practice-minutes" type="number" min={1} max={1440} step={1}
              value={minutes} onChange={e => setMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="practice-comment"
            className="block text-sm font-medium text-ink-700 mb-2">メモ</label>
          <textarea id="practice-comment" maxLength={2000} rows={4} value={comment}
            onChange={e => setComment(e.target.value)} placeholder="練習内容や気づきを記録"
            className="w-full px-4 py-3 bg-ink-50 border border-ink-200 rounded-xl text-sm" />
        </div>
        {isSignedIn && (
          <PracticeAudioPicker
            getToken={getToken}
            value={audioMediaId}
            onChange={setAudioMediaId}
            onBusyChange={setAudioBusy}
            disabled={saving || loading}
          />
        )}
        <button onClick={() => void save()} disabled={loading || saving || audioBusy || !piece || !isSignedIn}
          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-medium disabled:opacity-40">
          {saving ? '保存中...' : editId ? '変更を保存' : '記録する'}
        </button>
      </div>
    </div>
  );
}
