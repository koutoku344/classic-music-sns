# STEP9-7：マイページ・ユーザープロフィール・投稿検索の実API化

## 実装範囲

- `MyPage.tsx`：`/me/profile`の`user_id`をもとに`GET /users/:id/posts`から本人の投稿を取得。private/followersでも本人は閲覧可能。ダミー投稿・ダミーLikes/Comments集計は投稿表示から除外。
- `UserProfile.tsx`：公開プロフィール取得後、`restricted=false`の場合のみ`GET /users/:id/posts`を呼ぶ。公開範囲が制限されている場合は投稿自体を読み込まない。本人はprivate/followersでも閲覧可能。
- `Search.tsx`：投稿タブで`GET /posts?pieceId=...`を使用。曲未選択は公開／本人投稿の新着一覧。曲選択は共通曲マスターのみ（`pieces.id`）。他ユーザーの独自登録曲`user_pieces.id`は横断検索しない。
- `postApi.ts`：`listUserPosts`と、`listPosts`の`pieceId`指定を追加。
- `PostSummary.tsx`：上記画面共通の実投稿カード。画像は代表画像1枚、音声は署名URLで再生できる。
- `PiecePicker.tsx`：投稿検索は「曲を探す」タブを初期表示。練習記録・投稿作成の初期選択は変更なし。

**テストデータは保持する。DELETEの操作やSQLは実施しない。**

## STEP9-7-1：WSLから取得

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

型チェックにエラーがある場合はその全文を共有し、修正してからブラウザ検証する。

## STEP9-7-2：ローカル画面で確認

```bash
npm run dev
```

Chromeで`http://127.0.0.1:5173`を開く。

| No | 場所／操作 | 期待結果 |
| -- | -- | -- |
| 1 | ログインして`/my-page`へ移動 | 本人の登録投稿が表示。サンプルの仮投稿は投稿欄に出ない |
| 2 | マイページ「投稿」タブ | 本人の投稿一覧・詳細遷移に成功 |
| 3 | 本人プロフィールをprivate/followersに変更 | 本人の投稿は引き続き見える |
| 4 | コミュニティから投稿者を押し`/users/:id`へ | そのユーザーの公開範囲に応じて投稿を表示 |
| 5 | 他人／未認証状態でprivate/followersユーザーを表示 | 非公開本文・音声・画像を取得しない |
| 6 | `/search` → 投稿タブ | 共通曲マスターの選択UIと実投稿が表示 |
| 7 | 曲未指定 | 表示許可のある投稿が新しい順に表示される |
| 8 | 存在する共通マスター曲を選択 | その`piece_id`の投稿だけを取得 |
| 9 | 曲の選択を解除 | 新着投稿一覧に戻る |
| 10 | どの画面でもメディアを開く | 投稿権限に基づき音声再生・代表画像表示が成功 |
| 11 | 20件を超える場合 | 「さらに投稿を表示」で重複なく追加取得 |
| 12 | 投稿検索の画面 | 独自登録曲の横断検索は未対応と明示 |

公開／privateのテストで変更したプロフィール設定は元に戻す。

## STEP9-7-3：Chrome F12 / Networkで確認

投稿検索で曲を選択したあと、Networkタブから`GET /posts?limit=20&pieceId=...`が発行されることを確認。
`pieceId`は`public.pieces.id`のUUID。曲ID検索はBackend／DB側のフィルタであり、画面に読み込んだ一覧だけをローカル絞り込みする方式ではない。

マイページでは`GET /users/:id/posts?limit=20`。
他ユーザープロフィールが制限付きの場合、投稿取得APIを呼び出さない。

## STEP9-7-4：Neon SQL Editorで検索整合性を確認（SELECTのみ）

```sql
SELECT
  p.piece_id,
  c.name AS composer,
  pc.title,
  COUNT(*) AS post_count
FROM public.posts p
JOIN public.pieces pc ON pc.id = p.piece_id
JOIN public.composers c ON c.id = pc.composer_id
GROUP BY p.piece_id, c.name, pc.title
ORDER BY post_count DESC, composer, pc.title
LIMIT 20;
```

曲名による検索自体を実装したわけではない。共通曲マスター上の選択結果を曲IDで検索する。

## 注意事項

- 今回はFrontendのみ変更。SQL追加やBackendデプロイは不要。
- 募集タブ、ユーザー検索は現在サンプルデータのまま（STEP9の対象は投稿検索）。
- コメント、いいね、フォロー機能はSTEP9対象外。
- 署名URLは5分有効。期限後の再取得は`PostMediaView`の操作に従う。
- 画面から実投稿が見えない場合は、`profiles.visibility`、本人／他人、Clerkログイン状態、NetworkのHTTPコードを確認。
- 投稿者別の投稿数表示はページングで取得した件数であり、DB全件の件数ではない。

## 次のSTEP

STEP9-8：CRUD、閲覧認可、メディア参照整合性、ページング、公開範囲の総合確認。STEP9-9：ドキュメント更新・マージ。
