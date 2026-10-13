"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { ScreenName } from '../types';

type PublicProfile = {
  user_id: string;
  display_name: string;
  visibility: 'public' | 'followers' | 'private';
  restricted: boolean;
  bio?: string;
  instruments?: string[];
  region?: string | null;
};

type PublicProfileResponse = { profile: PublicProfile };
const API = 'https://sonolii-api.g57cydy6ks.workers.dev';

export default function UserProfile({
  userId,
  navigate,
}: {
  userId: string;
  navigate: (s: ScreenName, params?: Record<string, string>) => void;
}) {
  const { isLoaded, getToken } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setProfile(null);

    (async () => {
      try {
        // 未ログインでも閲覧できるAPI。認証済みなら本人判定のためJWTを送る。
        const token = await getToken();
        if (controller.signal.aborted) return;
        const response = await fetch(`${API}/profiles/${encodeURIComponent(userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (response.status === 404) {
          throw new Error('プロフィールが見つかりません（未登録の可能性もあります）');
        }
        if (!response.ok) throw new Error(`取得失敗 HTTP ${response.status}`);
        const data = await response.json() as PublicProfileResponse;
        if (!controller.signal.aborted) setProfile(data.profile);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'プロフィールを取得できませんでした');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isLoaded, getToken, userId]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <button
        type="button"
        onClick={() => navigate('community')}
        className="text-sm text-teal-700 mb-4"
      >
        ← 戻る
      </button>
      {loading && <p role="status">読み込み中...</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!loading && !error && profile && (
        <div className="bg-white rounded-2xl border border-ink-100 p-6">
          <h1 className="text-xl font-bold">
            {profile.display_name || 'プロフィール未設定'}
          </h1>
          {profile.restricted ? (
            <p className="mt-4 text-sm text-ink-500">
              このプロフィールは公開範囲が制限されています。
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm">
                {profile.instruments?.join('・') || '楽器未設定'}
              </p>
              {profile.region && (
                <p className="mt-2 text-sm">地域：{profile.region}</p>
              )}
              <p className="mt-4 whitespace-pre-wrap">{profile.bio || ''}</p>
            </>
          )}
          <p className="mt-6 text-xs text-ink-400">
            投稿・フォロー・レパートリーの表示は今後対応予定です。
          </p>
        </div>
      )}
    </div>
  );
}
