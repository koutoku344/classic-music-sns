# STEP10-5-7 フィードバック書き込みのレート制限

## 変更内容

- Cloudflare Workers Rate Limiting binding `FEEDBACK_RATE_LIMIT`（namespace `1001`）をBackend Workerに追加。
- 認証済みのSonoliiユーザーID単位で、コメント作成、コメント削除、投稿・コメントへのいいね登録・解除の書き込み合計を**30回/60秒**に制限。
- 閲覧用のGETリクエストは制限対象外。
- 上限超過時：HTTP 429、`{"error":"rate_limited"}`、`Retry-After: 60`。
- Frontendは連続操作超過時の日本語エラーを表示。
- Neonの新テーブル・SQLマイグレーション、R2変更、既存コメント・投稿・音声・画像の削除なし。

参考：Cloudflare公式 Workers Rate Limiting API
https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

この機能はユーザー操作の過剰な連投を抑える目的の対策であり、厳密なグローバル原子カウンターやDDoS対策そのものではない。必要に応じCloudflare WAF等も検討する。

## 適用

WSL:
```bash
cd ~/classic-music-sns
git switch feat/step10-feedback
git pull origin feat/step10-feedback
npx tsc --noEmit
npm run build
npx wrangler deploy --config backend/wrangler.jsonc
npm run deploy
```
型チェック・ビルドが失敗した場合はデプロイしない。SQLの実行は不要。

## 非破壊テスト

1. デプロイ後の公開投稿を1件開き、いいねON/OFFおよび通常コメントを1件作成できることを確認（プロフィール設定済みアカウント）。
2. 未ログイン閲覧でコメント一覧を読めることを確認。
3. レート制限そのものの負荷試験は本番Workerで実施しない。Cloudflareダッシュボードでバインディング反映を確認し、実際の429テストが必要なら別の検証環境で行う。
4. 以前のSTEP10-5-5の同時5リクエストテストは30回/分の枠内なら継続可能だが、直後に何度も実行すると429が出る。

## 残課題

- 認証前リクエストや閲覧APIへの過剰アクセスはこの制限の対象外。WAFやアプリ全体の保護はリリース前に別途設計。
- Rate Limiting bindingのカウンターは厳密な全地域同時リクエスト制限を保証するものではない。
- 本番運用時に429発生頻度を観測し、30回/分が厳しすぎないか調整する。
