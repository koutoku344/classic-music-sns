# STEP9-6：投稿一覧・詳細画面を実データへ切り替える

## 変更内容

- `features/sonolii/lib/postApi.ts`：`GET /posts`、`GET /posts/:id`と投稿メディアのRead URLを追加。
- `features/sonolii/screens/Community.tsx`：Neon投稿の取得・20件ずつの追加読み込み。募集はまだサンプルであることを明示。
- `features/sonolii/screens/PostDetail.tsx`：DBの投稿詳細・曲名・本文・フィードバック希望・添付メディアを表示。
- `features/sonolii/components/PostMediaView.tsx`：Private R2の短期署名URLを取得し、画像と音声を表示。期限切れ・読み込みエラーの場合は再取得。
- `features/sonolii/screens/CreatePost.tsx`：投稿成功後、その投稿の詳細へ遷移可能にする。

これまでの`PostCard`・旧`PostDetail`に含まれていた偽の「いいね・コメント」は実投稿では使用しない。交流機能は次のSTEP。
本文のみ投稿・曲未選択投稿・音声・画像最大5件に対応。

## STEP9-6-1：コード取得・型チェック

実行場所：WSL Ubuntu

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

型チェックが失敗する場合は、エラー全文を共有して修正するまで先へ進まない。

## STEP9-6-2：Frontend起動

```bash
npm run dev
```

Chromeで`http://127.0.0.1:5173/posts`を開いてログイン。

## STEP9-6-3：一覧・詳細のテスト

1. コミュニティの「投稿」を選択。Neonに登録済みの投稿（`test-message-only`、`test-message-rec+image`、`test-message-image5`等）が表示される。
2. 本文だけの投稿が表示され、曲・音声・画像未設定でもエラーにならない。
3. 音声付き投稿で音声の再生コントロールが表示され、実音源を再生できる。
4. 画像付き投稿は一覧に代表画像1枚、詳細に最大5枚表示する。
5. 投稿を選ぶと`/posts/:id`へ移動し、DBの本文・曲・添付が正しく表示される。
6. 別タブで`/posts/new`から投稿を1件作成し、「投稿を見る」で今作った詳細を表示できる。
7. 20件を超える場合、「さらに投稿を読み込む」で重複せず追加できる。
8. 保存済み音声・画像を別投稿で再利用してもR2オブジェクトが増えない。
9. プロフィールが`private`ならログイン本人には表示される。未ログインでは一覧に含まれず、詳細URLを直接開いても404表示。
10. 公開`public`なら匿名でも一覧・詳細・メディア閲覧ができる。
11. 未実装のいいね・コメントが押せるように表示されないこと。
12. 募集カードは現時点ではサンプル表示と明記されていること。

注意：写真の閲覧に署名URLを使用し、300秒で期限が切れる。期限切れで読み込めない場合、画像・音声の「再取得」操作で更新する。自動再取得やUIの追加改善は総合テストで検討。

## STEP9-6-4：Neon確認

```sql
SELECT
  p.id,
  p.body,
  p.piece_id,
  p.user_piece_id,
  COUNT(pm.media_id) AS media_count
FROM public.posts p
LEFT JOIN public.post_media pm ON pm.post_id = p.id
GROUP BY p.id
ORDER BY MAX(p.created_at) DESC
LIMIT 20;
```

## STEP9-6-5：テスト投稿の削除（任意）

**画面の確認が完了してから実施。** 投稿を削除しても`media`レコードとR2の音声・画像は残る（以前のSTEPで確認済み）。
意図しない削除を避けるため、まず対象をSELECTで確認：

```sql
SELECT id, body, created_at
FROM public.posts
WHERE id IN (
  'a161cd06-c77e-433d-9dd5-9a9815eb61de',
  '12911ab9-e4b5-4bea-9ef5-ce3d5669e2b4',
  'b24bf75a-e7c1-4ff7-80d8-559a7117dca5',
  '585d4147-b386-4de9-8dca-97958e9c0c17'
)
ORDER BY created_at DESC;
```

表示された4件の本文が`test-message-image5`、`test-message-rec+image`、`test-message-only`、`STEP9-4 メディア閲覧テスト`であることを確認する。
相違する場合はDELETEを実行しない。

問題なければ次のSQLでこの4件の投稿だけを削除：

```sql
BEGIN;

DELETE FROM public.posts
WHERE (id, body) IN (
  ('a161cd06-c77e-433d-9dd5-9a9815eb61de'::uuid, 'test-message-image5'),
  ('12911ab9-e4b5-4bea-9ef5-ce3d5669e2b4'::uuid, 'test-message-rec+image'),
  ('b24bf75a-e7c1-4ff7-80d8-559a7117dca5'::uuid, 'test-message-only'),
  ('585d4147-b386-4de9-8dca-97958e9c0c17'::uuid, 'STEP9-4 メディア閲覧テスト')
)
RETURNING id, body;

COMMIT;
```

`post_media`はFKのCASCADEで関連のみ消え、`media`とR2は保持される。これ以外の投稿には触れない。
必要なら別のテスト投稿も、IDと本文を確認してから個別に削除する。

## 次のSTEP

STEP9-7：マイページ・ユーザープロフィール・検索画面の投稿領域を実APIへ接続。
