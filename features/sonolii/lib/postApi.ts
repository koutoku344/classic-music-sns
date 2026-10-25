import { apiFetch } from './practiceApi';
import type { TokenGetter } from './mediaApi';

export type CreatePostInput = {
  body: string;
  pieceId: string | null;
  userPieceId: string | null;
  mediaIds: string[];
  feedbackPrefs: string[];
  commentsEnabled: boolean;
};

export async function createPost(
  input: CreatePostInput,
  getToken: TokenGetter,
): Promise<string> {
  const response = await apiFetch('/posts', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await response.json() as { post: { id: string } };
  return data.post.id;
}

import { API_BASE } from './repertoireApi';

export type PostMedia = {
  id: string;
  media_type: 'audio' | 'image';
  mime_type: string;
  duration_seconds: number | null;
  display_order: number;
};

export type PostRow = {
  id: string;
  user_id: string;
  piece_id: string | null;
  user_piece_id: string | null;
  body: string;
  comments_enabled: boolean;
  feedback_prefs: string[];
  created_at: string;
  updated_at: string;
  display_name: string;
  like_count?: number;
  comment_count?: number;
  composer_name: string | null;
  piece_title: string | null;
  media: PostMedia[];
};

async function publicFetch(path: string, getToken: TokenGetter): Promise<Response> {
  // An optional bearer token lets the owner view their own private posts.
  const token = await getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error('投稿APIに接続できません。');
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error('投稿が見つからないか、閲覧できません。');
    throw new Error(`投稿を読み込めません（HTTP ${response.status}）。`);
  }
  return response;
}

export type PostPage = { posts: PostRow[]; nextCursor: string | null };

export async function listPosts(
  getToken: TokenGetter,
  cursor: string | null = null,
  pieceId: string | null = null,
  keyword: string = "",
): Promise<PostPage> {
  const qs = new URLSearchParams({ limit: '20' });
  if (cursor) qs.set('cursor', cursor);
  if (pieceId) qs.set('pieceId', pieceId);
  if (keyword.trim()) qs.set('q', keyword.trim());
  const response = await publicFetch(`/posts?${qs}`, getToken);
  return await response.json() as PostPage;
}

export async function listUserPosts(
  userId: string,
  getToken: TokenGetter,
  cursor: string | null = null,
): Promise<PostPage> {
  const qs = new URLSearchParams({ limit: '20' });
  if (cursor) qs.set('cursor', cursor);
  const response = await publicFetch(
    `/users/${encodeURIComponent(userId)}/posts?${qs}`,
    getToken,
  );
  return await response.json() as PostPage;
}

export async function getPost(id: string, getToken: TokenGetter): Promise<PostRow> {
  const response = await publicFetch(`/posts/${encodeURIComponent(id)}`, getToken);
  const data = await response.json() as { post: PostRow };
  return data.post;
}

export async function postMediaReadUrl(
  postId: string,
  mediaId: string,
  getToken: TokenGetter,
): Promise<string> {
  const token = await getToken();
  const response = await fetch(
    `${API_BASE}/posts/${encodeURIComponent(postId)}/media/${encodeURIComponent(mediaId)}/read-url`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'このメディアを閲覧できません。'
      : `メディアURLの取得に失敗しました（HTTP ${response.status}）。`);
  }
  const data = await response.json() as { readUrl: string };
  return data.readUrl;
}

export async function updatePost(
  id: string,
  input: CreatePostInput,
  getToken: TokenGetter,
): Promise<void> {
  await apiFetch(`/posts/${encodeURIComponent(id)}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePost(id: string, getToken: TokenGetter): Promise<void> {
  await apiFetch(`/posts/${encodeURIComponent(id)}`, getToken, {
    method: 'DELETE',
  });
}
