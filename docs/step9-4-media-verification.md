# STEP9-4：投稿メディアの閲覧権限・削除保護

## 実装内容

- `POST /posts/:postId/media/:mediaId/read-url`：該当メディアが投稿に紐づき、投稿者の`profiles.visibility`が`public`、または閲覧者が投稿者本人である場合だけPrivate R2のRead URL（300秒）を発行する。
- `followers/private`はフォロー承認機能未実装につき、当面は本人のみ。
- `DELETE /media/:id`（ゴミ箱）と`DELETE /media/:id/permanent`（完全削除）は、`practice_records`に加えて`post_media`も参照チェックし、使用中なら409 `media_in_use`を返す。
- `db/migrations/014_protect_post_media.sql`：DBトリガーで論理削除・物理削除も防ぐ。別のBackend処理、同時投稿作成・削除との競合にも備える。
- 投稿を削除すると`post_media`のみCASCADE削除し、`media`とR2オブジェクトは保持する。
- 既存`POST /media/:id/read-url`は本人管理用のまま。投稿閲覧者は投稿経由のURL発行APIを利用する。

## A：ソース取得（WSL Ubuntu）

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

型エラーが出たらデプロイせず、エラー全文を共有する。

## B：DBトリガー適用（Neon SQL Editor）

既存011〜013の適用済みであることを確認後、`db/migrations/014_protect_post_media.sql`全文を実行。

確認SQL：

```sql
SELECT
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.media'::regclass
  AND tgname = 'media_post_reference_protect';
```

期待：1行、`tgenabled = 'O'`、`BEFORE UPDATE OF deleted_at OR DELETE`。

## C：Backendのデプロイ（WSL Ubuntu）

```bash
npx tsc --noEmit
npx wrangler deploy --config backend/wrangler.jsonc
```

デプロイ先は`sonolii-api`。FrontendはこのSTEPで変更しない。

## D：公開投稿からのメディア閲覧テスト

1. Sonoliiのローカル画面を開いてログイン：`http://127.0.0.1:5173`。
2. F12 Consoleで以下を実行。既存の保存済みメディアから1件使用する。投稿テストに使ってよい音声／画像を選ぶ。
3. 初回は本人所有の`ready`かつ未削除のメディアのみ。
4. 以下のテストは新規投稿を作成する（最後に削除）。

```js
const API9 = "https://sonolii-api.g57cydy6ks.workers.dev";
const token9 = await window.Clerk.session.getToken();
const auth9 = { Authorization: `Bearer ${token9}`, "Content-Type": "application/json" };
const mediaRes9 = await fetch(`${API9}/media?limit=10`, { headers: auth9 });
const mediaData9 = await mediaRes9.json();
console.log("既存メディア:", mediaRes9.status, mediaData9);
```

`mediaData9.media`の`id`をメモ。表示されなければSTEP8のメディア画面から音声／画像をアップロードしてから再実行。

```js
const selectedMediaId9 = "ここにメディアUUID";
const createRes9 = await fetch(`${API9}/posts`, {
  method: "POST",
  headers: auth9,
  body: JSON.stringify({
    body: "STEP9-4 メディア閲覧テスト",
    pieceId: null,
    userPieceId: null,
    commentsEnabled: true,
    feedbackPrefs: [],
    mediaIds: [selectedMediaId9]
  })
});
const created9 = await createRes9.json();
console.log("投稿作成:", createRes9.status, created9);
const postId9 = created9.post?.id;
```

期待：201。以下は`postId9`と`selectedMediaId9`がセットされた状態で実行。

```js
const readRes9 = await fetch(
  `${API9}/posts/${postId9}/media/${selectedMediaId9}/read-url`,
  { method: "POST", headers: auth9 }
);
const readData9 = await readRes9.json();
console.log("本人のRead URL:", readRes9.status, readData9);
```

期待：200と`readUrl`、`expiresInSeconds: 300`。

## E：使用中メディアの削除拒否

投稿削除前に実行：

```js
const deleteMediaRes9 = await fetch(`${API9}/media/${selectedMediaId9}`, {
  method: "DELETE", headers: auth9
});
console.log("投稿使用中メディア削除:", deleteMediaRes9.status, await deleteMediaRes9.json());
```

期待：409 `media_in_use`。

## F：公開範囲テスト

- 本人のプロフィールを`public`にして、投稿のRead URLが未認証でも200になること。
- `private`にして、同じ未認証POSTが404、本人成りすましなしで取得不可になること。
- `followers`でも未認証POSTが404、本人は200。
- 他人のメディアID（投稿に紐づかないID）では404。
- プロフィール設定をテスト前の値に戻すこと。

未認証Console例（公開プロフィールのときだけ200）：

```js
const anonymousRes9 = await fetch(
  `${API9}/posts/${postId9}/media/${selectedMediaId9}/read-url`,
  { method: "POST" }
);
console.log("匿名Read URL:", anonymousRes9.status, await anonymousRes9.json());
```

**注意**：以前に発行した署名URLは、プロフィールをprivateに変更しても有効期限（最大300秒）まではアクセス可能。新規発行を拒否するテストと区別する。

## G：投稿削除後もMediaを保持

```js
const removePost9 = await fetch(`${API9}/posts/${postId9}`, {
  method: "DELETE", headers: auth9
});
console.log("テスト投稿削除:", removePost9.status);
const remainingMedia9 = await fetch(`${API9}/media?limit=100`, { headers: auth9 });
const remainingData9 = await remainingMedia9.json();
console.log("元メディア残存:", remainingData9.media?.some(x => x.id === selectedMediaId9));
```

期待：投稿削除204、メディアは残る。元メディアが他の練習記録や投稿で使用されている場合は、それらの参照は消えない。

## H：DB SELECTで確認

```sql
SELECT pm.post_id, pm.media_id, pm.user_id, pm.display_order,
       m.media_type, m.deleted_at
FROM public.post_media pm
JOIN public.media m ON m.id = pm.media_id
ORDER BY pm.created_at DESC
LIMIT 20;
```

## 注意と次のSTEP

- `POST /posts/.../read-url`の発行許可は投稿・プロフィール単位。R2のメディアバケットを公開しないこと。
- 一度発行された署名URLは短時間のBearer URLなので、転送された場合に期限まで利用可能。
- DBで既に削除済みのメディアは新規添付不可。
- クライアントが署名URLを保存して長期間使い回さず、期限切れ時はBackendから再取得する実装をSTEP9-5〜6で行う。
- この変更はDBトリガー＋Backendデプロイを両方完了すること。
