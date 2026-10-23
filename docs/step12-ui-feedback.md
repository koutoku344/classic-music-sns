# STEP12 UI改善（ユーザーフィードバック7点） — 反映内容・検証順

## 実装
1. コミュニティ募集一覧：新規作成・変更イベント、画面フォーカス、タブ切替時にAPI一覧を再取得。
2. 応募時の非公開コメント：0〜1000文字。応募者は送信のみ、主催者だけ応募者一覧APIから参照可能。
3. 応募楽器：任意。募集に指定された楽器からだけ選択可能。募集楽器が空の場合は「募集楽器の指定なし」を表示し、楽器選択UIを出さない。
4. 応募時は主催者へ `recruitment_application` 通知。
5. 承認・却下では応募者へ `recruitment_accepted` / `recruitment_rejected` 通知。
6. 楽器別応募件数：未選択は「その他」。審査待ちと承認済みをカウントし、却下・取り消しは含まない。承認済み合計は別表示。
7. 主催者の承認/却下ボタンを枠つき・大きめのサイズに変更。

## DB
- `025_recruitment_application_feedback.sql` は **024適用後に一度だけ** 実行。
- `recruitment_applications.message`、`instrument` を追加。既存データはそれぞれ空文字・NULL。
- `notifications.recruitment_id` を追加。募集削除時、関連通知も削除。
- 応募・決定通知はDBトリガーで同一トランザクション内に作成。応募コメントは通知内容に載せない。
- `recruitments.instruments` は0個選択を許可するよう制約変更。音声添付は導入しない。

## 実施順（コマンド回数を抑える）
1. `git fetch origin && git switch --track origin/fix/step12-ui-feedback && npm run test:step12:check`
2. 上記が成功した後、Neon SQL Editorで `db/migrations/025_recruitment_application_feedback.sql` を実行。
3. Backend: `npx wrangler deploy --config backend/wrangler.jsonc`、Frontend: `npm run deploy`。順に実行し成功を確認。
4. `npm run test:step12:write` でA/B専用募集を作り、通知・コメントの公開制御・楽器別件数・募集終了をE2Eで確認。テスト募集とその通知は削除される。
5. ブラウザUI目視確認で差分を確認後、PR→main統合。

## 残る運用上の注意
- 既存の応募データは削除しない。
- E2EはPRE_RELEASE専用アカウントかつ明示的な書き込み許可の設定を維持する。
- 未デプロイのBackendからは新しい `notifications.recruitment_id` の参照ができないので、DB先行→Backend→Frontendの順を守る。
