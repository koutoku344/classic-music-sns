# STEP9-8：投稿機能の総合テスト（2026-10-17）

## 方針・前提

- STEP9-7の全項目は成功済み。STEP9-6以前のテストデータは**すべて保持する**。
- 本手順のSELECT、GET、拒否されるべき400/401/404/409テストは既存投稿を変更しない。
- PUT/PATCH/DELETEの成功系を検証するときは、既存投稿には触れず、総合テスト専用の投稿を**新たに作成**して操作する。成功系のDELETEはユーザーが明示的に実施したい場合のみ。
- 実行場所：WSL Ubuntu、ChromeのSonolii画面F12 Console、Neon SQL Editor。
- STEP9-8で新しいマイグレーションは不要。既存の011〜014が適用され、BackendはSTEP9-4、FrontendはSTEP9-7に更新済みであること。
- コメント、いいね、フォロー、独自登録曲横断検索、ユーザー／募集検索は現時点で対象外。

## 9-8-0：コードと設定の事前確認

WSL Ubuntu：

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

続いて`npm run dev`、Chromeで`http://127.0.0.1:5173/posts`を開く。APIは`https://sonolii-api.g57cydy6ks.workers.dev`。

Neon SQL Editorで構造・トリガーを参照のみで確認：

```sql
SELECT to_regclass('public.posts') AS posts,
       to_regclass('public.post_media') AS post_media;

SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.media'::regclass
  AND tgname = 'media_post_reference_protect';

SELECT proname, pg_get_function_result(oid) AS result
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'save_post';
```

期待：posts/post_mediaが存在し、mediaトリガーが`O`、`save_post`の戻り値がuuid。

## 9-8-1：DB整合性（読み取り専用）

```sql
-- 投稿に紐づいたメディアの所有者違い・準備未完了・ゴミ箱入りの確認
SELECT
  pm.post_id, pm.media_id,
  p.user_id AS post_owner, m.user_id AS media_owner,
  m.media_type, m.upload_status, m.deleted_at
FROM public.post_media pm
JOIN public.posts p ON p.id = pm.post_id
JOIN public.media m ON m.id = pm.media_id
WHERE p.user_id <> m.user_id
   OR m.upload_status <> 'ready'
   OR m.deleted_at IS NOT NULL;

-- 各投稿の音声1件・画像5件制限
SELECT
  pm.post_id,
  COUNT(*) FILTER (WHERE m.media_type = 'audio') AS audio_count,
  COUNT(*) FILTER (WHERE m.media_type = 'image') AS image_count,
  COUNT(*) AS total_count
FROM public.post_media pm
JOIN public.media m ON m.id = pm.media_id
GROUP BY pm.post_id
HAVING COUNT(*) FILTER (WHERE m.media_type = 'audio') > 1
    OR COUNT(*) FILTER (WHERE m.media_type = 'image') > 5
    OR COUNT(*) > 6;

-- 空投稿が存在しないこと
SELECT p.id, p.body
FROM public.posts p
WHERE length(btrim(p.body)) = 0
  AND NOT EXISTS (
    SELECT 1 FROM public.post_media pm WHERE pm.post_id = p.id
  );
```

3つとも**0行**が期待値。0行でなければ修正前に結果を共有する。

```sql
SELECT p.id, p.body, p.user_piece_id, p.piece_id,
       COUNT(pm.media_id) AS attached_count
FROM public.posts p
LEFT JOIN public.post_media pm ON pm.post_id = p.id
GROUP BY p.id
ORDER BY MAX(p.created_at) DESC
LIMIT 30;
```

期待：既存の音声＋画像5枚投稿は6件、本文のみ投稿は0件。既存テストデータは残す。

## 9-8-2：未認証・他ユーザーからの不正操作

ログイン済みSonoliiでF12 Console：

```js
const api8 = "https://sonolii-api.g57cydy6ks.workers.dev";
const postId8 = "a161cd06-c77e-433d-9dd5-9a9815eb61de"; // 既存のテスト投稿ID
const validBody8 = {
  body: "更新されてはいけない本文",
  pieceId: null, userPieceId: null,
  commentsEnabled: true, feedbackPrefs: [], mediaIds: []
};

async function status8(path, init) {
  const r = await fetch(api8 + path, init);
  console.log(init?.method ?? "GET", path, "HTTP", r.status);
  return r.status;
}
await status8("/posts", { method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(validBody8) }); // 401
await status8("/posts/" + postId8, { method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(validBody8) }); // 401
await status8("/posts/" + postId8, { method: "DELETE" }); // 401
```

**上記はAuthorizationを送信しないため、既存投稿が変更／削除されないことを確認するテスト。**

他ユーザーとしての認証・認可テストを行える場合（別のClerkアカウントA/Bを用意）：
- Aのprivate投稿をBのGET /posts/:idで取得 → 404
- Aの投稿にBがPATCH/DELETE → 404（既存の所有者フィルタ）。
- Aの投稿メディアRead URLをBが要求 → 404。
- AのメディアをBのPOST /postsで添付 → 拒否（404）。
- **ログインアカウントが1つだけの場合は「未実施（2アカウント必要）」として記録し、合格扱いしない。**

## 9-8-3：バリデーション・異常系

ログイン済みSonoliiのF12 Console。トークンの文字列は画面やスクリーンショットに出さない。

```js
const token8 = await window.Clerk.session.getToken();
const headers8 = { Authorization: `Bearer ${token8}`, "Content-Type": "application/json" };
const base8 = { body: "STEP9-8境界テスト", pieceId: null,
  userPieceId: null, commentsEnabled: true, feedbackPrefs: [], mediaIds: [] };
async function invalidPost8(body, expected) {
  const r = await fetch(api8 + "/posts", {
    method: "POST", headers: headers8, body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => null);
  console.log("expected", expected, "actual", r.status, data?.error ?? "");
  if (r.status === 201) console.warn("予期せぬ投稿作成:", data?.post?.id);
}
await invalidPost8({ ...base8, body: "" }, 400);
await invalidPost8({ ...base8, body: "x".repeat(2001) }, 400);
await invalidPost8({ ...base8, pieceId: "invalid-uuid" }, 400);
await invalidPost8({ ...base8, mediaIds: ["00000000-0000-4000-8000-000000000001"] }, 404);
await invalidPost8({ ...base8, commentsEnabled: "yes" }, 400);
```

期待：すべて400/404で、`201`が1つも発生しない。既存投稿は変更されない。

## 9-8-4：公開範囲とメディア署名URL

前回STEP9-4の完了済み結果を再確認する：
- publicは匿名でも投稿GET・Read URLとも200。
- private/followersは匿名および他人には404、本人には200。
- Read URLは短期（300秒）であり、公開範囲変更後も**発行済み**URLは期限まで使える点は仕様上の留意事項。
- Profileの公開範囲はテスト後元に戻す。
- R2バケット自体がパブリック公開されていないことをCloudflare管理画面で確認。

## 9-8-5：メディア再利用・削除保護

**既存の投稿やメディアは削除しない。**

Neon SQL Editor（読み取り専用）：

```sql
SELECT
  pm.media_id,
  m.media_type,
  COUNT(DISTINCT pm.post_id) AS referenced_posts
FROM public.post_media pm
JOIN public.media m ON m.id = pm.media_id
GROUP BY pm.media_id, m.media_type
ORDER BY referenced_posts DESC, pm.media_id
LIMIT 20;
```

同じ`media_id`が複数投稿に紐づいている場合、`referenced_posts > 1`となる。
投稿中メディアの削除試行は既存のSTEP9-4でHTTP 409確認済み。復習として再実施しても、成功したDELETEは絶対に行わない。

## 9-8-6：曲検索・ページング

- `/search` →「投稿」から共通曲を選び、Chrome Networkで`GET /posts?limit=20&pieceId=<UUID>`を確認。
- このUUIDは`public.pieces.id`。独自登録曲は横断検索の対象外。
- `GET /posts?limit=0` → 400、`GET /posts?limit=51` → 400、`GET /posts?cursor=bad` → 400。
- `GET /posts?limit=1`で`nextCursor`があれば次ページを確認し、前ページと同じ投稿IDがないこと。
- 同一`created_at`がある場合でも`(created_at,id)`で順序が安定する。
- プロフィール制限のある投稿が匿名一覧に混入しないこと。

## 9-8-7：INDEX・実行計画（推奨）

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('posts', 'post_media')
ORDER BY tablename, indexname;
```

`posts_created_idx`、`posts_owner_created_idx`、`posts_piece_created_idx`、`post_media_media_idx`などを確認し、削除済み`posts_user_piece_created_idx`がないこと。

読み取りのみの実行計画：

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, body, created_at
FROM public.posts
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

投稿が少ない時点ではSeq Scanも正常。INDEX利用がないことだけでは失敗と判断しない。
大量データの生成や`enable_seqscan = off`はしない。

## 9-8-8：競合・障害系（リリース前必須）

- 同時に同じ媒体を投稿へ紐付け／ゴミ箱移動する場合、`save_post()`の媒体行ロックと`media_post_reference_protect`トリガーが働き、不整合が生じないか。
- 更新中の投稿へ同じ媒体を二重登録しようとすると400で拒否されるか。
- 投稿作成中に一つのmediaIdが無効なら`posts`に作成途中の行が残らないか。
- 署名URL発行後の公開範囲変更で新規署名URL発行が拒否されるか。
- STEP8からの継続事項：日次Cron実行・pendingメディア24時間超のfailed化・期限切れゴミ箱の実削除・R2/DBの部分失敗復旧・容量上限の実測は別途確認する。
- 無理に同時操作を本番Neonで大量実行せず、必要なら開発用の別環境・限定回数で検証する。

## 完了判定

- 9-8-1〜9-8-7を実施・結果を記録。
- 他アカウントや同時実行が必要なテストは未実施なら未実施と明記。
- 未解決のセキュリティ問題・データ整合性問題があればSTEP9-9のマージ前に修正。
- テスト用投稿と音声・画像は**残す**。

## 次の作業

STEP9-9：`docs/architecture.md`、`docs/non-functional.md`、README、STEP9実装計画に実装と検証の結果を追記し、`feat/step9-posts`から`main`へマージする。
