# STEP10-2 DB設計・Neon適用前レビュー

更新日：2026-10-17
状態：**SQLをGitHubに作成済み。Neonには未適用。**
対象SQL：[016_create_post_comments_and_likes.sql](../db/migrations/016_create_post_comments_and_likes.sql)

## 1. 前提・影響範囲

- STEP9 migration 011〜015が適用され、`public.posts`、`public.users`が存在すること。
- 新規テーブル`post_comments`と`post_likes`のみ作成する。既存の`posts`、`post_media`、`media`、R2には変更・削除を加えない。
- スキーマ作成前に既存の同名テーブルがないことを検査する。万一存在する場合は実行しない。

## 2. データモデル

```text
users [id PK]
  ├─< posts [id PK, user_id FK]   （既存）
  │     ├─< post_media           （既存）
  │     ├─< post_comments [id PK, post_id FK, user_id FK, ...]
  │     └─< post_likes [(post_id,user_id) PK, ...]
  ├─< post_comments
  └─< post_likes
```

### post_comments

| 列 | 制約 | 説明 |
| --- | --- | --- |
| id | UUID PK、default gen_random_uuid() | コメントID |
| post_id | UUID NOT NULL FK posts(id) ON DELETE CASCADE | 対象投稿 |
| user_id | UUID NOT NULL FK users(id) ON DELETE CASCADE | コメント本人 |
| body | VARCHAR(1000) NOT NULL、長さ1〜1000、トリム済み | 通常と時刻コメント共通の本文 |
| audio_timestamp_seconds | INTEGER NULL、0以上 | NULL=通常コメント、0以上=時刻コメント |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | 投稿日時 |

本文にはtrim後の値を保存する。空白のみ拒否。改行を含む本文は許可、前後空白はBackendでtrimしてDBでも検証。

### post_likes

| 列 | 制約 | 説明 |
| --- | --- | --- |
| post_id | UUID NOT NULL FK posts(id) ON DELETE CASCADE | 対象投稿 |
| user_id | UUID NOT NULL FK users(id) ON DELETE CASCADE | いいねした本人 |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT now() | 登録日時 |

`(post_id,user_id)`を複合PKとし、同じユーザーによる同じ投稿への重複いいねを禁止する。

## 3. インデックス設計

| INDEX名 | キー | 必要性 |
| --- | --- | --- |
| post_comments_pkey（自動） | id | コメント1件取得／削除 |
| post_comments_post_created_idx | post_id, created_at DESC, id DESC | 投稿詳細のコメント新着順・カーソルページング |
| post_comments_user_idx | user_id | アカウント削除時の関連コメント探索 |
| post_likes_pk（自動） | post_id, user_id | 1投稿への重複いいね禁止／いいね数COUNT／本人状態の存在確認 |
| post_likes_user_idx | user_id | アカウント削除時の関連いいね探索 |

`post_comments(post_id)`の単独INDEXや`post_likes(post_id)`の単独INDEXは作成しない。上記複合INDEX／PKの先頭キーが`post_id`であり、同種の検索に利用できるため。

## 4. CHECKとAPI/DBロックの責務

- DB：形式制約、FK、重複いいね禁止、投稿・ユーザー削除時のCASCADE。
- API：ログイン状態、閲覧権限、コメント受付ON/OFF、投稿者またはコメント本人の削除権限、紐づく音声の有無、タイムスタンプの上限。
- GETは既存の投稿可視性条件（public/owner）をコメント・いいね側でも用いる。取得件数は最大50件。
- `audio_timestamp_seconds`の上限は別テーブル`media.duration_seconds`と比較する必要があり、DB CHECKだけでは制約化しない。
- POSTコメントの前に投稿行を`FOR UPDATE`でロックして`comments_enabled`確認と追加を同一トランザクションで行うことをSTEP10-3の実装要件とする。音声添付状態は同じトランザクション内で確認する。
- `save_post()`は投稿編集時に親投稿行を`FOR UPDATE`するため、コメント時刻と添付音声の編集が競合した場合も投稿行で直列化する設計。
- **注意**：既存のネストしたSQL操作を別々のHTTPクエリで行うだけではトランザクションにならない。STEP9の`save_post()`と同様、必要ならSTEP10用DB関数を追加する。
- 既存コメントの音声が投稿編集で取り外された場合は本文・時刻データを残す。Frontendはリンク対象の音声がないとき再生ジャンプを無効にする。

## 5. 適用前確認（Neon SQL Editor、参照のみ）

```sql
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'posts', 'post_comments', 'post_likes')
ORDER BY table_name;
```

期待：`users`、`posts`のみ。もし`post_comments`または`post_likes`が出たら016は実行せず確認する。

## 6. SQL適用

GitHubの`db/migrations/016_create_post_comments_and_likes.sql`の**全文**をNeon SQL Editorに貼り、1度だけ実行する。

`BEGIN`／`COMMIT`でテーブル作成をひとまとめにする。既存テスト投稿／音声／画像の削除SQLは含まれない。

## 7. 適用後確認（Neon SQL Editor、参照のみ）

### テーブルと列

```sql
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('post_comments', 'post_likes')
ORDER BY table_name, ordinal_position;
```

期待：コメント6列、いいね3列。

### PK、FK、CHECK

```sql
SELECT
  conrelid::regclass AS table_name,
  conname,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.post_comments'::regclass, 'public.post_likes'::regclass)
ORDER BY conrelid::regclass::text, conname;
```

期待：PK、post/usersそれぞれのCASCADE FK、本文・timestampのCHECK。

### INDEX

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('post_comments', 'post_likes')
ORDER BY tablename, indexname;
```

期待：post_commentsは3本、post_likesは2本。

### 既存データ保持

```sql
SELECT
  (SELECT COUNT(*) FROM public.posts) AS existing_posts,
  (SELECT COUNT(*) FROM public.media) AS existing_media,
  (SELECT COUNT(*) FROM public.post_comments) AS comments,
  (SELECT COUNT(*) FROM public.post_likes) AS likes;
```

期待：既存投稿とメディア件数は016適用前から不変（並行するユーザー操作による増減を除く）。新しいコメント・いいねはそれぞれ0件。

## 8. 016であえて実施しないこと

- 既存のSTEP9テスト投稿・音声・画像の削除
- 既存の投稿・メディアテーブルへのALTER
- 計数専用カラム・トリガーの追加（いいね数はCOUNTで開始）
- コメント返信用`parent_comment_id`追加（後続STEP）
- ユーザー通知のためのテーブル追加（後続STEP）

## 9. 適用後の次工程

STEP10-3でBackend APIのコメント・いいね機能を実装し、可視性・コメントOFF・タイムスタンプ・同時操作を含め検証する。現段階ではFrontendから新テーブルへアクセスしない。
