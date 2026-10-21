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
