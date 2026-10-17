# STEP10 フィードバック・交流機能：確定仕様・実装計画

更新日：2026-10-17
ブランチ：`feat/step10-feedback`
状態：STEP10-1 仕様確定／STEP10-2 SQL設計更新（Neon未適用）

## 1. STEP10-1：確定仕様

- 投稿への**通常コメント**、音声の**タイムスタンプコメント**、コメントへの**返信**、**投稿とコメント・返信へのいいね**を実装。
- コメント返信は**表示上1階層のみ**。返信への返信は同じ親コメントの下に置き、元の返信相手の表示名（例：`@ユーザーB`）を表示する。
- コメント削除可能者はそのコメント本人または投稿者。削除後は本文・音声時刻をDBでNULLにし、返信が残っていれば「削除されたコメントです」と表示する（論理削除）。
- 削除済みコメントに返信がなくなった場合は画面から非表示。削除済みコメントへの**新規返信は拒否**する。
- `posts.comments_enabled=false`は新規の親コメント・返信を両方拒否する。既存のコメント・返信・いいねは表示し、いいねはON/OFFに関係なく可能。
- 時刻指定は**親コメントのみ**。音声の現在の再生位置をワンタップで添付し、返信では時刻を設定できない。
- 親コメントは**新しい順**、それぞれの返信は**古い順**。
- いいね対象は投稿・通常コメント・タイムスタンプコメント・返信。ユーザーごとに対象1件につき1いいね。解除可能。
- コメント返信へのさらに深い**DB階層**は作らない。通知・フォローは後続STEP。

## 2. 表示モデルと削除

```text
親A「ここが良かった」     timestamp: 1:23
 ├ 返信B「同感です」       parent=A, reply_to=A
 └ 返信C「@B 私もです」    parent=A, reply_to=B

親Aを削除：
親A「削除されたコメントです」  body=NULL, timestamp=NULL, deleted_at=現在時刻
 ├ 返信B「同感です」
 └ 返信C「@B 私もです」

返信B/Cとも削除：
親Aは画面に表示しない（DBの墓石行は保持）
```

**返信先ユーザー名は保存せず、`reply_to_comment_id`のコメント投稿者プロフィールから取得**する。返信先が削除済みの場合は個人名を表示せず「削除されたコメントへの返信」等の汎用表現とする。

削除済みコメントと返信は投稿自体の削除時に`ON DELETE CASCADE`で削除する。コメント論理削除の時点では他ユーザーの返信を消さない。

通常のコメント削除時、当該コメントへのいいねは解除して計数ゼロ扱い（STEP10-3で同一トランザクションにて行削除）。返信を残すためコメント行は残る。

## 3. API設計案（STEP10-3）

| Method | Path | 内容 |
| --- | --- | --- |
| GET | `/posts/:postId/comments?limit=20&cursor=...` | 閲覧可能な親コメントを新着順でページング。親ごとの返信は古い順、必要なら別ページング |
| GET | `/posts/:postId/comments/:commentId/replies?limit=20&cursor=...` | 指定親の返信一覧を古い順でページング |
| POST | `/posts/:postId/comments` | 親作成、または`parentCommentId`＋`replyToCommentId`を伴う返信作成 |
| DELETE | `/posts/:postId/comments/:commentId` | コメント本人か投稿者のみ。本文・時刻消去・論理削除 |
| GET | `/posts/:postId/likes` | 投稿いいね数＋本人状態 |
| PUT / DELETE | `/posts/:postId/like` | 投稿いいね登録・解除（冪等） |
| GET | `/posts/:postId/comments/:commentId/likes` | コメントいいね数＋本人状態 |
| PUT / DELETE | `/posts/:postId/comments/:commentId/like` | コメント・返信いいね登録・解除（冪等） |

新規書込み（いいね含む）はログイン必須。読み取りは投稿の公開範囲（`profiles.visibility`のpublic／本人）に従う。現在のfollowers/privateは本人のみ。

本文：trim後1〜1000文字、時刻は0以上整数、音声の存在と`duration_seconds`内にあることをBackendで検証。音声のない投稿に時刻は付けられない。返信の時刻はNULL必須。

レスポンスは`deleted_at`付きコメントの`body`をNULLで返し、削除済みの元投稿者情報を表示しない。コメント数・いいね数は最初はCOUNT集計（必要時に最適化）。

## 4. DB・同時操作の重要事項

[STEP10-2 DB設計](step10-2-db-design.md) と [SQL 016](../db/migrations/016_create_post_comments_and_likes.sql) を参照。

- `post_comments.parent_comment_id`＝スレッドの親（常にトップレベルコメント）
- `post_comments.reply_to_comment_id`＝実際に返信操作を行った相手のコメント
- `post_comments.deleted_at`＝削除時刻。削除時本文・音声時刻をNULLにする
- `post_likes`＝投稿いいね、`post_comment_likes`＝コメント・返信いいね
- DB外部キーで`parent/reply_to`が同じ投稿に属することを保証。**親がルートか**、**reply_toが同一スレッドか**はDBの単純CHECKでは表せないため、STEP10-3で同一トランザクション＋ロック付き検証を実装。
- 投稿編集とコメント作成、コメント削除と返信作成の競合をロックで直列化。Frontendのメニュー非表示は認可の代わりにしない。
- 現在のNeon HTTP利用方法ではSQL文を別リクエストで順に実行しても原子性は得られない。STEP9と同様のDB関数方式を採用する。

## 5. フロントエンド

投稿詳細にいいね・コメントを追加。時刻付き親コメントは時刻をタップして音声プレイヤーを移動させる。返信ボタンを押すと同じスレッドに返信入力欄を出し、返信先を表示する。削除確認後は墓石表示に切り替える。

## 6. 費用・運用・データ保持

DBのコメント・いいねレコード／INDEXが増えるが、R2オブジェクトは増やさない。連投防止・ページング・読み取りの集計クエリ効率・XSS表示対策・認可をSTEP10-3/4で確認。

既存のSTEP9テスト投稿、音声、画像、Media/R2データは**削除しない**。016は新規テーブル3つ（post_comments、post_likes、post_comment_likes）だけ作成。

## 7. 実装順

STEP10-1確定 → STEP10-2 SQL 016作成（Neon未適用） → STEP10-3 Backend API/DBトランザクション → STEP10-4 Frontend → STEP10-5総合テスト → STEP10-6設計書更新とmainマージ。
