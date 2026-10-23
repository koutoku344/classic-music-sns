"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { listUserPosts, type PostRow } from '../lib/postApi';
import PostSummary from '../components/PostSummary';
import { getOrCreateConversation } from '../lib/messageApi';

type PublicProfile = {
  user_id: string;
  display_name: string;
  visibility: 'public' | 'followers' | 'private';
  restricted: boolean;
  bio?: string;
  instruments?: string[];
  region?: string | null;
};

type PublicProfileResponse = { profile: PublicProfile };
const API = 'https://sonolii-api.g57cydy6ks.workers.dev';

export default function UserProfile({
  userId,
  navigate,
}: {
  userId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}) {
  const { isLoaded, getToken } = useAuth();
  const [fromNotifications, setFromNotifications] = useState(false);
  const [dmBusy,setDmBusy]=useState(false);
  const [dmError,setDmError]=useState('');

  useEffect(() => {
    setFromNotifications(new URLSearchParams(window.location.search).get('from') === 'notifications');
  }, [userId]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState('');
  const [moreBusy, setMoreBusy] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);

    (async () => {
      try {
        // 未ログインでも閲覧できるAPI。認証済みなら本人判定のためJWTを送る。
        const token = await getToken();
        if (controller.signal.aborted) return;
        const response = await fetch(`${API}/profiles/${encodeURIComponent(userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (response.status === 404) {
          throw new Error('プロフィールが見つかりません（未登録の可能性もあります）');
        }
        if (!response.ok) throw new Error(`取得失敗 HTTP ${response.status}`);
        const data = await response.json() as PublicProfileResponse;
        if (!controller.signal.aborted) setProfile(data.profile);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'プロフィールを取得できませんでした');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isLoaded, getToken, userId]);

  useEffect(() => {
    if (!isLoaded || !profile || profile.restricted) {
      setPosts([]);
      setPostsCursor(null);
      return;
    }
    let active = true;
    setPostsLoading(true);
    setPostsError('');
    void listUserPosts(profile.user_id, getToken)
      .then(page => {
        if (active) { setPosts(page.posts); setPostsCursor(page.nextCursor); }
      })
      .catch(e => { if (active) setPostsError(e instanceof Error ? e.message : '投稿を取得できませんでした。'); })
      .finally(() => { if (active) setPostsLoading(false); });
    return () => { active = false; };
  }, [isLoaded, profile?.user_id, profile?.restricted, getToken]);

  const [followStatus, setFollowStatus] = useState<'self' | 'pending' | 'accepted' | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState('');

  useEffect(() => {
    if (!isLoaded || !profile) return;
    let active = true;
    setFollowLoading(true);
    setFollowError('');
    (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${API}/users/${encodeURIComponent(userId)}/follow`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`フォロー状態を取得できませんでした（HTTP ${response.status}）`);
        const data = await response.json() as { status: 'self' | 'pending' | 'accepted' | null };
        if (active) setFollowStatus(data.status);
      } catch (e) {
        if (active) setFollowError(e instanceof Error ? e.message : 'フォロー状態を取得できませんでした');
      } finally {
        if (active) setFollowLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLoaded, profile?.user_id, getToken, userId]);

  async function changeFollow() {
    if (followBusy || followLoading) return;
    const token = await getToken();
    if (!token) {
      setFollowError('フォローするにはログインが必要です。');
      return;
    }
    const undo = followStatus === 'pending' || followStatus === 'accepted';
    if (undo && !window.confirm(followStatus === 'pending' ? 'フォロー申請を取り消しますか？' : 'フォローを解除しますか？')) return;
    setFollowBusy(true);
    setFollowError('');
    try {
      const response = await fetch(`${API}/users/${encodeURIComponent(userId)}/follow`, {
        method: undo ? 'DELETE' : 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`フォロー操作に失敗しました（HTTP ${response.status}）`);
      if (undo) setFollowStatus(null);
      else {
        const data = await response.json() as { follow: { status: 'pending' | 'accepted' } };
        setFollowStatus(data.follow.status);
      }
    } catch (e) {
      setFollowError(e instanceof Error ? e.message : 'フォロー操作に失敗しました');
    } finally {
      setFollowBusy(false);
    }
  }

  async function loadMore() {
    if (!postsCursor || !profile || moreBusy) return;
    setMoreBusy(true);
    try {
      const page = await listUserPosts(profile.user_id, getToken, postsCursor);
      setPosts(existing => [...existing, ...page.posts.filter(
        post => !existing.some(p => p.id === post.id)
      )]);
      setPostsCursor(page.nextCursor);
    } catch (e) {
      setPostsError(e instanceof Error ? e.message : '追加取得に失敗しました。');
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button
        type="button"
        onClick={() => navigate(fromNotifications ? 'notifications' : 'community')}
        className="text-sm text-teal-700 mb-4"
      >
        ← 戻る
      </button>
      {loading && <p role="status">読み込み中...</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!loading && !error && profile && (
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h1 className="text-xl font-bold">
            {profile.display_name || 'プロフィール未設定'}
          </h1>
          {followStatus !== 'self' && (
            <div className="mt-4">
              <button type="button" onClick={() => void changeFollow()}
                disabled={followLoading || followBusy}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm disabled:opacity-50">
                {followBusy ? '処理中...' : followLoading ? '確認中...' :
                  followStatus === 'pending' ? '申請を取り消す' :
                  followStatus === 'accepted' ? 'フォローを解除' : 'フォローする'}
              </button>
              <button type="button" disabled={dmBusy} onClick={()=>{setDmBusy(true);setDmError('');void getOrCreateConversation(profile.user_id,getToken).then(id=>navigate('conversation',{id})).catch(e=>setDmError(String(e))).finally(()=>setDmBusy(false));}} className="ml-2 px-4 py-2 rounded-lg border border-teal-600 text-teal-700 text-sm disabled:opacity-50">メッセージ</button>
              {dmError && <p role="alert" className="mt-2 text-sm text-red-600">{dmError}</p>}
              {followError && <p role="alert" className="mt-2 text-sm text-red-600">{followError}</p>}
            </div>
          )}
          <p className="mt-3 text-sm">
            {profile.instruments?.join('・') || '楽器未設定'}
          </p>
          {profile.region && <p className="mt-2 text-sm">地域：{profile.region}</p>}
          <p className="mt-4 whitespace-pre-wrap">{profile.bio || ''}</p>
          {profile.restricted && <p className="mt-4 text-sm text-ink-500">投稿は公開範囲が制限されています。</p>}
          <p className="mt-6 text-xs text-ink-400">
            フォロー・レパートリーの公開表示は後続STEPで対応予定です。
          </p>
        </div>
      )}
      {!loading && !error && profile && !profile.restricted && (
        <section className="mt-5 space-y-3">
          <h2 className="font-serif text-lg font-semibold text-ink-900">投稿</h2>
          {postsLoading && <p className="text-sm text-ink-500">投稿を読み込み中...</p>}
          {postsError && <p role="alert" className="text-sm text-red-600">{postsError}</p>}
          {!postsLoading && posts.length === 0 && !postsError && (
            <p className="text-sm text-ink-500">表示できる投稿はありません。</p>
          )}
          {posts.map(post => (
            <PostSummary key={post.id} post={post} getToken={getToken}
              onOpen={() => navigate('postDetail', { id: post.id })}
              onOpenTimestamp={seconds => navigate('postDetail', { id: post.id, commentAt: String(seconds) })}/>
          ))}
          {postsCursor && (
            <button type="button" onClick={() => void loadMore()} disabled={moreBusy}
              className="w-full border border-ink-200 rounded-lg text-teal-700 py-3 text-sm disabled:opacity-50">
              {moreBusy ? '読み込み中...' : 'さらに投稿を表示'}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
