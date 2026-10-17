import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';
import { recruitments } from '../data';
import { listPosts, type PostRow } from '../lib/postApi';
import PostMediaView from '../components/PostMediaView';
import RecruitmentCard from '../components/RecruitmentCard';
import { Plus, Users, Music2, MessageCircle } from 'lucide-react';

interface CommunityProps {
  navigate: (screen: ScreenName, params?: Record<string, string>) => void;
}

type Filter = 'all' | 'posts' | 'recruitments';

function formattedDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Community({ navigate }: CommunityProps) {
  const { isLoaded, getToken } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    setLoading(true);
    setError('');
    void listPosts(getToken)
      .then(data => {
        if (active) {
          setPosts(data.posts);
          setCursor(data.nextCursor);
        }
      })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : '投稿を取得できませんでした。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isLoaded, getToken]);

  async function loadMore() {
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    setError('');
    try {
      const data = await listPosts(getToken, cursor);
      setPosts(previous => [...previous, ...data.posts.filter(
        item => !previous.some(p => p.id === item.id)
      )]);
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加の投稿を読み込めませんでした。');
    } finally {
      setMoreBusy(false);
    }
  }

  const showPosts = filter !== 'recruitments';
  const showRecruitments = filter !== 'posts';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6">
      <div className="sticky top-16 z-30 bg-ink-50/90 backdrop-blur-md pt-4 pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-ink-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink-900">コミュニティ</h1>
            <p className="text-xs text-ink-400 mt-0.5">投稿 {posts.length}件（取得済み） · 募集はサンプル表示</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowCreateMenu(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
              <Plus size={16}/> 作成
            </button>
            {showCreateMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)}/>
                <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-lg border border-ink-100 py-1.5 w-40">
                  <button onClick={() => { setShowCreateMenu(false); navigate('createPost'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-teal-50">
                    <Music2 size={16}/> 演奏を投稿
                  </button>
                  <button onClick={() => { setShowCreateMenu(false); navigate('createRecruitment'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-teal-50">
                    <Users size={16}/> 募集を作成（サンプル）
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'posts', 'recruitments'] as const).map(item => (
            <button key={item} onClick={() => setFilter(item)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${filter === item
                ? 'bg-ink-900 text-white'
                : 'bg-white text-ink-600 border border-ink-200'}`}>
              {item === 'all' ? '全て' : item === 'posts' ? '投稿' : '募集（サンプル）'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 py-4">
        {showPosts && loading && <p className="text-sm text-ink-500">投稿を読み込み中...</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {showPosts && !loading && posts.map(post => (
          <article key={post.id} className="bg-white rounded-2xl border border-ink-100 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => navigate('userProfile', { id: post.user_id })}
                className="font-medium text-ink-900 text-sm hover:text-teal-700">
                {post.display_name || 'ユーザー'}
              </button>
              <span className="text-xs text-ink-400">{formattedDate(post.created_at)}</span>
            </div>
            {post.piece_title && (
              <p className="font-serif text-sm text-ink-700">
                {post.composer_name ? `${post.composer_name} / ` : ''}{post.piece_title}
              </p>
            )}
            {post.body && <p className="text-sm text-ink-700 whitespace-pre-line">{post.body}</p>}
            <PostMediaView postId={post.id} media={post.media ?? []} getToken={getToken} compact />
            {post.feedback_prefs?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.feedback_prefs.map(p => (
                  <span key={p} className="px-2 py-1 text-xs rounded-full bg-gold-50 text-gold-700">{p}</span>
                ))}
              </div>
            )}
            <button onClick={() => navigate('postDetail', { id: post.id })}
              className="text-sm text-teal-700 font-medium underline">投稿詳細を見る</button>
          </article>
        ))}
        {showPosts && !loading && posts.length === 0 && !error && (
          <div className="text-center py-12 text-ink-400">
            <MessageCircle className="mx-auto mb-3 opacity-40" size={32}/>
            <p>表示できる投稿はまだありません</p>
          </div>
        )}
        {showPosts && cursor && (
          <button onClick={() => void loadMore()} disabled={moreBusy}
            className="w-full py-3 text-sm text-teal-700 border border-ink-200 rounded-xl disabled:opacity-50">
            {moreBusy ? '読み込み中...' : 'さらに投稿を読み込む'}
          </button>
        )}
        {showRecruitments && (
          <>
            <p className="text-xs text-ink-400">以下の募集はまだサンプルデータです。</p>
            {recruitments.map(item => (
              <RecruitmentCard
                key={item.id}
                recruitment={item}
                onClick={() => navigate('recruitmentDetail', { id: item.id })}
                onUserClick={() => navigate('userProfile', { id: item.user.id })}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
