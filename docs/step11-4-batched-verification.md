# STEP11-4-2〜4-4：通知詳細表示・遷移・まとめて確認

更新日：2026-10-21。GitHubブランチに実装済み。**Neon SQLなし。Backend/Frontendデプロイ未実施。型チェック、ビルド、Playwright実行はローカル未確認。**

## 実装

- GET `/me/notifications` に `actorName`, `actorId`, `targetPostId` を追加（いずれもNULL許容）。
- 相手のプロフィールは受取人に対し現在閲覧可能な場合のみ表示。public＝全員、followers＝承認されたフォロワーまたは本人、private＝本人のみ。
- 投稿は現在の投稿所有者の公開範囲を確認。public＝全員、followers＝承認されたフォロワーまたは投稿者本人、private＝投稿者本人。
- コメントに紐づく通知は、コメントが削除されている場合、投稿のリンクを返さない。
- 対象が消えた・閲覧権限がなくなった通知も、通知自体は残す。名前や遷移先は非表示にして一般的な通知文言を表示。
- FrontendのリンクはIDを勝手に推測しない。APIが `actorId` / `targetPostId` を返したときに限り表示。
- 既存のJWT認証・通知既読・Cronは変更なし。

## 変更ファイル

1. `backend/src/notifications.ts`：受取人ごとの権限を確認するSELECTを追加。
2. `features/sonolii/lib/notificationApi.ts`：レスポンスの型拡張。
3. `features/sonolii/screens/Notifications.tsx`：表示名および許可されたリンク。
4. `app/_components/RouteScreen.tsx`：通知画面へnavigateを渡す。
5. `tests/playwright/notifications-read.spec.mjs`：リンク先の閲覧可否を確認（読み取り専用）。
6. `tests/playwright/notifications-ui-read.spec.mjs`：Frontend smoke（読み取り専用）。
7. `package.json`：通知画面のテストコマンド。

## まとめて行う手順

### A. ソース取得・静的確認

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
npx tsc --noEmit
npm run build
node --check tests/playwright/notifications-read.spec.mjs
node --check tests/playwright/notifications-ui-read.spec.mjs
```

いずれかが失敗した場合、デプロイせずログだけ共有。

### B. Backend→Frontendの順にデプロイ

両者ともソースに静的エラーがないことを条件に実施。既存の現行環境に適用するため、既存テストユーザーの操作中には実施しない。

```bash
npx wrangler deploy --config backend/wrangler.jsonc
npm run deploy
```

Frontend は `npm run deploy` で更新する（Backendのwranglerと別）。Neon SQL適用なし。どちらも失敗した場合は停止してログ共有。

### C. 読み取り専用の自動確認

以前のClerk Playwright認証環境変数を設定する：
`CLERK_SECRET_KEY`、`CLERK_PUBLISHABLE_KEY`、`SONOLII_TEST_OWNER_EMAIL`（秘密鍵は共有しない）。

```bash
npx playwright test notifications-read.spec.mjs
npm run test:playwright:notifications-ui
```

いずれも `clerk-setup` を含めてテスト成功が期待される。API書き込みテスト、一般的な `npx playwright test` は**実行しない**。

### D. 画面で確認（最大5項目）

1. Bで `/notifications` を表示。未読件数・日時が表示される
2. 閲覧できる相手の表示名がある場合、`プロフィールを見る`で適切なユーザーへ移動する
3. 閲覧できる投稿の通知で、`投稿を見る`から投稿詳細へ移動する
4. 投稿・コメント削除、非公開など対象が閲覧不可の場合は、詳細を出さず一般的な通知文を表示する（該当データが無ければ無理に新規作成しない）
5. 個別既読・一括既読ボタンは表示を確認するだけ。**既存の未読を操作しない**。

## 未検証・今後の課題

- 可視性が変化するケース（公開→followers/private、フォロー解除、投稿・コメント削除）をE2Eで厳密検証するには、専用DBまたはテスト用レコードを使った書き込みテストが必要。
- `follow_request` は通知画面に種別を表示する。承認・却下はフォロー申請画面/既存APIで行い、通知画面には専用アクションをまだ置いていない。
- 既読一括処理は専用の未読0件ユーザーを用意できたときにテスト。
- 新デプロイの通知自動削除Cronは、次回UTC3時実行後にCloudflare Observabilityで確認。
