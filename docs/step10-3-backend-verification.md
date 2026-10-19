# STEP10-3 Backend API 適用・検証手順

作業ブランチ：`feat/step10-feedback`
前提：STEP10-2のSQL 016はNeonに適用済み（ユーザー確認済み）。
**既存STEP9テスト投稿・音声・画像は削除しない。**

## 1. 今回の変更

- `db/migrations/017_post_feedback_functions.sql`：コメント作成、論理削除、投稿／コメントへのいいね操作をDB関数で原子的に処理。
- `backend/src/feedback.ts`：フィードバックAPI、権限・一覧・ページング・レスポンス。
- `backend/src/index.ts`：新ルートに振り分け、PUTのCORS許可。
- `016`は再実行しない。STEP9のSQL 011〜015も再実行しない。

## 2. API仕様（STEP10-3）

| Method | Path | 認証 | 内容 |
| --- | --- | --- | --- |
| GET | /posts/:id/comments | 任意 | 親コメント新着順、既存の返信を持つ削除済み親は墓石表示 |
| GET | /posts/:id/comments/:commentId/replies | 任意 | 親の返信古い順。削除済み返信は非表示 |
| POST | /posts/:id/comments | 必須 | 親コメント、タイムスタンプ付き親、または返信の作成 |
| DELETE | /posts/:id/comments/:commentId | 必須 | 自身／投稿者の論理削除、返信は保持 |
| GET | /posts/:id/likes | 任意 | 投稿いいね数・本人状態 |
| PUT / DELETE | /posts/:id/like | 必須 | 投稿いいね登録／解除 |
| GET | /posts/:id/comments/:commentId/likes | 任意 | コメントいいね数・本人状態 |
| PUT / DELETE | /posts/:id/comments/:commentId/like | 必須 | コメントいいね登録／解除 |

POST Body：

```json
{ "body": "素敵な演奏です", "audioTimestampSeconds": null, "replyToCommentId": null }
```

- 返信を作成する際は`replyToCommentId`に直接の返信相手ID（親または返信）を指定する。Backend DB関数は同じルート親を解決する。
- 親コメントでのみ`audioTimestampSeconds`を指定可能。時刻は整数秒、音声がreadyかつ長さが取得できる場合、`0 <= 時刻 < duration_seconds`。
- 投稿が`comments_enabled=false`なら新規コメント・返信は409`comments_disabled`。閲覧といいねは可能。
- レスポンスの`nextCursor`がある場合のみ次ページを取得する。親は新しい順、返信は古い順。
- 書き込みはClerk認証必須。読み取りは投稿のvisibility制御（publicまたは本人）。
- 投稿へのいいねとコメントへのいいねはそれぞれ1人1対象1件。PUT/DELETEは冪等で204。
- 論理削除の直後はbody/timestampをNULL、like件数は0。返信が残った削除親は「削除されたコメントです」としてFrontendに表示する。
- コメント・返信が削除済みになった場合、GET結果からそのユーザーの表示名を除外。削除済み返信先は`reply_to_display_name=null`。

## 3. WSL：最新版を取得して静的検証

```bash
cd ~/classic-music-sns
git switch feat/step10-feedback
git pull origin feat/step10-feedback
git status
npx tsc --noEmit
npm run build
```

**注意**：この手順は静的チェックで、APIが公開されたという意味ではない。エラーが発生したら次へ進まず全文を共有する。

## 4. Neon：017適用前（参照のみ）

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('post_comments','post_likes','post_comment_likes')
ORDER BY table_name;
```

期待：3テーブルが存在（016完了）。

```sql
SELECT proname
FROM pg_proc
JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
WHERE n.nspname='public'
  AND proname IN (
    'create_post_comment','delete_post_comment',
    'set_post_comment_like','set_post_like'
  )
ORDER BY proname;
```

期待：017適用前なら0行。すでに4行ある場合は再実行せず相談する。

## 5. Neon：017適用

GitHubの`db/migrations/017_post_feedback_functions.sql`**全文**をNeon SQL Editorで1回実行する。

`BEGIN`〜`COMMIT`の間で関数4つを作成する。
**CREATE OR REPLACE FUNCTIONのみ**で既存投稿／メディアを変更・削除しない。

適用後に上記`pg_proc`の確認SQLで4件を検証する。

## 6. Backendのデプロイ

SQL017が正常に適用され、TypeScriptのチェックに成功した場合に限り実行。
実行場所：WSL Ubuntu。

```bash
cd ~/classic-music-sns
npx wrangler deploy --config backend/wrangler.jsonc
```

Frontendの`npm run deploy`は**実行しない**。このSTEPでFrontendコードは変更していない。
デプロイエラーが出たら`fetch failed`等の過去のネットワーク障害と区別するためログを記録。

```bash
curl -i https://sonolii-api.g57cydy6ks.workers.dev/health
```

期待：HTTP 200、`{"status":"ok","service":"sonolii-api"}`。

## 7. ブラウザからの非破壊テスト

Chrome → Sonoliiにログイン → F12 → Console。
以下はログイン中のアカウントから見える**既存投稿を読むだけ**。

```javascript
(async () => {
  const API = "https://sonolii-api.g57cydy6ks.workers.dev";
  const token = await window.Clerk.session.getToken();
  const headers = { Authorization: `Bearer ${token}` };
  const postsResponse = await fetch(`${API}/posts?limit=10`, { headers });
  const postsData = await postsResponse.json();
  const postId = postsData.posts?.[0]?.id;
  if (!postId) return console.log("閲覧可能な投稿がありません");

  for (const path of [
    `/posts/${postId}/comments`,
    `/posts/${postId}/likes`
  ]) {
    const result = await fetch(API + path, { headers });
    console.log(path, result.status, await result.json());
  }
})();
```

期待：両APIとも200。まだSTEP10のコメント・いいねを登録していなければコメント0件、いいね0件。

書き込み系のテストは確認用の投稿を選んでから別途実施する。既存コメントの削除や既存投稿のDELETEは行わない。

## 8. 未完了の検証（STEP10-3 / STEP10-5）

- コメント登録・返信・返信への返信・削除墓石・いいね／解除。
- 他アカウント認可、匿名表示、private/followers表示。
- 投稿コメント受付OFFと新規返信の競合。
- 同時いいね、同時削除と新規返信／いいねのロック。
- 親・返信カーソルページング、コメント数が多い場合のクエリ計画。
- 大量コメントへのレート制限。現状の新APIには専用のRate Limitをまだ実装していないため、正式リリース前に対策する。
- 論理削除済み親への返信禁止、投稿編集で音声を外した後の時刻リンク無効化。
- アカウント削除によるCASCADE時は他人の返信が失われる可能性があり、退会フロー時に別途設計する。

## 9. 次工程

API疎通と書き込み系テスト完了後、STEP10-4 Frontendの投稿詳細へコメント、返信、タイムスタンプ、いいね、削除UIを追加する。
