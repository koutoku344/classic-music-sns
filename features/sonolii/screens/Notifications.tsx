import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Bell, Heart, MessageCircle, UserPlus, Check, RefreshCw } from 'lucide-react';
import {
  listNotifications, getUnreadNotificationCount, markNotificationRead,
  markAllNotificationsRead, type NotificationRow,
} from '../lib/notificationApi';

const labels: Record<string, string> = {
  post_like: 'あなたの投稿にいいねがありました',
  post_comment: 'あなたの投稿にコメントがありました',
  comment_reply: 'あなたのコメントに返信がありました',
  comment_like: 'あなたのコメントにいいねがありました',
  follow: 'フォローされました',
  follow_request: 'フォロー申請が届きました',
  follow_accepted: 'フォロー申請が承認されました',
};

function NoticeIcon({ type }: { type: string }) {
  if (type === 'post_like' || type === 'comment_like') return <Heart size={18} className="text-burgundy-500" />;
  if (type === 'post_comment' || type === 'comment_reply') return <MessageCircle size={18} className="text-teal-600" />;
  return <UserPlus size={18} className="text-ink-500" />;
}

export default function Notifications() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!isSignedIn) return;
    setLoading(true);
    setError('');
    try {
      const [page, unreadCount] = await Promise.all([
        listNotifications(getToken),
        getUnreadNotificationCount(getToken),
      ]);
      setItems(page.notifications);
      setCursor(page.nextCursor);
      setUnread(unreadCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知を取得できませんでした。');
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setItems([]);
      setCursor(null);
      setUnread(0);
      setLoading(false);
      return;
    }
    void reload();
  }, [isLoaded, isSignedIn, reload]);

  const markRead = async (item: NotificationRow) => {
    if (item.readAt || busyId || allBusy) return;
    setBusyId(item.id);
    setError('');
    try {
      await markNotificationRead(item.id, getToken);
      const at = new Date().toISOString();
      setItems(existing => existing.map(n => n.id === item.id ? { ...n, readAt: at } : n));
      setUnread(await getUnreadNotificationCount(getToken));
      window.dispatchEvent(new Event('sonolii:notification-read'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '既読にできませんでした。');
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    if (!unread || allBusy || busyId) return;
    if (!window.confirm('すべての未読通知を既読にしますか？')) return;
    setAllBusy(true);
    setError('');
    try {
      await markAllNotificationsRead(getToken);
      await reload();
      window.dispatchEvent(new Event('sonolii:notification-read'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '一括既読にできませんでした。');
    } finally {
      setAllBusy(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    setError('');
    try {
      const page = await listNotifications(getToken, cursor);
      setItems(existing => [...existing, ...page.notifications.filter(n => !existing.some(x => x.id === n.id))]);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加の通知を取得できませんでした。');
    } finally {
      setMoreBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">通知</h1>
          {isSignedIn && <p className="text-sm text-ink-500 mt-1">未読 {unread}件</p>}
        </div>
        {isSignedIn && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void reload()} disabled={loading}
              aria-label="通知を更新" className="p-2 rounded-lg border border-ink-200 disabled:opacity-50">
              <RefreshCw size={16} />
            </button>
            <button type="button" onClick={() => void markAllRead()}
              disabled={loading || allBusy || !!busyId || unread === 0}
              className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50">
              すべて既読
            </button>
          </div>
        )}
      </div>

      {!isLoaded || loading ? <p className="text-ink-500 text-sm">通知を読み込み中...</p> : null}
      {isLoaded && !isSignedIn && <p className="text-ink-500 text-sm">通知を見るにはログインしてください。</p>}
      {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}

      {isSignedIn && !loading && (
        <>
          <div className="bg-white rounded-2xl border border-ink-100 divide-y divide-ink-100">
            {items.map(item => (
              <div key={item.id} className={`flex items-start gap-3 p-4 ${!item.readAt ? 'bg-teal-50/40' : ''}`}>
                <div className="flex-shrink-0 pt-1"><NoticeIcon type={item.type} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-800">{labels[item.type] ?? '新しいお知らせがあります'}</p>
                  <time className="text-xs text-ink-400" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                </div>
                {!item.readAt && (
                  <button type="button" onClick={() => void markRead(item)} disabled={!!busyId || allBusy}
                    className="flex items-center gap-1 text-xs text-teal-700 hover:underline disabled:opacity-50"
                    aria-label="この通知を既読にする">
                    <Check size={15} /> 既読
                  </button>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center py-16">
                <Bell size={32} className="mx-auto text-ink-300 mb-2" />
                <p className="text-ink-400 text-sm">通知はありません</p>
              </div>
            )}
          </div>
          {cursor && (
            <button type="button" onClick={() => void loadMore()} disabled={moreBusy}
              className="block mx-auto mt-5 px-5 py-2 rounded-xl border border-ink-200 bg-white text-sm disabled:opacity-50">
              {moreBusy ? '読み込み中...' : 'もっと見る'}
            </button>
          )}
          <p className="mt-4 text-xs text-ink-400">
            現在は通知の種類と日時のみ表示しています。投稿・ユーザーへのリンクは後続の対応で追加します。
          </p>
        </>
      )}
    </div>
  );
}
