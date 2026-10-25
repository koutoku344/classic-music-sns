"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { listUserPosts, type PostRow } from '../lib/postApi';
import PostSummary from '../components/PostSummary';
import RecruitmentCard from '../components/RecruitmentCard';
import { listRecruitments, type RecruitmentRow } from '../lib/recruitmentApi';
import { UserRound } from 'lucide-react';
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
  const [profileTab,setProfileTab]=useState<'all'|'posts'>('all');
  const [contentKind,setContentKind]=useState<'all'|'performances'|'recruitments'>('all');
  const [recruitments,setRecruitments]=useState<RecruitmentRow[]>([]);
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
        if (!response.ok) throw new Error('プロフィールを読み込めませんでした。');
        const data = await response.json() as PublicProfileResponse;
        if (!controller.signal.aborted) setProfile(data.profile);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError('プロフィールを読み込めませんでした。再度お試しください。');
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
      .catch(e => { if (active) setPostsError('投稿を読み込めませんでした。再度お試しください。'); })
      .finally(() => { if (active) setPostsLoading(false); });
    return () => { active = false; };
  }, [isLoaded, profile?.user_id, profile?.restricted, getToken]);

  useEffect(()=>{
    if(!isLoaded||!profile?.user_id||profile.restricted){setRecruitments([]);return;}
    let active=true;
    void listRecruitments(getToken).then(result=>{
      if(active)setRecruitments(result.recruitments.filter(r=>r.user_id===profile.user_id));
    }).catch(()=>{if(active)setRecruitments([]);});
    return()=>{active=false;};
  },[isLoaded,profile?.user_id,profile?.restricted,getToken]);

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
        if (active) setFollowError('フォロー状態を読み込めませんでした。');
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
      setFollowError('フォロー操作を完了できませんでした。再度お試しください。');
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
        <div className="bg-white rounded-2xl border border-ink-100 p-6 animate-slide-up">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 shrink-0 bg-ink-100 rounded-full flex items-center justify-center text-ink-400">
              <UserRound size={36}/>
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-xl font-bold text-ink-900">{profile.display_name || 'プロフィール未設定'}</h1>
              <p className="text-sm text-ink-500 mt-1">{[...(profile.instruments??[]),...(profile.region?[profile.region]:[])].join(' · ')}</p>
            </div>
          </div>
          {followStatus !== 'self' && (
            <div className="mt-4">
              <button type="button" onClick={() => void changeFollow()}
                disabled={followLoading || followBusy}
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm disabled:opacity-50">
                {followBusy ? '処理中...' : followLoading ? '確認中...' :
                  followStatus === 'pending' ? '申請を取り消す' :
                  followStatus === 'accepted' ? 'フォローを解除' : 'フォローする'}
              </button>
              <button type="button" disabled={dmBusy} onClick={()=>{setDmBusy(true);setDmError('');void getOrCreateConversation(profile.user_id,getToken).then(id=>navigate('conversation',{id})).catch(e=>setDmError('メッセージを開始できませんでした。再度お試しください。')).finally(()=>setDmBusy(false));}} className="ml-2 px-4 py-2 rounded-lg border border-teal-600 text-teal-700 text-sm disabled:opacity-50">メッセージ</button>
              {dmError && <p role="alert" className="mt-2 text-sm text-red-600">{dmError}</p>}
              {followError && <p role="alert" className="mt-2 text-sm text-red-600">{followError}</p>}
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap">{profile.restricted ? '' : (profile.bio || '')}</p>
          {profile.restricted && <p className="mt-4 text-sm text-ink-500">投稿は公開範囲が制限されています。</p>}

        </div>
      )}
      {!loading&&!error&&profile&&!profile.restricted&&<>
        <div className="flex gap-1 mt-5 mb-4 bg-white rounded-xl border border-ink-100 p-1">
          {([{id:'all',label:'全て'},{id:'posts',label:'投稿'}] as const).map(item=>
            <button key={item.id} onClick={()=>setProfileTab(item.id)}
              className={`flex-1 py-2 rounded-lg text-sm ${profileTab===item.id?'bg-teal-600 text-white':'text-ink-600'}`}>{item.label}</button>)}
        </div>
        {profileTab==='posts'&&<div className="flex gap-2 mb-4">
          {([{id:'all',label:'全て'},{id:'performances',label:'演奏'},{id:'recruitments',label:'募集'}] as const).map(item=>
            <button key={item.id} onClick={()=>setContentKind(item.id)}
              className={`px-4 py-2 rounded-full text-sm ${contentKind===item.id?'bg-ink-900 text-white':'bg-white border border-ink-200'}`}>{item.label}</button>)}
        </div>}
        {(profileTab==='all'||contentKind!=='recruitments')&&<>
          <div className="space-y-3">
            {postsLoading&&<p className="text-sm text-ink-500">投稿を読み込み中...</p>}
            {postsError&&<p className="text-sm text-ink-600">投稿を読み込めませんでした。</p>}
            {!postsLoading&&!postsError&&posts.length===0&&<p className="text-sm text-ink-500">表示できる投稿はありません。</p>}
            {posts.map(post=><PostSummary key={post.id} post={post} getToken={getToken}
              onOpen={()=>navigate('postDetail',{id:post.id})}
              onOpenTimestamp={seconds=>navigate('postDetail',{id:post.id,commentAt:String(seconds)})}/>)}
            {postsCursor&&<button type="button" onClick={()=>void loadMore()} disabled={moreBusy}
              className="w-full border border-ink-200 rounded-lg text-teal-700 py-3 text-sm">さらに投稿を表示</button>}
          </div>
        </>}
        {(profileTab==='all'||contentKind!=='performances')&&<div className="space-y-3 mt-3">
          {recruitments.map(r=><RecruitmentCard key={r.id} recruitment={r}
            onClick={()=>navigate('recruitmentDetail',{id:r.id})}/>)}
        </div>}
      </>}
    </div>
  );
}
