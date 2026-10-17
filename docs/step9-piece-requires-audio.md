# STEP9 追加仕様：演奏した曲を選択する場合のみ音声必須

## 仕様
- 本文のみ：可
- 画像のみ：可
- 音声のみ：可（演奏曲は任意）
- 音声＋曲：可
- 本文／画像＋曲、音声なし：不可
- マスター曲（piece_id）と独自登録曲（user_piece_id）の両方に適用
- 新規投稿 POST と編集 PATCH に適用
- 既存投稿・media・post_mediaは変更・削除しない

## 変更ファイル
- `features/sonolii/screens/CreatePost.tsx`：投稿ボタン制御／ガイダンス
- `backend/src/posts.ts`：DBの`piece_requires_audio`エラーを400として返す
- `db/migrations/015_require_audio_for_selected_post_piece.sql`：`save_post`内で選択曲とready音声の有無を検証

## 反映手順
実行場所：WSL Ubuntu
```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
npx tsc --noEmit
```
型エラーがなければ、Neon SQL Editorで`db/migrations/015_require_audio_for_selected_post_piece.sql`を**全文実行**。
結果にエラーがないことを確認してから、WSL UbuntuでBackendをデプロイ。
```bash
npx wrangler deploy --config backend/wrangler.jsonc
npm run dev
```
Frontendの変更はローカル開発サーバーで反映されるため、このテストにFrontendの本番デプロイは不要。

## 最低限の検証
1. `http://127.0.0.1:5173/posts/new`：本文＋マスター曲／独自曲を選ぶが音声未選択→投稿ボタンが無効。警告メッセージが表示される。
2. 曲選択を解除→本文のみで投稿可能。
3. 既存の保存済み音声を選び、曲あり→投稿可能。
4. 音声を付けたまま曲を解除→投稿可能（曲任意）。

APIでサーバー側検証（Sonoliiログイン後Chrome F12 Console）：
```js
const api15 = 'https://sonolii-api.g57cydy6ks.workers.dev';
const token15 = await window.Clerk.session.getToken();
const catalog15 = await (await fetch(api15 + '/catalog/pieces')).json();
const pieceId15 = catalog15.pieces[0]?.id;
if (!pieceId15) throw new Error('曲マスターがありません');
const res15 = await fetch(api15 + '/posts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token15}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    body: 'STEP9 追加仕様検証',
    pieceId: pieceId15,
    userPieceId: null,
    commentsEnabled: true,
    feedbackPrefs: [],
    mediaIds: []
  })
});
console.log(res15.status, await res15.json());
```
期待結果：`400 {error:'piece_requires_audio'}`。**この拒否テストでは投稿は作成されない。**

### SQLで無効な投稿がないこと（読み取りのみ）
```sql
SELECT p.id, p.body
FROM public.posts p
WHERE (p.piece_id IS NOT NULL OR p.user_piece_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public.post_media pm
    JOIN public.media m ON m.id = pm.media_id
    WHERE pm.post_id = p.id AND m.media_type = 'audio'
  );
```
期待：0行。既存投稿に該当がある場合、マイグレーションは既存行を変更しないため結果を確認してから別途扱う。

これらが成功したらSTEP9-8総合テストに戻る。
