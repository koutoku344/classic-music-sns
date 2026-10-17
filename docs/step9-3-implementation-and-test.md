# STEP9-3 投稿Backend API：反映・テスト手順

作業ブランチ：`feat/step9-posts`。STEP9-2の011・012がNeonへ適用済みであることを前提とする。

## 変更済みファイル

- `db/migrations/013_save_post.sql`：投稿とメディアの原子的な保存・更新。チェックに失敗すれば投稿行ごとロールバック。
- `backend/src/posts.ts`：投稿CRUD、公開設定に基づく取得、曲別検索、カーソルページング。
- `backend/src/index.ts`：ルーター統合、公開GETの匿名アクセス、既存Clerk認証との共存。

**このファイルを作った時点ではNeon適用・TypeScript型チェック・Cloudflareデプロイは未実施。これらは以下に従って実行する。**

## 9-3-A：WSLでコード取得

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

`npx tsc --noEmit`が失敗する場合は、エラー全文と該当ファイル行番号を確認してから進む。

## 9-3-B：Neonに013を適用

Neon SQL Editorで`db/migrations/013_save_post.sql`の全文を実行する。
既にテーブルがあることを確認するだけでは不十分で、`save_post`関数が必要。

確認SQL（SELECTのみ）：

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'save_post';
```

期待：`save_post`が1行、戻り値が`uuid`。

## 9-3-C：Backend Workerをデプロイ

WSL：

```bash
npx tsc --noEmit
npx wrangler deploy --config backend/wrangler.jsonc
```

`sonolii-api`のデプロイ結果を確認する。Frontend（`sonolii-web`）は今回変更しない。

## 9-3-D：APIテスト

APIベース：`https://sonolii-api.g57cydy6ks.workers.dev`

1. 未認証で`GET /posts` → 200・`posts: []`等。
2. 未認証で`POST /posts` → 401。
3. 認証済みで本文のみ`POST /posts` → 201・`post.id`。JSON例：

```json
{
  "body": "STEP9-3 APIテスト",
  "pieceId": null,
  "userPieceId": null,
  "commentsEnabled": true,
  "feedbackPrefs": [],
  "mediaIds": []
}
```

4. 3で返ったUUIDを使い`GET /posts/:id` → 本人は200。公開プロフィールなら未認証でも200。
5. 同じUUIDの`PATCH /posts/:id`に本文変更を送信 → 200。再GETで変更後の本文を確認。
6. `POST /posts`で`body: ""`, `mediaIds: []` → 400。
7. `GET /posts?limit=1`の結果と`nextCursor`、`GET /users/:userId/posts`、マスター曲の`pieceId`検索を確認。
8. `DELETE /posts/:id` → 204。再GET → 404。
9. R2上の本人所有の`ready`メディアIDで音声・画像付き投稿を作成し、Neonの`post_media`行数と並びを確認。存在しないID・他人のID・pending・deletedのIDは拒否され、投稿が中途半端に保存されないこと。
10. プロフィールを`followers`又は`private`に変更した場合、投稿は本人のみ閲覧可・匿名は404になること。

> 本文・画像・音声の追加はBackendでのテスト。STEP9-5の投稿画面が完成するまでは画面からAPIを使った投稿はできない。

## 9-3-E：Neon SELECTでデータ確認

```sql
SELECT
  p.id, p.user_id, p.body, p.piece_id, p.user_piece_id,
  p.created_at, p.updated_at,
  COUNT(pm.media_id) AS media_count
FROM public.posts p
LEFT JOIN public.post_media pm ON pm.post_id = p.id
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT 20;
```

```sql
SELECT
  pm.post_id, pm.media_id, pm.display_order,
  m.media_type, m.upload_status, m.deleted_at
FROM public.post_media pm
JOIN public.media m ON m.id = pm.media_id
ORDER BY pm.post_id, pm.display_order
LIMIT 50;
```

## 想定するHTTPステータス

| 場面 | HTTP |
| --- | --- |
| 作成成功 | 201 |
| 一覧・詳細取得成功 | 200 |
| 更新成功 | 200 |
| 削除成功 | 204 |
| 未認証の書き込み | 401 |
| 空投稿や形式不正 | 400 |
| 無効なメディア・存在しない投稿 | 404 |
| サーバー例外 | 500 |

## STEP9-4で対応する事項

- 公開投稿を閲覧する別ユーザーに、認可後の短命R2 Read URLを発行するAPI。
- STEP8の`media.ts`に投稿参照チェックを追加し、投稿中メディアのゴミ箱移動・完全削除を拒否。
- 投稿作成／編集とメディア削除の並行処理について、ロックと整合性の検証。
- 投稿一覧の実際のデータ量での実行計画・性能確認。

**注意：STEP9-4が終わるまで他ユーザー向けのメディア再生を公開しない。**
