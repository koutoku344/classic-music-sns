# STEP11-4-5 通知カードの遷移と戻る動作

2026-10-21：GitHub実装済み、未デプロイ。

## 今回の決定・実装

- 通知カード全体をクリック／Enter・Spaceで開く。独立した「投稿を見る」「プロフィールを見る」は削除。
- `follow` / `follow_request` / `follow_accepted` は通知の相手のプロフィールへ。
- `post_like` / `post_comment` / `comment_reply` / `comment_like` は対象投稿へ。
- 表示許可のない相手・削除されたコメント・アクセス不可の投稿は既存Backendが遷移先をnullにするため、カードをクリック不可にする。
- カード内の「既読」ボタンは既読処理だけ行い、画面遷移させない。
- 通知から開いたPostDetailまたはUserProfileの「戻る」は通知一覧へ戻る。ブラウザ標準の戻るも通常の履歴遷移で通知一覧へ戻る。
- 投稿とプロフィールから通常遷移した場合は以前の戻り先を維持。

## 変更範囲

- `features/sonolii/screens/Notifications.tsx`
- `app/_components/RouteScreen.tsx`
- `features/sonolii/screens/PostDetail.tsx`
- `features/sonolii/screens/UserProfile.tsx`
- `tests/integration/notification-navigation.test.mjs`

## 一括確認

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --test tests/integration/notification-navigation.test.mjs
npx tsc --noEmit
npm run build
```

全て成功したらFrontendのみを更新：

```bash
npm run deploy
```

Backend、Neon、Cronは変更不要。

ブラウザで次の3点を確認：

1. フォロー系通知のどこかをクリック → プロフィール → 画面内「戻る」→通知一覧
2. コメント・いいね系通知をクリック → 投稿詳細 → 画面内「戻る」→通知一覧
3. ブラウザ標準「戻る」でも通知一覧へ戻る。既読ボタンでは画面遷移しない

見つからない／権限切れの通知はクリック不可が正常。

## フォロー承認・却下UI

Backendのフォロー申請承認/却下APIはSTEP11で既に実装済み。
しかしUI（申請一覧と承認・却下ボタン）は未実装。通知からプロフィールを開く今回の対応とは独立に、**次工程 STEP11-5：フォロー申請管理UI**として実装する。通知カードに承認ボタンを埋め込むかどうかは仕様検討のうえ決める。
