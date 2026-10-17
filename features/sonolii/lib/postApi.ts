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
