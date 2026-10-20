# STEP11-T 最初のBackend自動テスト

更新日：2026-10-20
状態：**コード作成済み。テスト用API環境での実行は未実施。**

## 1. 変更内容・動作タイミング

- `tests/integration/followers-feedback.test.mjs`：Node標準テスト。A→Bフォロー申請・承認→Bのfollowers投稿でコメント作成・閲覧→いいね追加・確認→テストで作ったものだけ後片付け。
- `package.json`：`npm run test:integration:follow`を追加。実行時に上記テストを起動。
- 今回はSQL・Backendの本番コード・既存投稿データを変更しない。Vitest等の追加依存も不要。

## 2. 実行前に必ず用意するもの

**本番API・本番DBでの実行は禁止。** 書き込みテストなので隔離された専用環境を使用する。

1. Neonのテスト専用DB/Branch（できれば本番データの複製なし）。
2. 本番とは別のCloudflare Worker（例：`sonolii-api-staging`）。その`DATABASE_URL`が**テスト用Neon**に接続されていることを確認。本番Workerは上書きしない。
3. アプリに必要な既存migrationとSQL019・020・021をテスト用DBに適用済み。
4. テスト専用A/Bアカウントを作成。Bの`profiles.visibility`は`followers`、Bが所有するコメント許可済みのテスト投稿を1件。
5. 有効なA/BのClerk JWT。**チャット・GitHub・スクリーンショットにトークンを貼り付けない。**

**重要**：stagingというWorker名だけではDB隔離は保証されない。必ずWorkerの接続先DBを確認する。

## 3. テストの安全策

- `SONOLII_TEST_ISOLATED_DB=YES`がなければ起動拒否。
- 既知の本番APIホスト`sonolii-api.g57cydy6ks.workers.dev`は拒否。
- localhostまたは名前が`sonolii-api-test`/`sonolii-api-staging`で始まるホストのみ許可。
- Bの公開範囲がfollowers、テスト投稿がB所有かつコメント許可でなければ書き込み開始しない。
- A→Bに既存のaccepted関係があれば削除しない。pendingなら中断。
- テストで作成したコメントは論理削除し、テストで追加したいいね・フォローだけ解除。既存投稿・既存いいねは変更しない。
- **論理削除コメント・通知履歴はテストDBに残る**ため、完全にロールバックされるわけではない。

## 4. WSLでの実行

```bash
cd ~/classic-music-sns
git fetch origin
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --version
npm run build
```

専用テストDBとWorkerの隔離を検証した後、環境変数を準備して実行する。

```bash
export SONOLII_TEST_ISOLATED_DB=YES
export SONOLII_TEST_API_URL="https://sonolii-api-staging.<your-subdomain>.workers.dev"
export SONOLII_TEST_OWNER_ID="BのSonolii UUID"
export SONOLII_TEST_POST_ID="Bの専用テスト投稿UUID"
export SONOLII_TEST_ACTOR_TOKEN="テストAの有効なClerk JWT"
export SONOLII_TEST_OWNER_TOKEN="テストBの有効なClerk JWT"

npm run test:integration:follow
```

上記は設定例であり、実際の値に置き換える。JWTをシェル履歴に残さないためには対話式入力や秘密情報管理を利用する。

期待：Nodeテスト結果がpass 1 / fail 0。失敗した場合、JWT期限・API接続先・投稿ID・公開設定を確認。テスト終了時に環境変数をunsetする。

```bash
unset SONOLII_TEST_ISOLATED_DB SONOLII_TEST_API_URL
unset SONOLII_TEST_OWNER_ID SONOLII_TEST_POST_ID
unset SONOLII_TEST_ACTOR_TOKEN SONOLII_TEST_OWNER_TOKEN
```

## 5. ChatGPT Workへの引き継ぎ

Workモードを開いて次を依頼する：

> GitHubのkoutoku344/classic-music-snsリポジトリ、feat/step11-follow-notificationsブランチのdocs/step11-T-automated-tests.mdとtests/integration/followers-feedback.test.mjsを確認してください。まず構文チェック・ビルドを実行し、専用Neon DB／専用Worker／テストA/B・有効なJWTがない場合は書き込みテストを開始せず、必要な準備だけ提示してください。隔離環境が確認できたらnpm run test:integration:followを実行し、結果・テストデータの残存・必要な修正を報告してください。本番環境や既存ユーザーデータは変更しないでください。

Workを利用するにはGitHubへのアクセスと、操作できる実行環境・認証権限が必要。WorkからWSLに直接アクセスできるとは限らない。

## 6. 次に進む条件

まず専用環境で1回成功させる。その後、GitHub Actions、他の権限テスト、通知APIの自動テストを追加する。
