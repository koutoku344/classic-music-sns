"use client";

import { useAuth, UserButton } from "@clerk/react";

export default function AuthStatus() {
  const { isLoaded, isSignedIn } = useAuth();

  // Clerkの認証状態を取得するまで表示しない
  if (!isLoaded) {
    return null;
  }

  // 未ログインの場合
  if (!isSignedIn) {
    return (
      <a href="/auth" className="text-sm text-teal-700">
        ログイン
      </a>
    );
  }

  // ログイン済みの場合
  return <UserButton afterSignOutUrl="/auth" />;
}