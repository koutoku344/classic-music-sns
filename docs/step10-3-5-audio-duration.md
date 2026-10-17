# STEP10-3-5 音声再生時間の保存・既存音声補完

目的：`media.duration_seconds`がNULLのためにタイムスタンプコメントを投稿できない問題を修正する。

## 変更点

- `features/sonolii/lib/mediaApi.ts`：アップロード開始前にブラウザの音声メタデータから秒数を取得し、`POST /media/:id/complete`へ`{"durationSeconds":秒数}`を送る。R2の音声本体は元ファイルのまま保存。
- `backend/src/media.ts`：音声complete時は所有者・状態・サイズの既存チェックに加えて再生時間（整数、1〜86400秒）を検証して保存。画像completeは従来の空Bodyを許可。
- 同Backendに`PATCH /media/:id/duration`：所有者のreadyかつ未削除の音声で`duration_seconds IS NULL`の場合にのみ補完。更新済みは上書きしない。投稿・R2オブジェクトには影響しない。
- `features/sonolii/screens/MediaManager.tsx`：保存済み画面に「未登録の音声時間を補完」ボタンを追加。所有する音声だけを対象とし、既存の音声読み取りURLから再生時間を取得してPATCHする。補完数／失敗数を表示。
- WebM等でブラウザが正しい再生時間を返さない場合はエラー表示し、推測値を保存しない。
- SQL追加・既存メディア削除・音声の再アップロードは不要。

## 最小限の確認手順

1. WSL：`git switch feat/step10-feedback && git pull origin feat/step10-feedback`
2. WSL：`npx tsc --noEmit && npm run build`。失敗した場合はデプロイしない。
3. Backend：`npx wrangler deploy --config backend/wrangler.jsonc`
4. Frontend：リポジトリの既存手順で`sonolii-web`をデプロイ（通常`npm run deploy`）。**BackendとFrontendの両方を更新**。
5. Sonoliiにログイン→設定→メディア管理→保存済み→「未登録の音声時間を補完」を1回押す。成功件数と失敗件数を確認。
6. Neon SQL Editor（参照だけ）：
```sql
SELECT id, duration_seconds
FROM public.media
WHERE media_type = 'audio'
  AND upload_status = 'ready'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
```
7. 既存のSTEP10-3-4-5のタイムスタンプコメントPOSTを再実行し201を確認。

**注意**：コメントの再テストには対象投稿の音声durationが非NULLであること。複数の投稿で同じmediaを参照していても補完はmedia単位で1回。既存投稿・コメント・メディアは削除しない。署名付きR2 URLやJWTをログに貼らない。

## セキュリティ・制約

ブラウザが申告するメタデータは改ざん可能。所有者チェック・ready判定・整数と上限はBackendで検証するが、実ファイルの正確な長さを独立検証したわけではない。強い信頼性が必要なら将来サーバー側の検証を導入する。

## 完了判定

新旧の音声に正の再生時間が記録され、タイムスタンプコメントが201で登録されること。既存音声が一部補完失敗した場合は件数と形式を調査し、推測でUPDATEしない。
