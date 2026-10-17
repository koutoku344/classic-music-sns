# STEP9-3 投稿Backend API 実装手順

## 実装前の確認（9-3-1）

実行場所：WSL Ubuntu、リポジトリ`~/classic-music-sns`

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

Neon SQL Editorで012適用を確認する。

```sql
SELECT to_regclass('public.posts') AS posts,
       to_regclass('public.post_media') AS post_media;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'posts'
ORDER BY indexname;
```

`posts_user_piece_created_idx`が存在しないこと。
012未適用なら`db/migrations/012_drop_unused_user_piece_posts_index.sql`を一度だけ実行。

## 9-3-2：ルーティング

- `backend/src/index.ts`は認証判定・CORS・レスポンス処理を保持。
- `backend/src/posts.ts`に投稿のルート処理を分離する。
- `GET /posts`、`GET /posts/:id`、`GET /users/:id/posts`はJWT任意。匿名を許可するが公開ユーザーの投稿しか取得できない。
- POST/PATCH/DELETEはJWT必須。
- 現状`index.ts`は公開プロフィールとカタログ以外を認証必須とし、認証後にusersへUPSERTしている。匿名投稿一覧がこのユーザー作成処理へ到達しないように順序を修正する。
- `/posts/:id`と`/posts`の判定順、無効UUID、未知メソッドの404/405を確認。
- 共有する`Sql`型は`NeonQueryFunction<false,false>`を基本とする。

## 9-3-3：POST /posts

リクエスト例：

```json
{
  "body": "今日の練習記録",
  "pieceId": null,
  "userPieceId": null,
  "commentsEnabled": true,
  "feedbackPrefs": ["感想歓迎"],
  "mediaIds": []
}
```

検証：
- `body`はtrim後2000文字以内。`body`も`mediaIds`も空なら400。
- `pieceId`、`userPieceId`は双方NULL可、同時指定不可。
- `userPieceId`は本人の`user_pieces`に存在すること。
- `mediaIds`の重複を拒否し、すべて本人所有・`ready`・`deleted_at IS NULL`の`media`に存在すること。
- 音声0〜1件、画像0〜5件、全体0〜6件。
- `mediaIds`配列の順番を`post_media.display_order`へ1始まりで保存する。
- 投稿と紐付けの更新はDB内の一つの原子的操作にする。

**重要**：Neon HTTP tagged-template clientは個別リクエストを跨いでBEGIN/COMMITしない。`sql.transaction([...])`は非対話バッチなので、事前SELECT・INSERT・ロックを複数往復で組む用途には使えない。原子的な一連の検証＋INSERTには、必要に応じてPostgreSQLのPL/pgSQL関数をマイグレーションとして追加する。投稿とメディア削除が競合しても整合性を壊さないロック順序を定める。

## 9-3-4：GET一覧・詳細

- `GET /posts?limit=20&cursor=...`は`created_at DESC, id DESC`のカーソル方式。
- `pieceId`を指定したときのみ共通マスター曲でフィルタ。
- `user_piece_id`の横断検索は実装しない。
- `GET /posts/:id`は公開範囲をDB側で判定。本人は閲覧可能、他人は`profiles.visibility = 'public'`のみ閲覧可能。
- `followers/private`は承認済みフォローが未実装のため本人のみ閲覧可能。
- 返却するメディア情報はID、種類、表示順など最低限とし、`object_key`や署名URLを返さない。
- 未公開の投稿を匿名に返さない（UIだけのフィルタは禁止）。
- 投稿者別一覧も同じ認可ルールで絞り込む。

## 9-3-5：PATCH / DELETE

- 投稿者本人以外の編集・削除を拒否する。
- PATCH時も作成時と同じバリデーションと原子的な更新を行う。
- DELETEは`posts`行の削除により`post_media`関連をCASCADE削除するが、`media`行やR2オブジェクトは削除しない。
- 編集・削除結果が他ユーザーに読み取られないか再確認する。

## 9-3-6：型チェック・デプロイ

```bash
npx tsc --noEmit
npx wrangler deploy --config backend/wrangler.jsonc
```

Frontendのデプロイは不要。Backendの変更を実際にテストするためにのみdeployする。

## 9-3-7：動作確認

- GET公開一覧は未認証200。
- 未認証POSTは401。
- 本文・媒体が空、媒体件数超過、無効UUIDは400。
- 存在しない曲・他人の登録曲・未完了／論理削除済み／他人の媒体は拒否。
- 投稿作成後、Neonで`posts`に1行、`post_media`に添付数分の行。
- 無効なmediaIdを含む作成で部分成功しない。
- 再取得・更新・削除後に整合性を確認。
- 非公開投稿は他人に表示されない。
- 参照中のmediaを削除できないようにするのはSTEP9-4で既存`media.ts`も修正。

## STEP9-4との分担

STEP9-3はメタデータCRUDと投稿可視性。STEP9-4は実際のメディアRead URLの認可と削除保護を実装する。STEP9-3だけではメディアを他人に再生させないこと。
