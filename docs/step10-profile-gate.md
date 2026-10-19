# STEP10: プロフィール作成前のフィードバック制限

## 確定方針

- Clerk認証とプロフィール設定を別の状態として扱う。
- `POST /users/sync` は `users` 登録・ID取得のみ。**profilesの自動作成はしない**。
- **公開投稿・コメント・いいね数の閲覧は、プロフィール未設定でも可能**（公開範囲・非公開投稿の既存制約は維持）。
- **新規コメント・返信・投稿いいね・コメントいいね** は、ユーザー自身がプロフィールを保存し、表示名を設定した後で可能。
- プロフィール未設定で操作した場合、Frontendで「プロフィールを作成してください」画面へ案内し、アカウント設定へ移動できる。
- 以前自動作成された `profiles` の空欄レコードが存在しても、`length(btrim(display_name)) > 0` を満たさない限り設定済みと判定しない。
- 既に付けたいいねの**解除**と、本人または投稿者による既存コメントの**削除**は引き続き可能。履歴を管理できなくなることを防ぐ。
- 現在の最低必須項目は**表示名**。楽器、地域、自己紹介は交流する条件にしない。将来追加する場合は仕様を別途決定する。

## 変更ファイル

- `backend/src/index.ts`: `/users/sync` のプロフィール自動INSERTを削除
- `backend/src/feedback.ts`: 新規コメント・いいねの作成時にプロフィールを参照。未設定ならHTTP 403 `profile_required`
- `db/migrations/018_require_profile_for_feedback.sql`: 適用済み017を変更せず、作成/いいねのDB関数をCREATE OR REPLACE。DB関数呼出しでも未設定ユーザーの作成は禁止
- `features/sonolii/screens/PostDetail.tsx`: `/users/sync`でユーザーID、`GET /me/profile`でプロフィール設定済みを**別々に**判定
- `features/sonolii/components/PostFeedback.tsx`: 未設定時は設定案内ダイアログ、CTA
- `features/sonolii/screens/AccountSettings.tsx`: 空の表示名を保存しない
- `features/sonolii/lib/feedbackApi.ts`: `profile_required`を日本語で表示

## 最小適用手順

1. WSL：`git switch feat/step10-feedback && git pull origin feat/step10-feedback`
2. `npx tsc --noEmit && npm run build` を実行。エラーがあればそこで止める。
3. **Neon SQL Editor**で [018_require_profile_for_feedback.sql](../db/migrations/018_require_profile_for_feedback.sql) **全文を1回適用**。016・017は再実行しない。
4. `npx wrangler deploy --config backend/wrangler.jsonc` でBackendを更新。
5. `npm run deploy` でFrontendを更新。

## 最小動作確認

- **プロフィール未設定のログイン済み別アカウント**：公開投稿・コメントを閲覧可能。コメント・いいねを押すと「プロフィールを作成してください」が表示される。APIを直接呼んだ際のPOST/PUTは403 `profile_required`。
- **アカウント設定で表示名を保存後**：投稿に戻るとコメント・いいねが可能。
- **設定済みユーザー**：既存のコメント、いいね、返信が従来どおり利用可能。

## 既存データの保護

- **既存のusers/profiles/posts/post_comments/post_likes/post_comment_likes/media/R2を削除しない。**
- 以前の同期処理が作ったかもしれない空欄profiles行は、どれが自動生成でどれがユーザーが保存したものか区別できない。そのため**自動で削除しない**。次の参照SQLで候補だけ確認可能。

```sql
SELECT p.user_id, p.created_at, p.display_name
FROM public.profiles p
WHERE length(btrim(p.display_name)) = 0
ORDER BY p.created_at DESC;
```

削除の判断にはアカウントの利用状況・関連データを確認し、対象IDごとの明示的な承認が必要。今回のSQL018にはDELETE/UPDATE of existing rowsはない。
