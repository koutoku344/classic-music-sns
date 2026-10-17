# STEP10-2 DB設計・Neon適用手順（返信・削除済み表示・コメントいいね対応）

更新日：2026-10-17
状態：**修正済みSQL 016をGitHubに保存済み。Neonは未適用。**
SQL：[016_create_post_comments_and_likes.sql](../db/migrations/016_create_post_comments_and_likes.sql)

## 1. 適用条件と影響範囲

- STEP9の011〜015マイグレーション適用済みで`public.users`、`public.posts`が存在すること。
- 初稿016は未実行という確認済み。**最新の016だけを1回実行**する。初稿を実行しない。
- 016が新規作成するのは`post_comments`、`post_likes`、`post_comment_likes`の3テーブルとそのINDEX。
- 既存の`posts`、`media`、`post_media`、R2オブジェクト、テスト投稿・音声・画像の行は変更しない。

## 2. テーブル設計

### public.post_comments

| 列 | 型 | 制約・用途 |
| --- | --- | --- |
| id | UUID | 主キー、`gen_random_uuid()` |
| post_id | UUID | NOT NULL、postsへのFK、投稿削除時CASCADE |
| user_id | UUID | NOT NULL、usersへのFK、ユーザー削除時CASCADE |
| parent_comment_id | UUID NULL | **スレッド親**のコメントID。親自身はNULL、返信は親のID |
| reply_to_comment_id | UUID NULL | **実際の返信相手**のコメントID。返信先ユーザー表示用 |
| body | VARCHAR(1000) NULL | 未削除なら必須、削除済みならNULL |
| audio_timestamp_seconds | INTEGER NULL | 親コメントのみ、0以上。削除済みではNULL |
| deleted_at | TIMESTAMPTZ NULL | 非NULLなら論理削除 |
| created_at | TIMESTAMPTZ | 作成時刻 |

`UNIQUE(post_id,id)`を自己参照の複合FK用に追加。両方の自己参照は**同じ投稿IDのコメントにしか向けられない**。親の削除をDBで物理DELETEした場合、`ON DELETE CASCADE`で返信も消えるが、通常のコメント削除APIは物理DELETEではなく論理削除するので返信は保持される。

`parent_comment_id`と`reply_to_comment_id`は親コメントでは両方NULL、返信では両方必須。自身のIDの参照はCHECKで拒否する。

**返信のDB階層は1段に固定**：親Aへの返信B、さらにBへの返信Cでも、BとCの`parent_comment_id=A`。`reply_to_comment_id=B`とすればUIに`@B`を表示できる。

**重要**：DB FKだけでは「parentは必ずルート」「reply_toは同じルート配下である」「削除済み親へ返信しない」までは保証できない。この3つはSTEP10-3のDB関数内で、ロックを取って検証する。API単独の事前SELECTだけには依存しない。

コメント削除時は `UPDATE post_comments SET body=NULL, audio_timestamp_seconds=NULL, deleted_at=now()` として墓石行を残す。削除済みコメントは閲覧レスポンスで本文／時刻を隠す。返信先が削除済みなら元ユーザー名を表示せず汎用の削除済み表現を表示する。

**返信が存在しない削除済み親の非表示**はUI/GETでフィルタする。削除済み返信は通常の返信一覧に出さない。親に生存返信が0件なら親墓石も画面から隠す。削除済み元コメントに新たな返信は禁止。既存返信の削除によって生存返信数が0になっても、親行は引き続き保持する（追加クリーンアップSQL不要）。

コメント・返信へのいいねはそのコメントが削除された際にすべて解除する（STEP10-3のDB関数で`post_comment_likes`行を同一トランザクションで削除）。削除済みへの新規いいねは禁止。

### public.post_likes

`(post_id,user_id)`を複合PKとする。FKでposts/usersを参照し、投稿／ユーザー物理削除時CASCADE。1ユーザーが1投稿につけられるいいねは1件まで。

### public.post_comment_likes

`(comment_id,user_id)`を複合PKとする。FKでpost_comments/usersを参照し、コメント／ユーザー物理削除時CASCADE。通常コメント・時刻コメント・返信に同じテーブルを使い、1ユーザー1コメント1件まで。

## 3. INDEX（重複を避ける）

| INDEX / UNIQUE | 列・条件 | 利用目的 |
| --- | --- | --- |
| post_comments_pkey（自動） | id | 単一コメント参照 |
| post_comments_post_id_unique（自動） | post_id,id | 同じ投稿内の返信親／返信先参照 |
| post_comments_roots_idx | post_id,created_at DESC,id DESC WHERE parent_comment_id IS NULL | 親コメント新しい順 |
| post_comments_replies_idx | post_id,parent_comment_id,created_at,id WHERE parent_comment_id IS NOT NULL | スレッドの返信古い順 |
| post_comments_user_idx | user_id | コメント投稿者別探索、ユーザー削除 |
| post_likes_pk（自動） | post_id,user_id | 投稿いいね重複防止／件数 |
| post_likes_user_idx | user_id | ユーザー削除 |
| post_comment_likes_pk（自動） | comment_id,user_id | コメントいいね重複防止／件数 |
| post_comment_likes_user_idx | user_id | ユーザー削除 |

計9本（コメント5、投稿いいね2、コメントいいね2）。同じ先頭キーの単独INDEXは追加しない。

## 4. Backend実装時に必要な整合性

- `create_comment()`相当のDB関数で投稿行`FOR UPDATE`→コメント受付／可視性→返信先の親子関係・削除状態→音声と時刻のチェック→INSERTを同一トランザクションで行う。
- 同じ親の返信への返信を作成するとき、parentはルートのIDに変換して保存し、reply_toには直接の返信相手IDを保存する。
- コメント削除と同時の返信／コメントいいねを許可しないよう、コメント対象行をロックして処理する。コメントを削除する主体はコメント本人またはPost投稿者。
- コメント削除時はコメントいいね行も削除する。削除済みの親は返信がある限り残し、子孫への操作を可能にする。
- 投稿編集・コメント受付OFFとの競合は投稿行ロックで整合性を保持する。DB関数で更新する場合もログインから得た`user_id`をBackendから渡し、リクエストbodyの自己申告IDは信用しない。
- 好きな投稿・コメントの閲覧許可は`profiles.visibility`に従う。匿名閲覧可否もBackendが確認。
- `comments_enabled=false`でも既存のコメントGET・いいねPUT/DELETEは利用可能。新規親／返信コメントPOSTは拒否する。
- **アカウントの物理削除に関する注意**：ユーザー削除時に所有コメントのCASCADE物理削除が実行されると、そのコメントにぶら下がる他人の返信もCASCADE削除され得る。通常の論理コメント削除とは別のケースであり、アカウント退会フロー実装前に「匿名化して墓石保持」等の処理へ見直す必要がある。このSQLだけで他人の返信を退会時に保持する保証はない。
- ネストしたSQLをNeon HTTPで複数回呼ぶだけでは原子的にならないのでDB関数で実装する。

## 5. Neon：適用前の確認（読み取りのみ）

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'posts',
    'post_comments', 'post_likes', 'post_comment_likes'
  )
ORDER BY table_name;
```

**期待**：`users`、`posts`だけ表示。3つの新テーブルのいずれかが表示された場合は016を実行せず相談する。

## 6. Neon：SQL 016適用

[016_create_post_comments_and_likes.sql](../db/migrations/016_create_post_comments_and_likes.sql) の**修正版全文**をNeon SQL Editorに貼り付け、1回だけ実行する。

全テーブルのCREATEを`BEGIN`／`COMMIT`でまとめている。既存行を削除するSQLは含まれない。

## 7. Neon：適用後の確認（読み取りのみ）

**列**

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('post_comments','post_likes','post_comment_likes')
ORDER BY table_name, ordinal_position;
```

期待：`post_comments` 9列、`post_likes` 3列、`post_comment_likes` 3列。

**制約**

```sql
SELECT
  conrelid::regclass AS table_name,
  conname, contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'public.post_comments'::regclass,
  'public.post_likes'::regclass,
  'public.post_comment_likes'::regclass
)
ORDER BY conrelid::regclass::text, conname;
```

期待：3テーブルのPK、コメントの同投稿参照用UNIQUE/FK・CHECK、各likesの重複禁止PKとFKが表示される。

**INDEX**

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('post_comments','post_likes','post_comment_likes')
ORDER BY tablename,indexname;
```

期待：コメント5本、投稿いいね2本、コメントいいね2本。

**既存データを保持**

```sql
SELECT
  (SELECT count(*) FROM public.posts) AS posts_count,
  (SELECT count(*) FROM public.media) AS media_count,
  (SELECT count(*) FROM public.post_comments) AS comments_count,
  (SELECT count(*) FROM public.post_likes) AS post_likes_count,
  (SELECT count(*) FROM public.post_comment_likes) AS comment_likes_count;
```

期待：既存投稿／メディア件数に予期しない変更なし。追加直後の新3テーブルは0行。

## 8. 次の工程

STEP10-3でDB関数とBackend API、認可、コメント削除・いいねの同時操作を実装してテストする。**今回の016の適用だけでは、論理削除や返信1階層のAPIレベルの制御はまだ動かない。**
