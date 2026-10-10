import { useState } from 'react';
import type { ScreenName, Comment, TimestampComment } from '../types';
import { posts, users } from '../data';
import Avatar from '../components/Avatar';
import AudioPlayer from '../components/AudioPlayer';
import CommentItem from '../components/CommentItem';
import TimestampCommentItem from '../components/TimestampCommentItem';
import { getTopTrophy, TrophyBadge } from '../components/Trophy';
import { ArrowLeft, Heart, MessageCircle, Send, X, Share2, Link2, Check } from 'lucide-react';

interface PostDetailProps {
  postId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}

function findCommentById(comments: Comment[], id: string): Comment | null {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies) {
      const found = findCommentById(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}

function mapComments(comments: Comment[], fn: (c: Comment) => Comment): Comment[] {
  return comments.map((c) => {
    const updated = fn(c);
    if (c.replies) {
      return { ...updated, replies: mapComments(c.replies, fn) };
    }
    return updated;
  });
}

function mapTsComments(comments: TimestampComment[], fn: (c: TimestampComment) => TimestampComment): TimestampComment[] {
  return comments.map((c) => {
    const updated = fn(c);
    if (c.replies) {
      return { ...updated, replies: mapTsComments(c.replies, fn) };
    }
    return updated;
  });
}

export default function PostDetail({ postId, navigate }: PostDetailProps) {
  const post = posts.find((p) => p.id === postId) || posts[0];
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [tsComments, setTsComments] = useState(post.timestampComments);
  const [tsCommentDraft, setTsCommentDraft] = useState<{ time: string; text: string } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const hasAudio = !!(post.audioTitle && post.audioDuration);
  const topTrophy = getTopTrophy(post.user.trophies);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments([...comments, { id: `c${Date.now()}`, user: users[4], text: commentText, createdAt: 'たった今', likes: 0, liked: false, replies: [] }]);
    setCommentText('');
  };

  const handleReply = (parentId: string, text: string) => {
    const newReply: Comment = { id: `r${Date.now()}`, user: users[4], text, createdAt: 'たった今', likes: 0, liked: false, replies: [] };
    setComments(prev => mapComments(prev, (c) => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    }));
  };

  const handleCommentLike = (commentId: string) => {
    setComments(prev => mapComments(prev, (c) => {
      if (c.id === commentId) {
        return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
      }
      return c;
    }));
  };

  const handleTsComment = () => {
    if (tsCommentDraft) {
      setTsComments([...tsComments, { id: `tc${Date.now()}`, user: users[4], timestamp: tsCommentDraft.time, text: tsCommentDraft.text, likes: 0, liked: false, replies: [] }]);
      setTsCommentDraft(null);
    }
  };

  const handleTsReply = (parentId: string, text: string) => {
    const newReply: TimestampComment = { id: `tcr${Date.now()}`, user: users[4], timestamp: '0:00', text, likes: 0, liked: false, replies: [] };
    setTsComments(prev => mapTsComments(prev, (c) => {
      if (c.id === parentId) {
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    }));
  };

  const handleTsCommentLike = (commentId: string) => {
    setTsComments(prev => mapTsComments(prev, (c) => {
      if (c.id === commentId) {
        return { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 };
      }
      return c;
    }));
  };

  const handleCopyUrl = () => {
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  const goToUserProfile = (userId: string) => navigate('userProfile', { id: userId });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button onClick={() => navigate('community')} className="flex items-center gap-1.5 text-ink-600 hover:text-ink-900 mb-4 text-sm font-medium">
        <ArrowLeft size={18} /> コミュニティ
      </button>

      <article className="bg-white rounded-2xl border border-ink-100 p-5 sm:p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <Avatar user={post.user} size="md" onClick={() => goToUserProfile(post.user.id)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className="font-medium text-ink-900 text-sm cursor-pointer hover:text-teal-700 transition-colors"
                onClick={() => goToUserProfile(post.user.id)}
              >
                {post.user.name}
              </p>
              {topTrophy && <TrophyBadge trophy={topTrophy} size="xs" />}
            </div>
            <p className="text-xs text-ink-400">{post.createdAt} · {post.user.instrument} · {post.user.region}</p>
          </div>
          <button
            onClick={() => setShowShare(true)}
            className="w-9 h-9 flex items-center justify-center text-ink-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>

        {hasAudio && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span className="font-serif text-lg text-ink-800">
              <span className="italic text-ink-600">{post.piece.composer}</span> / {post.piece.title}
            </span>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {post.feedbackPrefs.map((p) => (
            <span key={p} className="px-2.5 py-1 text-xs font-medium bg-gold-50 text-gold-700 rounded-full border border-gold-200">{p}</span>
          ))}
        </div>

        {post.body && <p className="text-sm text-ink-700 leading-relaxed mb-5 whitespace-pre-line">{post.body}</p>}

        {post.imageUrl && (
          <div className="mb-5 rounded-xl overflow-hidden">
            <img src={post.imageUrl} alt="" className="w-full h-56 sm:h-64 object-cover" />
          </div>
        )}

        {hasAudio && post.audioTitle && post.audioDuration && (
          <AudioPlayer
            title={post.audioTitle}
            duration={post.audioDuration}
            timestampComments={tsComments.map((tc) => ({ id: tc.id, timestamp: tc.timestamp, text: tc.text }))}
            onTimestampComment={(time) => setTsCommentDraft({ time, text: '' })}
            onSeekTo={(time) => {}}
          />
        )}

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
          <div className="space-y-4">
            {tsComments.map((tc) => (
              <TimestampCommentItem
                key={tc.id}
                comment={tc}
                onUserClick={goToUserProfile}
                onReply={handleTsReply}
                onLike={handleTsCommentLike}
              />
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
            <div className="space-y-4 mb-4">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  onUserClick={goToUserProfile}
                  onReply={handleReply}
                  onLike={handleCommentLike}
                />
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

      {/* Share bottom sheet */}
      {showShare && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-900/40 animate-fade-in" onClick={() => setShowShare(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up p-6">
            <div className="w-12 h-1 bg-ink-200 rounded-full mx-auto mb-4" />
            <h3 className="font-serif font-bold text-ink-900 text-lg mb-4">共有</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <ShareButton icon="LINE" label="LINE" color="bg-green-500" />
              <ShareButton icon="X" label="X" color="bg-ink-900" />
              <ShareButton icon="copy" label="URLコピー" color="bg-ink-500" onClick={handleCopyUrl} copied={urlCopied} />
              <ShareButton icon="other" label="その他" color="bg-ink-400" />
            </div>
            <button
              onClick={() => setShowShare(false)}
              className="w-full py-3 bg-ink-100 text-ink-700 rounded-xl font-medium hover:bg-ink-200 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ShareButton({ icon, label, color, onClick, copied }: { icon: string; label: string; color: string; onClick?: () => void; copied?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <span className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center text-xs font-bold shadow-sm`}>
        {copied ? <Check size={20} /> : icon === 'copy' ? <Link2 size={20} /> : icon}
      </span>
      <span className="text-xs text-ink-600 font-medium">{copied ? 'コピー済' : label}</span>
    </button>
  );
}
