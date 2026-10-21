# STEP11-3-5: コメント・いいね通知生成

状態：SQLをGitHubに作成済み、Neonでは**未実行**。Backendの再デプロイ不要。

## 変更ファイル

`db/migrations/022_feedback_notification_triggers.sql`

## 動作

| 新規行の挿入先 | トリガー | 通知先 | 種類 |
| --- | --- | --- | --- |
| `post_comments` | `AFTER INSERT` | 投稿者（コメント者が別人の場合） | `post_comment` |
| `post_comments`（返信） | `AFTER INSERT` | 返信対象コメント者 | `comment_reply` |
| `post_likes` | `AFTER INSERT` | 投稿者（自分へのいいねは除外） | `post_like` |
| `post_comment_likes` | `AFTER INSERT` | コメント者（自分へのいいねは除外） | `comment_like` |

返信先のコメント者と投稿者が同一なら返信通知1件に統合。異なるなら返信先コメント者と投稿者にそれぞれ通知。削除や既存レコード更新では作動しない。

同じトランザクションで通知を書き込むため、フィードバックの挿入自体が失敗すれば通知も作られない。既存レコードへのバックフィルは行わない。いいねを一度取り消して改めて付けると新しいイベントとして再通知される。

このマイグレーションは既存テーブルのデータ削除や構造変更を行わない。ただし**新しいフィードバック書き込み時には notifications へのINSERTが増える**。通知テーブルと利用者の所有情報への外部キーが前提。

## 手動適用前の確認

1. Neon SQL Editorで適用するDBブランチを確認する。
2. `post_comments` に `id, post_id, user_id, reply_to_comment_id, deleted_at`、`post_likes` に `post_id, user_id`、`post_comment_likes` に `comment_id, user_id` があることを確認する。
3. SQLの `BEGIN; ... COMMIT;` をまるごとNeon SQL Editorで実行する。**SQLはまだ実行しないでください。次の確認で適用可否を判定します。**

## 適用後の動作確認（将来）

Dedicated test accounts A/B and B-owned test post only. Create one fresh comment from A, verify B's `post_comment` notification; add one fresh post like, verify B's `post_like` notification. For reply/comment likes, create a dedicated reply/like fixture and inspect recipients. Assert no notification for self-action; repeated idempotent PUT must not increase count. Restore only test-owned data. Deleted comments remain soft-deleted and historical notifications may remain.

## 次の工程

安全な確認SQLとPlaywright通知生成テストを用意し、移行SQL適用前のレビューを行う。

## STEP11-3-5-3：Playwright通知生成テスト（2026-10-21追加）

対象：`tests/playwright/notifications-feedback.spec.mjs`。実装済み、**API書き込みテストは未実行**。

1. フォローが必要ならA→Bの申請・承認を行う（そのフォロー通知は検証基準から除外）。
2. Bの通知一覧（最新50件）と未読件数を読み取り基準にする。
3. AがBの投稿に新規コメントし、いいねする。
4. Bの通知一覧で新規 `post_comment` と `post_like` を各1件確認し、未読件数が2増えることを確認。
5. 同じいいねを再度PUTして通知が増えないことを確認。
6. 今回追加したいいね、コメント（論理削除）、フォローのみ後片付けする。

### 前提

- **公開リリース前の現行Worker限定**。他の操作を並行実行しない。
- テスト専用A/BユーザーとB所有投稿を使用する。Bのプロフィールは `followers`、投稿はコメント許可。
- **Aが対象投稿を既にいいねしていないこと**。既存のいいねを削除してテスト開始することはない。
- フォロー状態は `null` または `accepted`。過去の `rejected` が `null` として返る場合があるため、専用アカウントの既存状態を確認する。
- 通知一覧は最大50件の最新ページを比較する。大量の通知が並行生成される状況では実行しない。
- 通知生成履歴は**削除しない**。コメントは論理削除され、失敗・通信断時に後片付けが不完全になる可能性がある。

### コード取得

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --check tests/playwright/notifications-feedback.spec.mjs
```

### 実行前の環境変数

前回のPlaywrightテストと同じ以下の環境変数を使用する。秘密鍵やメールアドレスをチャット・GitHubに貼らないこと。

```bash
# 前回と同じClerkのキー・テストアカウントA/Bのメールアドレスも設定
export SONOLII_TEST_PHASE=PRE_RELEASE
export SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES
export SONOLII_TEST_API_URL=https://sonolii-api.g57cydy6ks.workers.dev
export SONOLII_TEST_OWNER_ID='BのSonoliiユーザーUUID'
export SONOLII_TEST_POST_ID='Bの投稿UUID'
```

### 実行（Neonに書き込みます）

```bash
npm run test:playwright:notifications-feedback
```

期待結果：`clerk-setup` と通知生成テストの **2 passed**。この結果は未確認で、ユーザー側実行後に確認する。

### このテストの対象外

- コメント返信、コメントへのいいね、自分自身の投稿・コメントに対する操作の通知挙動。
- 他人の通知の既読変更を含む通知APIの書き込み検証。
- 既読30日後の通知物理削除。

これらは追加の専用テストで検証する。
