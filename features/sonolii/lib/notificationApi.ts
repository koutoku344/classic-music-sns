import { API_BASE } from './repertoireApi';

export type NotificationType =
  | 'post_like' | 'post_comment' | 'comment_reply' | 'comment_like'
  | 'follow' | 'follow_request' | 'follow_accepted';

export type NotificationRow = {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  notifications: NotificationRow[];
  nextCursor: string | null;
};

export type NotificationTokenGetter = () => Promise<string | null>;

async function authorizedFetch(
  path: string,
  getToken: NotificationTokenGetter,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error('通知の確認にはログインが必要です。');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('通知APIに接続できませんでした。');
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('認証の有効期限が切れました。再ログインしてください。');
    throw new Error(`通知の処理に失敗しました（HTTP ${response.status}）。`);
  }
  return response;
}

export async function listNotifications(
  getToken: NotificationTokenGetter,
  cursor: string | null = null,
): Promise<NotificationPage> {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const response = await authorizedFetch(`/me/notifications?${query}`, getToken);
  return await response.json() as NotificationPage;
}

export async function getUnreadNotificationCount(
  getToken: NotificationTokenGetter,
): Promise<number> {
  const response = await authorizedFetch('/me/notifications/unread-count', getToken);
  const data = await response.json() as { unreadCount: number };
  if (!Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) {
    throw new Error('未読通知の応答が不正です。');
  }
  return data.unreadCount;
}

export async function markNotificationRead(
  id: string,
  getToken: NotificationTokenGetter,
): Promise<void> {
  await authorizedFetch(`/me/notifications/${encodeURIComponent(id)}/read`, getToken, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(
  getToken: NotificationTokenGetter,
): Promise<void> {
  await authorizedFetch('/me/notifications/read-all', getToken, {
    method: 'POST',
  });
}
