# STEP9-5：投稿作成画面のAPI接続・動作確認

## 変更範囲

- `features/sonolii/screens/CreatePost.tsx`：ダミーの投稿作成画面を実APIへ接続。Clerk認証、曲の選択、本文、添付ID、フィードバック希望、コメント受付を送信。
- `features/sonolii/lib/postApi.ts`：`POST /posts`クライアントを追加。
- `features/sonolii/components/PracticeAudioPicker.tsx`：STEP8で実装済みの実録音／ファイル選択／保存済み音声を**変更せず再利用**。
- `features/sonolii/components/PostImagePicker.tsx`：画像アップロード・保存済み画像の再利用・最大5枚の選択。
- `features/sonolii/lib/mediaApi.ts`：画像のR2 presigned PUT・complete、画像一覧、プレビュー取得を追加。音声APIも従来どおり利用。

投稿本文・音声・画像のうち1つ以上が必要。曲選択は音声投稿でも任意。

**STEP9-5の実装は投稿「新規作成」画面のみ。既存投稿の編集画面および一覧・詳細の実API化はSTEP9-6以降で扱う。**

## STEP9-5-1：ソース取得

実行場所：WSL Ubuntu

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
git status
npx tsc --noEmit
```

TypeScriptエラーがあればデプロイ前に修正する。Githubに変更を反映した段階では、ローカル実行によるビルドの成功をまだ確認していない。

## STEP9-5-2：ローカル画面でテスト

```bash
npm run dev
```

Chromeで`http://127.0.0.1:5173`を開いてSonoliiにログイン。投稿作成画面へ移動。

以下の順で検証する（不要なR2アップロードを避けるため、まず本文のみ）。

1. 本文空＋メディアなし：投稿ボタンが無効になる。
2. 本文のみ：投稿→「投稿を保存しました」と投稿UUIDが表示される。
3. Neon SQL Editorで保存を確認：
   ```sql
   SELECT id, body, piece_id, user_piece_id, created_at
   FROM public.posts
   ORDER BY created_at DESC LIMIT 10;
   ```
4. 曲を選択して本文のみ投稿：`piece_id`か`user_piece_id`の片方が設定される。
5. STEP8に保存済み音声を選択し音声のみで投稿：`post_media`に1件。
6. 画像1枚をアップロードして画像のみ投稿：R2アップロード→complete→post_media登録を確認。
7. 保存済み画像の再利用と、同じ画像を複数投稿に紐づけられることを確認。
8. 音声1件と画像5枚：6件の関連行が`display_order` 1〜6で保存される。
9. 画像6枚を追加しようとすると画面が拒否する。
10. 公開範囲の変更時、投稿はプロフィールの公開範囲を継承する。privateが他人に公開されないことはSTEP9-8で再検証。

※録音はSTEP8の`PracticeAudioPicker`を流用するため録音上限30分、音声200MB、画像1枚10MB。R2容量上限3GB。

## STEP9-5-3：投稿と添付をNeonで検証

```sql
SELECT
  p.id, p.body, p.piece_id, p.user_piece_id,
  pm.media_id, pm.display_order, m.media_type
FROM public.posts p
LEFT JOIN public.post_media pm ON pm.post_id = p.id
LEFT JOIN public.media m ON m.id = pm.media_id
ORDER BY p.created_at DESC, pm.display_order
LIMIT 30;
```

投稿を削除しても`media`自体は残る。STEP9-4で参照中メディアの削除は409で拒否する。

## STEP9-5-4：費用・運用に関する注意

- 保存済みメディアの再利用はR2ファイルをコピーしないのでStorage課金対象の容量は増えない。
- 新規アップロードはR2のStandardストレージ使用量とClass Aオペレーション（PUT等）が発生し得る。
- 画像のプレビュー・音声再生は署名付きGETによるClass Bオペレーションが発生し得る。
- ファイルを保存した後で投稿を中止しても、アップロード済みメディアはメディア管理から再利用できる。メディアは自動削除されない。
- R2のCORSはFrontendのOriginを許可していること（`http://127.0.0.1:5173`など）。
- 期限が切れたプレビューURLはページを再表示して取得し直す。視聴時の自動再取得はSTEP9-6で実装。

## STEP9-5-5：本番反映の範囲

このSTEPはFrontendの変更。BackendのSQLマイグレーション追加・APIデプロイは不要。ローカルの確認後にWeb側をデプロイする場合は、既存のFrontendデプロイ手順に従う（Backendと混同しない）。

## 次のSTEP

STEP9-6では`Community.tsx`、`PostDetail.tsx`のダミー投稿をBackendの`GET /posts`、`GET /posts/:id`からの実データ表示へ置き換える。そのとき、投稿閲覧権限に沿ったメディアRead URLの取得／期限切れ再取得も実装する。
