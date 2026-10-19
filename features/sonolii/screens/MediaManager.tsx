import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import {
  listMedia, listDeletedMedia, getMediaUsage, trashMedia, restoreMedia,
  permanentlyDeleteMedia, audioReadUrl, formatMediaBytes, backfillMissingAudioDurations,
} from '../lib/mediaApi';
import type { MediaRow, DeletedMediaRow, MediaUsage } from '../lib/mediaApi';
import type { ScreenName } from '../types';
import { ArrowLeft, HardDrive, Trash2, RotateCcw, Music2, Image as ImageIcon } from 'lucide-react';

type Props = { navigate: (screen: ScreenName) => void };
type View = 'saved' | 'trash';
const PAGE_SIZE = 30;

export default function MediaManager({ navigate }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [view, setView] = useState<View>('saved');
  const [saved, setSaved] = useState<MediaRow[]>([]);
  const [deleted, setDeleted] = useState<DeletedMediaRow[]>([]);
  const [usage, setUsage] = useState<MediaUsage | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [readUrl, setReadUrl] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState('');

  const refresh = useCallback(async (pageToLoad: number, showDeleted: boolean) => {
    if (!isSignedIn) {
      setSaved([]);
      setDeleted([]);
      setUsage(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [quota, media] = await Promise.all([
        getMediaUsage(getToken),
        showDeleted ? listDeletedMedia(getToken) : listMedia(getToken, pageToLoad * PAGE_SIZE, PAGE_SIZE),
      ]);
      setUsage(quota);
      if (showDeleted) {
        setDeleted(media as DeletedMediaRow[]);
      } else {
        setSaved(media as MediaRow[]);
        setHasMore(media.length === PAGE_SIZE);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'メディア一覧を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh(page, view === 'trash');
  }, [isLoaded, page, view, refresh]);

  async function fillDurations() {
    if (backfilling) return;
    setBackfilling(true);
    setError('');
    setBackfillStatus('音声の再生時間を確認しています...');
    try {
      const result = await backfillMissingAudioDurations(getToken, (done, total) => {
        setBackfillStatus(`再生時間を確認中：${done}/${total} 件`);
      });
      setBackfillStatus(
        `補完完了：${result.updated}件更新、${result.failed}件失敗（対象${result.total}件）`
      );
      await refresh(page, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '再生時間を補完できませんでした。');
    } finally {
      setBackfilling(false);
    }
  }

  const used = usage
    ? usage.active_bytes + usage.deleted_bytes + usage.pending_bytes
    : 0;
  const pct = usage && usage.limit_bytes > 0
    ? Math.min(100, used / usage.limit_bytes * 100)
    : 0;

  async function act(id: string, action: 'trash' | 'restore' | 'permanent') {
    const label = action === 'trash' ? 'ゴミ箱に移動' : action === 'restore' ? '復元' : '完全削除';
    const detail = action === 'permanent'
      ? 'このファイルをR2とNeonから完全削除します。元に戻せません。'
      : action === 'trash'
        ? 'ゴミ箱のファイルも容量を消費します。30日後に自動的に完全削除されます。'
        : 'このファイルを保存済みメディアに戻します。';
    if (!window.confirm(`${label}しますか？\n${detail}`)) return;
    setActing(id);
    setError('');
    try {
      if (action === 'trash') await trashMedia(id, getToken);
      if (action === 'restore') await restoreMedia(id, getToken);
      if (action === 'permanent') await permanentlyDeleteMedia(id, getToken);
      if (playingId === id) { setPlayingId(null); setReadUrl(''); }
      // Return to first page so an emptied last page is not left blank.
      setPage(0);
      await refresh(0, view === 'trash');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '処理に失敗しました。');
    } finally {
      setActing(null);
    }
  }

  async function preview(id: string) {
    if (playingId === id) {
      setPlayingId(null);
      setReadUrl('');
      return;
    }
    setPlayingId(id);
    setReadUrl('');
    setError('');
    try {
      const url = await audioReadUrl(id, getToken);
      setReadUrl(url);
    } catch (cause) {
      setPlayingId(null);
      setError(cause instanceof Error ? cause.message : '音声の取得に失敗しました。');
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <button type="button" onClick={() => navigate('settings')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 設定へ戻る
      </button>
      <h1 className="font-serif text-2xl font-bold text-ink-900 mb-5">メディア管理</h1>

      <section className="bg-white border border-ink-100 rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-ink-800 flex items-center gap-2">
            <HardDrive size={16} /> 保存容量
          </h2>
          <span className="text-xs text-ink-500">Free（3GB）</span>
        </div>
        {usage ? (
          <>
            <div className="h-2.5 bg-ink-100 rounded-full overflow-hidden my-3"
              role="progressbar" aria-label="保存容量使用率"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
              <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-ink-800">{formatMediaBytes(used)} / {formatMediaBytes(usage.limit_bytes)}</p>
            <p className="text-xs text-ink-500 mt-2">
              保存済み {formatMediaBytes(usage.active_bytes)} ・
              ゴミ箱 {formatMediaBytes(usage.deleted_bytes)} ・
              アップロード予約 {formatMediaBytes(usage.pending_bytes)}
            </p>
          </>
        ) : <p className="text-xs text-ink-500 mt-3">容量情報を取得しています。</p>}
        <p className="text-xs text-ink-500 mt-3">
          ゴミ箱の音声・画像も容量に含まれます。空き容量を増やすには完全削除が必要です。
        </p>
      </section>

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => { setView('saved'); setPage(0); setPlayingId(null); setReadUrl(''); }}
          className={`px-4 py-2 rounded-xl text-sm ${view === 'saved' ? 'bg-teal-600 text-white' : 'bg-white border border-ink-200'}`}>
          保存済み
        </button>
        <button type="button" onClick={() => { setView('trash'); setPage(0); setPlayingId(null); setReadUrl(''); }}
          className={`px-4 py-2 rounded-xl text-sm ${view === 'trash' ? 'bg-teal-600 text-white' : 'bg-white border border-ink-200'}`}>
          ゴミ箱
        </button>
      </div>

      {!isSignedIn && isLoaded && <p className="text-sm text-ink-500">利用するにはログインしてください。</p>}
      {view === 'saved' && isSignedIn && (
        <div className="mb-4 rounded-xl border border-ink-200 bg-white p-4">
          <p className="text-sm text-ink-700 mb-2">
            過去に保存した音声の再生時間が未登録の場合、音声ファイルは変更せず再生時間だけを補完できます。
          </p>
          <button
            type="button"
            disabled={backfilling || loading || acting !== null}
            onClick={() => void fillDurations()}
            className="text-sm px-4 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-50"
          >
            {backfilling ? '確認中...' : '未登録の音声時間を補完'}
          </button>
          {backfillStatus && <p role="status" className="text-xs text-ink-600 mt-2">{backfillStatus}</p>}
        </div>
      )}

      {loading && <p role="status" className="text-sm text-ink-500">読み込み中...</p>}
      {error && <p role="alert" className="text-sm text-red-600 mb-4">{error}</p>}
      {!loading && isSignedIn && (view === 'saved' ? saved : deleted).length === 0 &&
        <p className="bg-white border border-ink-100 p-5 rounded-xl text-sm text-ink-500">
          {view === 'saved' ? '保存済みメディアはありません。' : 'ゴミ箱は空です。'}
        </p>}

      <div className="space-y-3">
        {!loading && (view === 'saved' ? saved : deleted).map(row => {
          const isDeleted = view === 'trash';
          const trashRow = isDeleted ? row as DeletedMediaRow : null;
          return (
            <section key={row.id} className="bg-white rounded-xl border border-ink-100 p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 bg-ink-50 rounded-lg flex items-center justify-center">
                  {row.media_type === 'audio'
                    ? <Music2 size={19} className="text-teal-600" />
                    : <ImageIcon size={19} className="text-teal-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {row.media_type === 'audio' ? '音声' : '画像'}
                    <span className="text-xs text-ink-400 font-normal ml-2">{row.mime_type}</span>
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    {new Date(row.created_at).toLocaleString('ja-JP')} ・ {formatMediaBytes(row.size_bytes)}
                  </p>
                  {trashRow && <p className="text-xs text-ink-500 mt-1">
                    完全削除予定：{new Date(trashRow.purge_at).toLocaleString('ja-JP')}
                  </p>}
                </div>
              </div>

              {view === 'saved' && row.media_type === 'audio' && (
                <div className="mt-3">
                  <button type="button" disabled={acting !== null} onClick={() => void preview(row.id)}
                    className="text-sm text-teal-700 hover:underline">
                    {playingId === row.id ? 'プレビューを閉じる' : '音声をプレビュー'}
                  </button>
                  {playingId === row.id && (readUrl
                    ? <audio controls className="w-full mt-2" src={readUrl} />
                    : <p className="text-xs text-ink-500 mt-2">読み込み中...</p>)}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-3">
                {isDeleted ? (
                  <>
                    <button type="button" disabled={acting !== null}
                      onClick={() => void act(row.id, 'restore')}
                      className="text-xs px-3 py-2 rounded-lg border border-ink-200 text-teal-700 disabled:opacity-40 flex items-center gap-1">
                      <RotateCcw size={14} /> 復元
                    </button>
                    <button type="button" disabled={acting !== null}
                      onClick={() => void act(row.id, 'permanent')}
                      className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 disabled:opacity-40 flex items-center gap-1">
                      <Trash2 size={14} /> 完全削除
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={acting !== null}
                    onClick={() => void act(row.id, 'trash')}
                    className="text-xs px-3 py-2 rounded-lg border border-ink-200 text-red-600 disabled:opacity-40 flex items-center gap-1">
                    <Trash2 size={14} /> ゴミ箱へ移動
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {!loading && view === 'saved' && (page > 0 || hasMore) && (
        <div className="flex justify-between gap-3 mt-5">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="text-sm px-4 py-2 border rounded-lg disabled:opacity-40">前へ</button>
          <span className="text-xs text-ink-500 self-center">{page + 1} ページ</span>
          <button type="button" disabled={!hasMore} onClick={() => setPage(p => p + 1)}
            className="text-sm px-4 py-2 border rounded-lg disabled:opacity-40">次へ</button>
        </div>
      )}
      {view === 'trash' && <p className="text-xs text-ink-500 mt-4">ゴミ箱は新しいものから最大100件を表示します。</p>}
    </div>
  );
}
