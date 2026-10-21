# STEP11 統合確認（自動テスト優先）

更新日: 2026-10-21

## 方針
- 既存の開発用NeonとCloudflare Workersを使用する。
- 最初は読み取り専用テストをまとめて実施し、ブラウザの手動確認を最小限にする。
- 本番昇格後のAPI書き込みテストは禁止。テスト専用A/Bと必要な実行ガードなしに書き込みテストを実行しない。
- 実装が存在することとテストが通ったことは分けて記録する。

## 今回の追加
- `tests/playwright/step11-navigation-read.spec.mjs`
  - 通知から投稿へ移動し、閲覧可能な投稿または安全な案内画面が表示されることを確認。
  - 通知一覧へ戻れることを確認。
  - 指定した他ユーザーの基本プロフィールとフォロー状態ボタンを読み取り確認。
  - いいね、フォロー、承認、既読などの**書き込み操作は行わない**。
- `npm run test:step11:static` と `npm run test:step11:read` を追加。
- 対象の通知やプロフィールを準備できない場合、該当テストを skip として記録する（合格とは扱わない）。

## WSL まとめて確認

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
git status --short
node --check tests/playwright/step11-navigation-read.spec.mjs
npm run test:step11:static
npx tsc --noEmit
npm run build
```

Playwright は既存の `tests/playwright/clerk.setup.mjs` と `playwright.config.mjs` を使用。Clerk テスト環境の `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `SONOLII_TEST_OWNER_EMAIL` をローカルで設定。値をGitHubやチャットに貼り付けない。

任意: 他ユーザーのUUID（本人と異なる有効なSonolii UUID）を設定する。指定しない場合、基本プロフィールのテストは skip。

```bash
export SONOLII_TEST_TARGET_USER_ID='テスト用の相手ユーザーUUID'
npm run test:step11:read
```

結果は `passed / skipped / failed` を確認。skip の場合は実データに対象がない可能性がある。書き込みせず、テスト用フィクスチャを用意したときに再実行する。

## 次工程
- 専用A/Bによるフォロー申請→通知→承認→閲覧可否の書き込みE2E。
- 対応済み/取り消し済み通知、通知既読、公開範囲変更の境界条件。
- Cron の既読30日後削除についてCloudflare実行ログ確認。
- 実際のデータ更新テストは上記と分離し、対象ID・事前状態・後片付け・秘密情報を事前に確認してから実施する。

