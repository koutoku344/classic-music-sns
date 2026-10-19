import type { PostRow } from '../lib/postApi';
import type { TokenGetter } from '../lib/mediaApi';
import PostMediaView from './PostMediaView';

type Props = {
  post: PostRow;
  getToken: TokenGetter;
  onOpen: () => void;
  onOpenTimestamp?: (seconds: number) => void;
};

export default function PostSummary({ post, getToken, onOpen, onOpenTimestamp }: Props) {
  return (
    <article
      role="link" tabIndex={0}
      aria-label={`投稿を開く：${post.body?.slice(0, 30) || post.piece_title || '添付メディア'}`}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="bg-white rounded-xl border border-ink-100 p-4 space-y-3 cursor-pointer hover:border-teal-300 hover:shadow-sm focus-visible:outline-teal-600"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-800">{post.display_name || 'ユーザー'}</p>
        <p className="text-xs text-ink-400">
          {new Date(post.created_at).toLocaleString('ja-JP')}
        </p>
      </div>
      {post.piece_title && (
        <p className="text-xs font-serif text-ink-700">
          {post.composer_name ? `${post.composer_name} / ` : ''}{post.piece_title}
        </p>
      )}
      {post.body && <p className="text-sm text-ink-700 whitespace-pre-line">{post.body}</p>}
      <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <PostMediaView postId={post.id} media={post.media ?? []} getToken={getToken} compact
          onTimestampComment={post.comments_enabled ? onOpenTimestamp : undefined} />
      </div>
    </article>
  );
}
