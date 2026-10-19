import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Trash2, Reply, Clock3 } from 'lucide-react';
import type { TokenGetter } from '../lib/mediaApi';
import {
  createFeedbackComment, deleteFeedbackComment, getPostLikes,
  listPostComments, listCommentReplies, setCommentLiked, setPostLiked,
  type FeedbackComment, type LikeStatus,
} from '../lib/feedbackApi';

type Props = {
  postId: string;
  commentsEnabled: boolean;
  myUserId: string | null;
  profileReady: boolean;
  onCreateProfile: () => void;
  ownerId: string;
  getToken: TokenGetter;
  hasAudio: boolean;
  currentAudioSeconds: number | null;
  onSeek: (seconds: number) => void;
  timestampRequest?: { seconds: number; id: number } | null;
};

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = Math.floor(seconds % 60);
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function PostFeedback({
  postId, commentsEnabled, myUserId, profileReady, onCreateProfile,
  ownerId, getToken, hasAudio,
  currentAudioSeconds, onSeek, timestampRequest,
}: Props) {
  const [roots, setRoots] = useState<FeedbackComment[]>([]);
  const [rootCursor, setRootCursor] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, FeedbackComment[]>>({});
  const [replyCursors, setReplyCursors] = useState<Record<string, string | null>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [postLikes, setPostLikes] = useState<LikeStatus>({ likeCount: 0, likedByMe: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string; root: string } | null>(null);
  const [error, setError] = useState('');
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  function requireProfile(): boolean {
    if (!myUserId) {
      setError('操作するにはログインしてください。');
      return false;
    }
    if (!profileReady) {
      setShowProfilePrompt(true);
      return false;
    }
    return true;
  }
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!timestampRequest || !commentsEnabled || !myUserId || !hasAudio) return;
    if (!profileReady) { setShowProfilePrompt(true); return; }
    setReplyTarget(null);
    setTimestamp(timestampRequest.seconds);
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    commentInputRef.current?.focus({ preventScroll: true });
  }, [timestampRequest, commentsEnabled, myUserId, hasAudio, profileReady]);

  const loadRoots = useCallback(async (cursor: string | null = null) => {
    const page = await listPostComments(postId, getToken, cursor);
    setRoots(current => cursor ? [...current, ...page.comments] : page.comments);
    setRootCursor(page.nextCursor);
  }, [postId, getToken]);

  const loadReplies = useCallback(async (rootId: string, cursor: string | null = null) => {
    const page = await listCommentReplies(postId, rootId, getToken, cursor);
    setReplies(current => ({
      ...current,
      [rootId]: cursor ? [...(current[rootId] ?? []), ...page.comments] : page.comments,
    }));
    setReplyCursors(current => ({ ...current, [rootId]: page.nextCursor }));
  }, [postId, getToken]);

  useEffect(() => {
    let active = true;
    setRoots([]);
    setReplies({});
    setExpanded({});
    setLoading(true);
    setError('');
    void Promise.all([listPostComments(postId, getToken), getPostLikes(postId, getToken)])
      .then(([page, likes]) => {
        if (!active) return;
        setRoots(page.comments);
        setRootCursor(page.nextCursor);
        setPostLikes(likes);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'コメントの読み込みに失敗しました。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId, getToken]);

  async function toggleReplies(rootId: string) {
    const next = !expanded[rootId];
    setExpanded(current => ({ ...current, [rootId]: next }));
    if (next && !replies[rootId]) {
      try { await loadReplies(rootId); }
      catch (cause) { setError(cause instanceof Error ? cause.message : '返信を読み込めませんでした。'); }
    }
  }

  async function submit() {
    if (busy || !commentsEnabled || !body.trim()) return;
    if (!requireProfile()) return;
    setBusy(true);
    setError('');
    try {
      await createFeedbackComment(
        postId, getToken, body.trim(), replyTarget ? null : timestamp,
        replyTarget?.id ?? null,
      );
      const currentRoot = replyTarget?.root;
      setBody('');
      setTimestamp(null);
      setReplyTarget(null);
      if (currentRoot) {
        setExpanded(current => ({ ...current, [currentRoot]: true }));
        await loadReplies(currentRoot);
      } else {
        await loadRoots();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'コメントを送信できませんでした。');
    } finally { setBusy(false); }
  }

  async function togglePostLike() {
    if (busy) return;
    if (!requireProfile()) return;
    setBusy(true);
    setError('');
    try {
      await setPostLiked(postId, !postLikes.likedByMe, getToken);
      setPostLikes(await getPostLikes(postId, getToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'いいねを更新できませんでした。');
    } finally { setBusy(false); }
  }

  async function toggleCommentLike(item: FeedbackComment) {
    if (busy) return;
    if (!requireProfile()) return;
    setBusy(true);
    setError('');
    try {
      await setCommentLiked(postId, item.id, !item.liked_by_me, getToken);
      // Re-fetch authoritative counts rather than risking stale optimistic state.
      if (item.parent_comment_id) await loadReplies(item.parent_comment_id);
      else await loadRoots();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'いいねを更新できませんでした。');
    } finally { setBusy(false); }
  }

  async function removeComment(item: FeedbackComment) {
    if (busy || !window.confirm('このコメントを削除しますか？返信は残ります。')) return;
    setBusy(true);
    setError('');
    try {
      await deleteFeedbackComment(postId, item.id, getToken);
      if (item.parent_comment_id) {
        await loadReplies(item.parent_comment_id);
        await loadRoots();
      } else {
        await loadRoots();
      }
      if (replyTarget?.id === item.id) setReplyTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'コメントを削除できませんでした。');
    } finally { setBusy(false); }
  }

  function beginReply(item: FeedbackComment) {
    if (!commentsEnabled || item.deleted_at) return;
    if (!requireProfile()) return;
    setReplyTarget({
      id: item.id,
      name: item.display_name || 'ユーザー',
      root: item.parent_comment_id ?? item.id,
    });
    setTimestamp(null);
  }

  function renderComment(item: FeedbackComment) {
    const deleted = item.deleted_at !== null;
    const canDelete = !deleted && !!myUserId &&
      (myUserId === item.user_id || myUserId === ownerId);

    return (
      <div key={item.id} className="border-b border-ink-100 py-3 last:border-b-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-ink-800">
            {deleted ? '削除されたコメント' : item.display_name || 'ユーザー'}
          </p>
          <span className="text-xs text-ink-400 shrink-0">
            {new Date(item.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>
        {deleted ? (
          <p className="text-sm text-ink-400 mt-1">削除されたコメントです</p>
        ) : (
          <>
            {item.reply_to_comment_id && (
              <span className="text-xs text-teal-700">
                {item.reply_to_display_name
                  ? `@${item.reply_to_display_name} `
                  : '削除されたコメントへの返信 '}
              </span>
            )}
            {item.audio_timestamp_seconds !== null && (
              <button type="button" className="inline-flex items-center gap-1 text-xs text-teal-700 mr-2"
                disabled={!hasAudio}
                onClick={() => onSeek(item.audio_timestamp_seconds!)}>
                <Clock3 size={13} /> {formatTime(item.audio_timestamp_seconds)}
              </button>
            )}
            <p className="text-sm text-ink-700 mt-1 whitespace-pre-wrap break-words">{item.body}</p>
          </>
        )}
        {!deleted && (
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-ink-500">
            <button type="button" disabled={busy} onClick={() => void toggleCommentLike(item)}
              className={item.liked_by_me ? 'text-rose-600 flex items-center gap-1' : 'flex items-center gap-1'}>
              <Heart size={14} fill={item.liked_by_me ? 'currentColor' : 'none'}/>
              {item.like_count}
            </button>
            {commentsEnabled && (
              <button type="button" disabled={busy} onClick={() => beginReply(item)}
                className="inline-flex items-center gap-1"><Reply size={14}/> 返信</button>
            )}
            {canDelete && (
              <button type="button" disabled={busy} onClick={() => void removeComment(item)}
                className="inline-flex items-center gap-1 text-red-600"><Trash2 size={13}/> 削除</button>
            )}
          </div>
        )}
        {!item.parent_comment_id && (item.has_replies || (replies[item.id]?.length ?? 0) > 0) && (
          <div className="mt-2">
            <button type="button" onClick={() => void toggleReplies(item.id)}
              className="text-xs text-teal-700">
              {expanded[item.id] ? '返信を閉じる' : '返信を表示'}
            </button>
            {expanded[item.id] && (
              <div className="ml-4 pl-3 border-l-2 border-ink-100 mt-2">
                {(replies[item.id] ?? []).map(child => renderComment(child))}
                {replyCursors[item.id] && (
                  <button type="button" className="text-xs text-teal-700 py-2"
                    onClick={() => void loadReplies(item.id, replyCursors[item.id])}>
                    さらに返信を表示
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="border-t border-ink-100 pt-4 space-y-4">
      {showProfilePrompt && (
        <div role="dialog" aria-modal="true" aria-label="プロフィールを作成してください"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-ink-900 text-lg">プロフィールを作成してください</h3>
            <p className="text-sm text-ink-600">
              いいね・コメント・返信をするには表示名を設定してください。
              投稿やコメントの閲覧は設定前でも可能です。
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowProfilePrompt(false)}
                className="px-4 py-2 text-sm text-ink-600">あとで</button>
              <button type="button" onClick={onCreateProfile}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm">
                プロフィールを設定する
              </button>
            </div>
          </div>
        </div>
      )}
      {!profileReady && myUserId && commentsEnabled && (
        <p className="text-sm text-ink-600 bg-ink-50 rounded-lg p-3">
          いいね・コメントにはプロフィールが必要です。
          <button type="button" className="ml-2 text-teal-700 underline"
            onClick={onCreateProfile}>プロフィールを設定する</button>
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void togglePostLike()}
        className={postLikes.likedByMe
          ? 'text-rose-600 flex items-center gap-2 text-sm'
          : 'text-ink-600 flex items-center gap-2 text-sm'}>
        <Heart size={20} fill={postLikes.likedByMe ? 'currentColor' : 'none'}/>
        いいね {postLikes.likeCount}
      </button>
      <div>
        <h3 className="font-semibold text-ink-900 flex gap-2 items-center">
          <MessageCircle size={18}/> コメント
        </h3>
        {loading && <p className="text-sm text-ink-500 mt-3">読み込み中...</p>}
        {error && <p role="alert" className="text-sm text-red-600 mt-2">{error}</p>}
        {!loading && roots.length === 0 && (
          <p className="text-sm text-ink-500 mt-3">まだコメントはありません。</p>
        )}
        {!loading && roots.map(renderComment)}
        {rootCursor && (
          <button type="button" className="text-sm text-teal-700 mt-3"
            onClick={() => void loadRoots(rootCursor)}>さらにコメントを表示</button>
        )}
      </div>
      {commentsEnabled ? (
        <div className="space-y-2 border-t border-ink-100 pt-4">
          {replyTarget && (
            <div className="flex items-center justify-between text-xs bg-ink-50 p-2 rounded-lg">
              <span>@{replyTarget.name} への返信</span>
              <button type="button" onClick={() => setReplyTarget(null)}
                className="text-teal-700">返信をやめる</button>
            </div>
          )}
          <textarea ref={commentInputRef} aria-label="コメント本文" value={body}
            onChange={event => setBody(event.target.value)}
            maxLength={1000} rows={3}
            placeholder={myUserId ? '演奏の感想やアドバイスを入力...' : 'コメントするにはログインしてください'}
            onFocus={() => { if (!profileReady && myUserId) setShowProfilePrompt(true); }}
            readOnly={!profileReady}
            disabled={!myUserId || busy}
            className="w-full rounded-xl border border-ink-200 p-3 text-sm"/>
          {!replyTarget && hasAudio && (
            <button type="button" disabled={busy || !myUserId || currentAudioSeconds === null}
              onClick={() => setTimestamp(current =>
                current !== null ? null : Math.floor(currentAudioSeconds!))}
              className="text-xs text-teal-700 inline-flex items-center gap-1">
              <Clock3 size={14}/>
              {timestamp !== null
                ? `${formatTime(timestamp)} を解除`
                : '現在の再生位置を添付'}
            </button>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-ink-400">{body.length}/1000文字</span>
            <button type="button" disabled={!myUserId || busy || (profileReady && !body.trim())}
              onClick={() => void submit()}
              className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm disabled:opacity-40">
              {busy ? '送信中...' : replyTarget ? '返信する' : 'コメントする'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-500 border-t border-ink-100 pt-4">
          この投稿はコメントを受け付けていません。既存のコメントは閲覧できます。
        </p>
      )}
    </section>
  );
}
