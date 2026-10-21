# STEP11-2 フォロー・通知 DB詳細設計（SQL 019）

更新日：2026-10-20
ブランチ：`feat/step11-follow-notifications`
状態：**STEP11-2仕様確定・SQL019をGitHubに保存済み。Neon未適用、Backend/Frontend未実装。**

## 1. STEP11-1から引き継ぐ確定仕様

| `profiles.visibility` | フォロー成立 | プロフィール詳細・投稿・コメント閲覧 |
| --- | --- | --- |
| `public` | 即時 | 全員 |
| `followers` | 申請→本人承認 | 本人＋承認済みフォロワー |
| `private` | 申請→本人承認 | 本人のみ（承認済みでも閲覧不可） |

未ログイン閲覧は従来どおり公開投稿のみ。
`private`のユーザーが承認しても投稿は公開されない。承認済みフォロワーが`followers`設定になったときのみ閲覧可能となる。

フォロー解除・自分へのフォロー禁止・申請取り消し・承認・拒否・承認済みフォロワーの削除に対応。
フォロー関係と公開範囲は別概念。公開範囲の変更で関係を自動削除・自動承認しない。

通知はアプリ内のみ。投稿いいね・コメント・コメントへの返信・コメントいいね・新規フォロー・フォロー申請・承認を対象とする。自分への通知は生成せず、重複イベントを通知しない。

## 2. テーブル設計

### 2-1. `public.follows`

| 列 | 型 | 用途 |
| --- | --- | --- |
| `id` | UUID PK | フォロー関係のID |
| `follower_id` | UUID NOT NULL | 申請・フォローする側。`users(id)` FK |
| `followee_id` | UUID NOT NULL | 申請を受ける側。`users(id)` FK |
| `status` | VARCHAR(16) | `pending / accepted / rejected` |
| `requested_at` | TIMESTAMPTZ | 最終申請日時 |
| `accepted_at` | TIMESTAMPTZ NULL | 承認済みになった日時 |
| `rejected_at` | TIMESTAMPTZ NULL | 拒否日時 |
| `updated_at` | TIMESTAMPTZ | 最終状態更新日時 |

`UNIQUE(follower_id,followee_id)`で同方向の重複を禁止。相互フォローは別レコードとして許可。
`CHECK(follower_id<>followee_id)`で自己フォロー禁止。`status`と日時の整合性をCHECK。ユーザー物理削除時の関係はCASCADE（退会フロー設計とは別）。
`rejected`行は状態履歴と再申請時の更新対象として保持する。**拒否後はいつでも再申請可能**とし、`rejected → pending`に更新する。画面では拒否済みを申請者へ通知・表示しない。連続リクエストの乱用はSTEP11-3の認証ユーザー単位のレート制限で対処し、再申請までの待機時間は設けない。

### 2-2. `public.notifications`

| 列 | 型 | 用途 |
| --- | --- | --- |
| `id` | UUID PK | 通知ID |
| `recipient_user_id` | UUID NOT NULL | 通知を受けるユーザー |
| `actor_user_id` | UUID NULL | 通知の原因となるユーザー |
| `type` | VARCHAR(32) | 投稿いいね、投稿コメント、返信、コメントいいね、フォロー、申請、承認 |
| `event_key` | VARCHAR(240) UNIQUE | 通知重複防止の一意キー |
| `post_id` | UUID NULL | 投稿へ遷移する場合の対象 |
| `comment_id` | UUID NULL | コメント関連の対象 |
| `follow_id` | UUID NULL | フォロー申請等の対象 |
| `created_at` | TIMESTAMPTZ | 通知生成日時 |
| `read_at` | TIMESTAMPTZ NULL | 既読日時 |

`recipient_user_id`はユーザー削除時CASCADE。`actor_user_id`・投稿・コメント・フォローが物理削除された場合は、通知のリンク参照だけNULLにする（`ON DELETE SET NULL`）。
表示時は現行の公開範囲で認可を再判定し、アクセスできない対象の本文を見せない。DB通知行にコメント本文・非公開投稿本文は保存しない。

**通知の重複防止ルール**：各操作でBackendが決定的な`event_key`を生成し、`INSERT ... ON CONFLICT DO NOTHING`。
例：`post-like:{postId}:{actorId}:{recipientId}`（再いいねで再通知しない）、
`post-comment:{commentId}:{recipientId}`、
`comment-reply:{commentId}:{recipientId}`、
`follow-request:{followId}:{requestedAt}:{recipientId}`、
`follow-accepted:{followId}:{acceptedAt}:{recipientId}`。
通知本文は生成時に持たず、閲覧時に必要な表示名等を参照。
再試行での多重通知を回避。複数の通知対象者がいる場合は受信者IDを必ず含める。

## 3. 状態遷移（STEP11-3でDB関数化）

| 操作 | 直前 | 直後 | 注意 |
| --- | --- | --- | --- |
| 公開相手をフォロー | 未存在 | accepted | `accepted_at`設定 |
| followers/private相手へ申請 | 未存在 | pending | `requested_at`設定 |
| 申請承認 | pending | accepted | 申請された本人のみ |
| 申請拒否 | pending | rejected | `rejected_at`設定 |
| 申請取り消し | pending | 行削除 | 申請者本人のみ |
| フォロー解除 | accepted | 行削除 | フォローした本人のみ |
| フォロワー削除 | accepted | 行削除 | フォローされた本人のみ |
| 拒否後の再申請 | rejected | pending | いつでも再申請可能。requested_atを更新し、rejected_atをNULLにする |

**確定**：拒否後の再申請にクールダウンは設けない。拒否理由を申請者に表示しない。再申請APIの冪等性・レート制限はSTEP11-3で実装する。
承認・拒否・取り消し・公開範囲変更が競合しても、不正な遷移にならないよう`follows`行を`FOR UPDATE`でロックする。申請生成時は`UNIQUE`を使った競合回避と、相手プロフィール公開範囲の同一トランザクション内確認が必要。
**公開範囲変更をまたぐ競合**は相手のプロフィール行のロック順と合わせて設計する。Neon HTTP別々の呼び出しでは原子性が保証されないため、STEP10と同じDB関数方式を採用。

## 4. インデックス設計

| INDEX / UNIQUE | 対象 | 検索用途 |
| --- | --- | --- |
| `follows_pkey` | id | ID参照 |
| `follows_pair_unique` | follower_id,followee_id | 既存関係・重複防止 |
| `follows_followee_status_idx` | followee_id,status,requested_at DESC,id DESC | 申請一覧、フォロワー |
| `follows_follower_accepted_idx` | follower_id,followee_id（accepted限定） | フォロー中の投稿一覧 |
| `notifications_pkey` | id | 通知単体操作 |
| `notifications_event_key_unique` | event_key | 二重通知防止 |
| `notifications_recipient_created_idx` | recipient_user_id,created_at DESC,id DESC | 通知一覧・カーソル |
| `notifications_recipient_unread_idx` | 同上、read_at IS NULL | 未読件数 |
| `notifications_actor_idx` | actor_user_id（非NULLのみ） | FK削除時 |
| `notifications_post_idx` | post_id（非NULLのみ） | FK削除時 |
| `notifications_comment_idx` | comment_id（非NULLのみ） | FK削除時 |
| `notifications_follow_idx` | follow_id（非NULLのみ） | FK削除時 |

主キー・UNIQUEで自動作成されるインデックスに重複する単独`follower_id`インデックスを増やさない。初期負荷は小さいが、通知の件数・既読比率が増加した段階でEXPLAIN ANALYZEで再評価。

## 5. Backend API設計（STEP11-3で実装予定）

| Method | Path | 内容 |
| --- | --- | --- |
| PUT | `/users/{id}/follow` | 即時フォローまたは申請 |
| DELETE | `/users/{id}/follow` | 自分の申請取り消し／フォロー解除 |
| GET | `/me/follow-requests` | 自分宛の申請 |
| POST | `/me/follow-requests/{followId}/accept` | 承認 |
| POST | `/me/follow-requests/{followId}/reject` | 拒否 |
| DELETE | `/me/followers/{userId}` | フォロワー削除 |
| GET | `/me/following` | 自分のフォロー中一覧 |
| GET | `/users/{id}/followers` | 閲覧可能範囲のフォロワー一覧 |
| GET | `/posts?feed=following` | フォロー中の閲覧可能な投稿 |
| GET | `/me/notifications` | 自分宛通知一覧・カーソル |
| PATCH | `/me/notifications/{id}/read` | 通知既読 |
| POST | `/me/notifications/read-all` | 全既読 |
| GET | `/me/notifications/unread-count` | 未読件数 |

入力されたIDだけで本人と判断しない。Clerk JWT→Sonolii `users.id`で認可。プロフィール閲覧、投稿一覧・詳細、コメント・いいね、R2署名URLのすべてに同じ可視性判定を適用すること。現行の投稿・フィードバック・プロフィールAPIでは`followers/private`が本人限定のため、STEP11-3では該当する各経路を横断的に修正する必要がある。
申請の存在や受信者を外部に漏らさない。非公開ユーザーの詳細を許可しない場合でも申請ボタンに必要な最小限の公開情報は残す（詳細はSTEP11-4）。

## 6. 通知生成の整合性

- フォロー申請・承認は状態変更と通知を同一DBトランザクションで処理。
- コメント・いいねは既存の`create_post_comment`・`set_post_like`・`set_post_comment_like` DB関数と通知挿入を1トランザクションにまとめる。別のNeon HTTPクエリを順次呼ぶだけでは不十分。
- 通知は「操作が成立した場合のみ」生成。二重PUTや再送で新しい通知を増やさない。
- 自分自身への通知は作成しない。返信先と投稿者が同一人なら1通知にまとめる。
- 通知のリンク先を閲覧するたびに最新の公開範囲を判定する。本文は通知に保存しない。
- **既読通知は既読日時 `read_at` から30日間保持し、期限到来後に削除**する。未読通知はこの30日削除の対象外とする。削除ジョブはSTEP11-3/運用設計で実装し、失敗時の再試行と監視を設ける。今回のMigrationには自動削除を含めない。

## 7. SQL 019の安全性・適用前確認

SQL：[019_create_follows_and_notifications.sql](../db/migrations/019_create_follows_and_notifications.sql)

**仕様が確定したため、次の手順でNeonに適用可能**。適用前は既存DBとR2に変更なし。SQL019は`BEGIN`／`COMMIT`内で新規2テーブルとインデックスを作るだけ。既存データの`DELETE`、`UPDATE`、`DROP`はない。

適用前にNeonで読み取り確認：

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('follows', 'notifications')
ORDER BY table_name;
```

期待：0行。すでにある場合は**SQL019を実行せず**既存定義との重複を確認する。

### 適用手順（STEP11-2）

1. Neon SQL Editorで上記の事前SELECTを実行し、0行であることを確認する（1行でもあれば中止）。
2. GitHubの `db/migrations/019_create_follows_and_notifications.sql` の **BEGINからCOMMITまで全文を1回だけ実行**する。
3. 次のSELECTを実行し、2つのテーブル・制約・INDEXが正しく作成されたことを確認する。既存レコードの削除や更新はしない。
4. すべて正常ならSTEP11-2完了とし、STEP11-3でDB関数とBackend APIを実装する。

**テーブル・レコード確認：**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('follows', 'notifications')
ORDER BY table_name;

SELECT
  (SELECT count(*) FROM public.follows) AS follows_count,
  (SELECT count(*) FROM public.notifications) AS notifications_count;
```

期待：テーブルは `follows`、`notifications` の2件。新規テーブルのレコード件数はともに0件。

**制約の確認：**

```sql
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'public.follows'::regclass,
  'public.notifications'::regclass
)
ORDER BY conrelid::regclass::text, conname;
```

期待：各テーブルのPK、FK、CHECK、UNIQUE制約が表示される。

**インデックスの確認：**

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('follows', 'notifications')
ORDER BY tablename, indexname;
```

期待：`follows`4本（PK・UNIQUE・明示的INDEX2本）、`notifications`8本（PK・UNIQUE・明示的INDEX6本）。

`019` の適用だけではフォローや通知APIは使えない。レート制限・状態遷移・通知削除の実行処理もSTEP11-3以降で実装する。

## 8. 確認事項

公開範囲、申請承認制、private本人限定は確定済み。
**確定事項**：拒否後の再申請はいつでも可能。既読通知は `read_at` から30日間保持し、期限到来後に削除。未読通知は対象外。追加の確認待ち事項なし。
