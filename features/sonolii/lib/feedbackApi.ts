import { API_BASE } from './repertoireApi';
import type { TokenGetter } from './mediaApi';

export type FeedbackComment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  reply_to_comment_id: string | null;
  body: string | null;
  audio_timestamp_seconds: number | null;
  deleted_at: string | null;
  created_at: string;
  display_name: string | null;
  reply_to_display_name: string | null;
  like_count: number;
  liked_by_me: boolean;
  has_replies: boolean;
};

export type CommentPage = {
  comments: FeedbackComment[];
  nextCursor: string | null;
};

export type LikeStatus = {
  likeCount: number;
  likedByMe: boolean;
};

async function feedbackRequest(
  path: string,
  getToken: TokenGetter,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  if (init.method && init.method !== 'GET' && !token) {
    throw new Error('コメントやいいねの操作にはログインが必要です。');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new Error('フィードバックAPIに接続できません。');
  }

  if (!response.ok) {
    let code = '';
    try {
      const body = await response.json() as { error?: string };
      code = body.error ?? '';
    } catch { /* HTTP status is sufficient */ }

    const messages: Record<string, string> = {
      unauthorized: 'ログインが必要です。',
      profile_required: 'いいね・コメントするにはプロフィールの表示名を設定してください。',
      post_not_found: '投稿が見つからないか、閲覧できません。',
      comment_not_found: 'コメントが存在しないか、操作できません。',
      comments_disabled: 'この投稿ではコメントを受け付けていません。',
      invalid_comment: 'コメントを1〜1000文字で入力してください。',
      invalid_timestamp: '音声の再生位置を確認できません。時刻を解除して再度お試しください。',
      invalid_cursor: 'コメントの読み込み位置が無効です。',
    };
    throw new Error(messages[code] ?? `フィードバックAPIエラー（HTTP ${response.status}）。`);
  }
  return response;
}

export async function listPostComments(
  postId: string, getToken: TokenGetter, cursor: string | null = null,
): Promise<CommentPage> {
  const q = new URLSearchParams({ limit: '20' });
  if (cursor) q.set('cursor', cursor);
  const res = await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/comments?${q}`, getToken,
  );
  return await res.json() as CommentPage;
}

export async function listCommentReplies(
  postId: string, parentId: string, getToken: TokenGetter,
  cursor: string | null = null,
): Promise<CommentPage> {
  const q = new URLSearchParams({ limit: '20' });
  if (cursor) q.set('cursor', cursor);
  const res = await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(parentId)}/replies?${q}`,
    getToken,
  );
  return await res.json() as CommentPage;
}

export async function createFeedbackComment(
  postId: string, getToken: TokenGetter,
  body: string, audioTimestampSeconds: number | null,
  replyToCommentId: string | null,
): Promise<string> {
  const res = await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/comments`, getToken,
    {
      method: 'POST',
      body: JSON.stringify({ body, audioTimestampSeconds, replyToCommentId }),
    },
  );
  const data = await res.json() as { comment: { id: string } };
  return data.comment.id;
}

export async function deleteFeedbackComment(
  postId: string, commentId: string, getToken: TokenGetter,
): Promise<void> {
  await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    getToken,
    { method: 'DELETE' },
  );
}

export async function getPostLikes(
  postId: string, getToken: TokenGetter,
): Promise<LikeStatus> {
  const res = await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/likes`, getToken,
  );
  return await res.json() as LikeStatus;
}

export async function setPostLiked(
  postId: string, liked: boolean, getToken: TokenGetter,
): Promise<void> {
  await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/like`, getToken,
    { method: liked ? 'PUT' : 'DELETE' },
  );
}

export async function setCommentLiked(
  postId: string, commentId: string, liked: boolean,
  getToken: TokenGetter,
): Promise<void> {
  await feedbackRequest(
    `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
    getToken,
    { method: liked ? 'PUT' : 'DELETE' },
  );
}
