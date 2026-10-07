import { useState } from 'react';
import type { ScreenName, Post } from '../types';
import { posts, users } from '../data';
import Avatar from '../components/Avatar';
import AudioPlayer from '../components/AudioPlayer';
import { ArrowLeft, Heart, MessageCircle, Send, MessageSquarePlus, X } from 'lucide-react';

interface PostDetailProps {
  postId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

export default function PostDetail({ postId, navigate }: PostDetailProps) {
  const post = posts.find((p) => p.id === postId) || posts[0];
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments);
  const [tsComments, setTsComments] = useState(post.timestampComments);
  const [tsCommentDraft, setTsCommentDraft] = useState<{ time: string; text: string } | null>(null);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments([...comments, { id: `c${Date.now()}`, user: users[4], text: commentText, createdAt: 'たった今' }]);
    setCommentText('');
  };

  const handleTsComment = () => {
    if (tsCommentDraft) {
      setTsComments([...tsComments, { id: `tc${Date.now()}`, user: users[4], timestamp: tsCommentDraft.time, text: tsCommentDraft.text }]);
      setTsCommentDraft(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('posts')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> 投稿一覧
      </button>

      <article className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <Avatar user={post.user} size="md" onClick={() => navigate('userProfile', { id: post.user.id })} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-900 text-sm">{post.user.name}</p>
            <p className="text-xs text-ink-400">{post.createdAt} · {post.user.instrument} · {post.user.region}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="font-serif text-lg text-ink-800">
            <span className="italic text-ink-600">{post.piece.composer}</span> / {post.piece.title}
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          {post.feedbackPrefs.map((p) => (
            <span key={p} className="px-2.5 py-1 text-xs font-medium bg-gold-50 text-gold-700 rounded-full border border-gold-200">{p}</span>
          ))}
        </div>

        <p className="text-sm text-ink-700 leading-relaxed mb-5 whitespace-pre-line">{post.body}</p>

        {post.imageUrl && (
          <div className="mb-5 rounded-xl overflow-hidden">
            <img src={post.imageUrl} alt="" className="w-full h-56 sm:h-64 object-cover" />
          </div>
        )}

        <AudioPlayer
          title={post.audioTitle}
          duration={post.audioDuration}
          timestampComments={tsComments.map((tc) => ({ id: tc.id, timestamp: tc.timestamp, text: tc.text }))}
          onTimestampComment={(time) => setTsCommentDraft({ time, text: '' })}
        />

        {tsCommentDraft && (
          <div className="mt-3 bg-gold-50 rounded-xl p-3 border border-gold-200 animate-scale-in">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gold-800">{tsCommentDraft.time} のコメント</p>
              <button onClick={() => setTsCommentDraft(null)} className="text-gold-600 hover:text-gold-800">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={tsCommentDraft.text}
              onChange={(e) => setTsCommentDraft({ ...tsCommentDraft, text: e.target.value })}
              placeholder="この部分についてのコメントを書く"
              className="w-full px-3 py-2 bg-white border border-gold-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 resize-none"
              rows={2}
            />
            <button
              onClick={handleTsComment}
              className="mt-2 px-4 py-1.5 bg-gold-600 text-white rounded-lg text-sm font-medium hover:bg-gold-700"
            >
              投稿する
            </button>
          </div>
        )}

        <div className="flex items-center gap-5 mt-5 pt-4 border-t border-ink-100">
          <button onClick={handleLike} className="flex items-center gap-2 hover:text-burgundy-500 transition-colors">
            <Heart size={20} className={liked ? 'fill-burgundy-500 text-burgundy-500' : 'text-ink-500'} />
            <span className={`text-sm font-medium ${liked ? 'text-burgundy-500' : 'text-ink-600'}`}>{likeCount}</span>
          </button>
          <button className="flex items-center gap-2 text-ink-500">
            <MessageCircle size={20} />
            <span className="text-sm font-medium">{comments.length + tsComments.length}</span>
          </button>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900 mb-4">
          Timestamp Comments <span className="text-ink-400 text-sm">({tsComments.length})</span>
        </h2>
        {tsComments.length === 0 ? (
          <p className="text-sm text-ink-400 bg-ink-50 rounded-xl p-4 text-center">音声を再生しながら特定の場所にコメントできます</p>
        ) : (
          <div className="space-y-3">
            {tsComments.map((tc) => (
              <div key={tc.id} className="bg-gold-50 rounded-xl p-3 border border-gold-100 flex items-start gap-3 animate-slide-up">
                <span className="flex-shrink-0 px-2 py-0.5 bg-gold-200 text-gold-800 rounded-md text-xs font-mono font-medium">{tc.timestamp}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-800">{tc.text}</p>
                  <p className="text-xs text-ink-400 mt-1">by {tc.user.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-serif text-lg font-semibold text-ink-900 mb-4">
          Comments <span className="text-ink-400 text-sm">({comments.length})</span>
        </h2>
        {post.commentsEnabled ? (
          <>
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-ink-100 p-4 flex items-start gap-3 animate-slide-up">
                  <Avatar user={c.user} size="sm" onClick={() => navigate('userProfile', { id: c.user.id })} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-ink-900 text-sm">{c.user.name}</p>
                      <p className="text-xs text-ink-400">{c.createdAt}</p>
                    </div>
                    <p className="text-sm text-ink-700">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleComment} className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="コメントを追加..."
                className="flex-1 px-4 py-3 bg-white border border-ink-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button type="submit" className="w-12 h-12 flex-shrink-0 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-700 transition-colors">
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-ink-400 bg-ink-50 rounded-xl p-4 text-center">この投稿はコメント受付を停止しています</p>
        )}
      </section>
    </div>
  );
}
