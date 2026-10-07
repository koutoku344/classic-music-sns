import { Heart, MessageCircle, Music2, Image as ImageIcon } from 'lucide-react';
import type { Post } from '../types';
import Avatar from './Avatar';
import AudioPlayer from './AudioPlayer';

interface PostCardProps {
  post: Post;
  onPostClick?: () => void;
  onUserClick?: () => void;
}

export default function PostCard({ post, onPostClick, onUserClick }: PostCardProps) {
  return (
    <article
      onClick={onPostClick}
      className="bg-white rounded-2xl border border-ink-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer animate-slide-up"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <Avatar user={post.user} size="md" onClick={onUserClick} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-900 text-sm truncate hover:text-teal-700 transition-colors" onClick={(e) => { e.stopPropagation(); onUserClick?.(); }}>
              {post.user.name}
            </p>
            <p className="text-xs text-ink-400">{post.createdAt}</p>
          </div>
          {post.feedbackPrefs.length > 0 && (
            <div className="hidden sm:flex gap-1.5">
              {post.feedbackPrefs.map((p) => (
                <span key={p} className="px-2 py-0.5 text-[10px] font-medium bg-gold-50 text-gold-700 rounded-full border border-gold-200">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 text-sm">
          <Music2 size={14} className="text-teal-600 flex-shrink-0" />
          <span className="font-serif text-base text-ink-800">
            <span className="italic text-ink-600">{post.piece.composer}</span> / {post.piece.title}
          </span>
        </div>

        <p className="text-sm text-ink-700 leading-relaxed mb-4 whitespace-pre-line">{post.body}</p>

        {post.imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img src={post.imageUrl} alt="" className="w-full h-48 sm:h-56 object-cover" />
          </div>
        )}

        <AudioPlayer title={post.audioTitle} duration={post.audioDuration} compact />

        <div className="flex items-center gap-5 mt-4 text-ink-500">
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-burgundy-500 transition-colors text-sm group"
          >
            <Heart size={18} className={post.liked ? 'fill-burgundy-500 text-burgundy-500' : ''} />
            <span className={post.liked ? 'text-burgundy-500 font-medium' : ''}>{post.likes}</span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-teal-600 transition-colors text-sm"
          >
            <MessageCircle size={18} />
            <span>{post.comments.length + post.timestampComments.length}</span>
          </button>
          {!post.commentsEnabled && (
            <span className="text-xs text-ink-400 ml-auto">コメント受付停止中</span>
          )}
        </div>
      </div>
    </article>
  );
}
