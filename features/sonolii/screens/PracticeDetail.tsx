import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { apiFetch } from '../lib/practiceApi';
import type { PracticeRow } from '../lib/practiceApi';
import { ArrowLeft, Clock, Music2, Pencil, Trash2 } from 'lucide-react';

type Props = {
  recordId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
};

export default function PracticeDetail({ recordId, navigate }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [record, setRecord] = useState<PracticeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setRecord(null); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const res = await apiFetch(`/practices/${encodeURIComponent(recordId)}`, getToken);
        const data = await res.json() as { practice: PracticeRow };
        if (active) setRecord(data.practice);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : '練習記録を取得できませんでした。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [recordId, isLoaded, isSignedIn, getToken]);

  async function remove() {
    if (!record || deleting || !window.confirm('この練習記録を削除しますか？')) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/practices/${encodeURIComponent(record.id)}`, getToken, { method: 'DELETE' });
      navigate('practice');
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除できませんでした。');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('practice')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 練習一覧
      </button>
      {loading && <p className="text-sm text-ink-500">読み込み中...</p>}
      {error && <p role="alert" className="text-red-600 text-sm mb-3">{error}</p>}
      {!loading && !record && !error && <p className="text-ink-500">練習記録がありません。</p>}
      {record && (
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h1 className="font-serif text-2xl font-bold text-ink-900">{record.practice_date}</h1>
            <span className="flex items-center gap-1 text-teal-700 font-medium">
              <Clock size={16} /> {record.duration_minutes} 分
            </span>
          </div>
          <div className="bg-ink-50 rounded-xl p-4">
            <p className="font-medium text-ink-900 flex gap-2 items-center">
              <Music2 size={18} className="text-teal-600" />
              <span><span className="italic text-ink-500">{record.composer_name}</span> / {record.piece_title}</span>
            </p>
            {record.comment && <p className="text-sm text-ink-600 mt-3 whitespace-pre-wrap">{record.comment}</p>}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => navigate('createPractice', { id: record.id })}
              className="flex-1 flex items-center justify-center gap-2 border border-ink-200 rounded-xl py-3 text-sm font-medium">
              <Pencil size={16} /> 編集
            </button>
            <button disabled={deleting} onClick={() => void remove()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-red-600 border border-red-200 disabled:opacity-50">
              <Trash2 size={16} /> {deleting ? '削除中...' : '削除'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
