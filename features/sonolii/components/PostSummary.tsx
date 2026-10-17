import type { PostRow } from '../lib/postApi';
import type { TokenGetter } from '../lib/mediaApi';
import PostMediaView from './PostMediaView';

type Props = {
  post: PostRow;
  getToken: TokenGetter;
  onOpen: () => void;
};

export default function PostSummary({ post, getToken, onOpen }: Props) {
  return (
    <article className="bg-white rounded-xl border border-ink-100 p-4 space-y-3">
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
      <PostMediaView postId={post.id} media={post.media ?? []} getToken={getToken} compact />
      <button type="button" onClick={onOpen}
        className="text-sm text-teal-700 underline">投稿詳細を見る</button>
    </article>
  );
}
