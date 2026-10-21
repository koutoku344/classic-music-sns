# STEP12 募集掲示板 — 確定仕様・実装メモ

## 確定事項（ユーザー承認）
1. 募集一覧・詳細はログイン状態・プロフィール公開設定によらず全ユーザーが閲覧可能。投稿と異なり募集は公開型。
2. 応募は「申請→主催者が承認／却下」。未承認の応募者情報は主催者以外に表示しない。
3. **募集への音声添付は不要**。今回だけでなく将来の予定機能からも除外。既存の録音モックUIは削除。
4. 承認後の連絡はSTEP13メッセージ機能で実装。STEP12では連絡先の公開や外部連絡機能を実装しない。

## STEP12のデータモデル
- `recruitments`: 主催者、共通曲マスターID（任意）、募集楽器[]、地域[]、レベル、目的、募集内容、状態 open/closed、日時。音声／メディア列は設けない。
- `recruitment_applications`: 申込者、募集ID、状態 pending/accepted/rejected、日時。一人につき同じ募集への申請は最大1行（UNIQUE）。
- 応募取り消しはpendingのみ。一度却下した申請は再応募可、承認済み応募の取り消しはSTEP12では提供しない。
- 主催者本人は自分の募集へ応募できない。募集終了後は新規応募も承認・却下もできない。

## API契約
| Method | Path | 権限・内容 |
| --- | --- | --- |
| GET | /recruitments | 公開・絞込・20件ページング |
| GET | /recruitments/:id | 公開・詳細。自分の応募状態のみ返却 |
| POST | /recruitments | プロフィール登録済の認証ユーザー |
| PATCH | /recruitments/:id | 主催者のみ、open中 |
| PATCH | /recruitments/:id/status | 主催者のみ、open/closed切り替え |
| DELETE | /recruitments/:id | 主催者のみ。応募行も連鎖削除 |
| POST | /recruitments/:id/applications | 他ユーザー、open中、プロフィール必須 |
| DELETE | /recruitments/:id/applications | 申請者本人、pendingのみ |
| GET | /recruitments/:id/applications | 主催者のみ |
| POST | /recruitments/:id/applications/:applicationId/accept | 主催者のみ、pending→accepted |
| POST | /recruitments/:id/applications/:applicationId/reject | 主催者のみ、pending→rejected |

## 導入順序
1. ブランチ `feat/step12-recruitments` をローカル取得、`npm run test:step12:check` で静的・型・ビルドをまとめて確認。
2. コード・マイグレーションのレビュー後、Neon SQL Editorに `db/migrations/024_create_recruitments.sql` を1回適用。**チャット側ではNeonへ適用しない**。
3. Backend/Frontendのデプロイをそれぞれ実行し、読み取りを確認。
4. 書き込みE2Eは明示的に区別し、専用テストデータのみに実施（既存ユーザーデータ破壊を避ける）。
5. 失敗時は個別に `npm run test:step12:static`、`npx tsc --noEmit`、`npm run build` で切り分け可能。
