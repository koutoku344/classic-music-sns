import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowLeft, Music2 } from 'lucide-react';
import type { ScreenName } from '../types';
import { getPost, type PostRow } from '../lib/postApi';
import PostMediaView from '../components/PostMediaView';

type Props = {
  postId: string;
  navigate: (screen: ScreenName, params?: Record<string, string>) => void;
};

export default function PostDetail({ postId, navigate }: Props) {
  const { getToken, isLoaded } = useAuth();
  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    setPost(null);
    setLoading(true);
    setError('');
    void getPost(postId, getToken)
      .then(data => { if (active) setPost(data); })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : '投稿を取得できませんでした。');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [postId, getToken, isLoaded]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')}
        className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18}/> コミュニティへ戻る
      </button>

      {loading && <p role="status" className="text-sm text-ink-500">投稿を読み込み中...</p>}
      {error && <div role="alert" className="bg-white rounded-xl border border-ink-100 p-5 text-sm text-red-600">{error}</div>}

      {post && (
        <article className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 space-y-5">
          <div className="flex justify-between gap-3 items-start">
            <button onClick={() => navigate('userProfile', { id: post.user_id })}
              className="font-medium text-ink-900 hover:text-teal-700 text-left">
              {post.display_name || 'ユーザー'}
            </button>
            <span className="text-xs text-ink-400">
              {new Date(post.created_at).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>

          {post.piece_title && (
            <div className="flex items-center gap-2 text-ink-800 font-serif">
              <Music2 size={17} className="text-teal-600"/>
              <span>{post.composer_name ? `${post.composer_name} / ` : ''}{post.piece_title}</span>
            </div>
          )}

          {post.body && <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{post.body}</p>}

          <PostMediaView postId={post.id} media={post.media ?? []} getToken={getToken} />

          {post.feedback_prefs?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {post.feedback_prefs.map(pref => (
                <span key={pref} className="px-2.5 py-1 rounded-full text-xs bg-gold-50 text-gold-700">{pref}</span>
              ))}
            </div>
          )}

          <p className="border-t border-ink-100 pt-4 text-xs text-ink-500">
            コメント・いいね・タイムスタンプコメントは後続STEPで実装予定です。
          </p>
        </article>
      )}
    </div>
  );
}
