# STEP11-3-3 フォロワー限定の閲覧・フィードバック認可（適用・検証）

更新日：2026-10-20
状態：GitHubに実装済み。**Neon SQL021未適用／Backend未デプロイ・未検証。**

## 1. 確定仕様

| 公開範囲 | 未ログイン・非フォロワー | acceptedフォロワー | 本人 |
| --- | --- | --- | --- |
| public | 詳細・投稿・コメント・投稿音声が閲覧可 | 同左 | 可 |
| followers | 不可（プロフィールはrestricted情報のみ） | 詳細・投稿・コメント・投稿音声が閲覧可 | 可 |
| private | 不可（プロフィールはrestricted情報のみ） | **不可** | 可 |

pending、rejectedは閲覧不可。フォロー解除・フォロワー削除・visibility変更は次回APIアクセスから反映される。R2署名URLは発行済みの場合、有効期間300秒の閲覧余地が残る。フォロー中一覧とフォロー承認そのものは前STEPで実装済み。

## 2. 変更と適用順序

- `db/migrations/021_followers_feedback_access.sql`：現行`create_post_comment`、`set_post_comment_like`、`set_post_like`をCREATE OR REPLACE。既存のプロフィール設定・コメント受付・削除済み制限を維持し、`followers`かつacceptedの場合も許可。
- `backend/src/posts.ts`：単一投稿、投稿一覧、ユーザー別投稿、署名付きメディア閲覧URLに同じ可視性判定。
- `backend/src/feedback.ts`：コメント・返信・いいね取得時に同じ判定。
- `backend/src/index.ts`：プロフィール詳細で承認済みフォロワーを許可。`private`の閲覧許可は変更しない。
- **既存の投稿・コメント・音声・画像・R2オブジェクトは変更・削除しない。**

**必ずSQL021を先に適用し、次にBackendをデプロイする。** 順序を逆にすると、フォロワーが投稿・コメントを閲覧できても書込みに失敗する可能性がある。

## 3. Neon：SQL021適用前の確認（参照のみ）

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_post_comment',
    'set_post_comment_like',
    'set_post_like'
  )
ORDER BY p.proname;
```

**期待**：3行。`follows`テーブルおよびSQL019・020が適用済みであること。

## 4. Neon：SQL021の適用

GitHub [021_followers_feedback_access.sql](../db/migrations/021_followers_feedback_access.sql)の`BEGIN`から`COMMIT`まで全文をNeon SQL Editorで**1回のみ実行**する。

`CREATE OR REPLACE FUNCTION`のため、関数本体だけが更新され、既存コメント・いいね等の行は直接変更しない。`019`や`020`を再実行しない。

適用後、次の参照専用クエリで関数を確認する。

```sql
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) LIKE '%public.follows%' AS checks_follows
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_post_comment',
    'set_post_comment_like',
    'set_post_like'
  )
ORDER BY p.proname;
```

**期待**：3行、いずれも`checks_follows = true`。

## 5. WSL：Frontendは変更しない

```bash
cd ~/classic-music-sns

git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications

git status
npx tsc --noEmit
npm run build
```

型チェック・ビルド成功後のみBackendをデプロイする。

```bash
npx wrangler deploy --config backend/wrangler.jsonc
```

## 6. 非破壊テスト

テスト用アカウントA（閲覧者）とB（投稿者）を用いる。**既存のフォロー・テストデータや投稿を勝手に削除しない。** AがBをacceptedフォローし、Bに少なくとも1つ既存投稿があること。先ほどのSTEP11-3-2ではフォロー解除まで実施しているため、再申請・承認を行う必要がある。

**準備**：Bを`followers`に設定。AからBへ申請しBで承認。BのユーザーUUIDを控える。

AのChrome Consoleで次を実行。閲覧APIのみ（書込みなし）：

```javascript
(async () => {
  const API = "https://sonolii-api.g57cydy6ks.workers.dev";
  const B_USER_ID = "ここにBのユーザーUUID";
  const token = await window.Clerk.session.getToken();
  const headers = { Authorization: `Bearer ${token}` };

  async function check(path) {
    const res = await fetch(API + path, { headers });
    const body = await res.json();
    console.log(path, res.status, body);
    return { status: res.status, body };
  }

  await check(`/profiles/${B_USER_ID}`);
  const posts = await check(`/users/${B_USER_ID}/posts?limit=5`);

  const postId = posts.body.posts?.[0]?.id;
  if (postId) {
    await check(`/posts/${postId}`);
    await check(`/posts/${postId}/comments?limit=5`);
    await check(`/posts/${postId}/likes`);

    const mediaId = posts.body.posts[0]?.media?.[0]?.id;
    if (mediaId) {
      // Media URL endpoint uses POST, not GET.
      const res = await fetch(
        `${API}/posts/${postId}/media/${mediaId}/read-url`,
        { method: "POST", headers }
      );
      console.log("read-url POST", res.status);
    }
  }
})();
```

`GET /profiles/{id}` の`restricted:false`、投稿一覧と投稿詳細、コメント／いいねの200を確認。read-url発行は POST が200なら成功。

**否定ケース**：未ログイン、フォロー未承認の別テストアカウントでは`followers`投稿詳細・コメント・read-urlが404。Bを`private`に変更した場合、Aがacceptedであっても同様に404（プロフィールは`restricted:true`）。B本人は引き続き閲覧できる。

**書込み**：Bのコメント許可済み投稿にAから通常コメント1件のPOST、投稿いいねPUTをテスト。既存コメントを削除せず、テスト用に新規作成したコメントだけを必要に応じ論理削除できる。いいねはテスト前の状態を記録し、終わったら元へ戻す。今工程の目的はSQL021の整合性確認。

**終了時**：Bのvisibilityを元の設定に戻す。フォロー解除はテスト用関係であり、必要な場合だけAが行う。既存フォローを不用意に削除しない。

## 7. 注意・残工程

- 投稿音声のRead URLは発行後最大300秒の有効期限を持つ。公開範囲変更後の即時失効は保証しない。
- 公開アカウントのフォロー中限定フィード（`/posts?feed=following`）は今工程では実装しない。
- フォロワー一覧公開範囲、通知取得・既読、通知の30日削除は後工程。
