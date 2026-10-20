# STEP11-T 開発中の既存環境で実行するBackend自動テスト

更新日：2026-10-20
状態：**GitHubのテストコードを現行API向けに修正済み。API実行は未実施。**

## 方針

- **現在のNeonデータはすべて開発用のテストデータ**。既存Cloudflare APIとNeonを開発・検証に利用し、リリース時にその環境を本番へ昇格する。
- 今は別DB・別Workerを新規構築しない。
- 既存レコードがテストデータでも、**テストコードで既存データを一括削除しない**。テスト専用A/BとBの投稿を用いる。
- 公開リリース後は**この現行URLに対する書き込み自動テストを実行しない**。以後の開発・検証は別環境を作成する。

## 1. ファイル・処理・実行タイミング

| ファイル | 内容 | 動くタイミング |
| --- | --- | --- |
| `tests/integration/followers-feedback.test.mjs` | フォロー申請・承認、コメント作成・取得、いいね作成・確認・後片付け | 手動で `npm run test:integration:follow` を実行したとき |
| `package.json` | 上記Node標準テストを呼ぶnpmスクリプト | 同上 |

**SQL・Backend・Neonの既存テーブル定義は今回変更しない。** コメント作成・フォロー等は実際のAPIを呼ぶ時だけDBへ書き込まれる。

## 2. テスト実行に必要なもの

- テスト専用アカウントA（コメント・いいねする側）とB（投稿者）の**ログイン済みClerkトークン**。既存のテストA/Bを再利用可能。
- BのSonolii `users.id` とBが所有するテスト用投稿ID。
- Bのプロフィール `visibility='followers'`、投稿 `comments_enabled=true`。
- A/Bは**別の**ユーザーで、A→Bのフォロー状態は未フォローまたはaccepted。pendingが残っている場合はテスト停止。
- テスト開始前にWorkerとNeonがリリース前の開発用途であることを再確認。

## 3. 安全対策

テストコードは次の条件のどれかを満たさなければ**API呼び出し前に停止**する：

- `SONOLII_TEST_PHASE=PRE_RELEASE`
- `SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES`
- API URLが現行の `https://sonolii-api.g57cydy6ks.workers.dev` と一致
- テストユーザー2名分のJWT・BのUUID・投稿UUIDが指定されている
- CI環境変数 `CI=true` ではない

加えて、Bの公開範囲と投稿所有者・コメント許可を読み取り確認してから書き込み開始する。既存acceptedフォローと元々付いていたいいねは解除しない。

**注意：この環境変数は本番昇格を自動検知する仕組みではありません。** 現行URLはリリース後に本番になるため、リリース時にこのスクリプトの実行を停止し、将来の開発環境に移すことが必須です。CIへこの書き込みテストを追加しないでください。

## 4. WSLでの実行

```bash
cd ~/classic-music-sns
git fetch origin
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --check tests/integration/followers-feedback.test.mjs
npx tsc --noEmit
```

テスト用アカウントの認証情報を一時的な環境変数で渡す。JWTをチャット・GitHub・ログに共有しない。

```bash
export SONOLII_TEST_PHASE=PRE_RELEASE
export SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES
export SONOLII_TEST_API_URL=https://sonolii-api.g57cydy6ks.workers.dev
export SONOLII_TEST_OWNER_ID='BのSonoliiユーザーUUID'
export SONOLII_TEST_POST_ID='Bの投稿UUID'
# JWTは実行直前に期限内のものを安全な方法で設定
export SONOLII_TEST_ACTOR_TOKEN='AのClerk JWT'
export SONOLII_TEST_OWNER_TOKEN='BのClerk JWT'

npm run test:integration:follow
```

**期待**：`pass 1 / fail 0`。エラーが発生したときは本番環境や無関係のレコードに手を加えず、エラー結果を確認する。

テストで作成したコメントは**論理削除**され、通知履歴とともにNeonに残る可能性がある。成功時もDBが完全に初期状態に戻るわけではない。

```bash
unset SONOLII_TEST_PHASE SONOLII_TEST_WRITE_CONFIRM SONOLII_TEST_API_URL
unset SONOLII_TEST_OWNER_ID SONOLII_TEST_POST_ID
unset SONOLII_TEST_ACTOR_TOKEN SONOLII_TEST_OWNER_TOKEN
```

## 5. Workで実行するとき

WorkモードからGitHubを開き、`feat/step11-follow-notifications` ブランチにある本ファイルとテストコードを確認させる。Workにクラウド実行環境やClerkの認証がない場合は、**構文チェック・レビューまでWork**、実際のAPIテストは**WSL**で実施する。Workが手元のWSLやブラウザセッションに自動アクセスできるとは限らない。

Workへの依頼文：

> Sonolii（GitHub `koutoku344/classic-music-sns`、`feat/step11-follow-notifications`）の `docs/step11-T-automated-tests.md` と `tests/integration/followers-feedback.test.mjs` を確認し、構文チェック・安全性レビュー・必要な修正を行ってください。現在の `sonolii-api.g57cydy6ks.workers.dev` とNeonはリリース前の開発環境で、Neon内はテストデータです。別のDB/Workerを作らず、専用A/Bアカウントと投稿だけを利用してください。JWTや必要な接続権限が取得できなければ書き込みテストを開始せず、準備方法を示してください。実行できるなら `npm run test:integration:follow` を実施し、結果と残存データを報告してください。ソース変更・SQL変更時には内容、実行タイミング、理由、データへの影響を説明してください。公開リリース後は現行APIに対するテストを書き込まないでください。

## 6. リリース時の必須対応

1. このテストの実行を停止。環境変数を解除し、CIにも書き込みテストを登録しない。
2. テストアカウント・投稿・コメント墓石・通知・R2を棚卸しし、削除する場合は**対象IDを確認**してから個別に実行する。
3. Neonのバックアップ/復元、Clerk、R2 CORS/メディア、Worker Secrets、監視を確認する。
4. リリース後に新機能を作る際は、別の開発DB/Workerで書き込みテストを実行する。

## 7. 次工程

このテストが正常終了したらSTEP11-3-3を完了し、STEP11-3-4通知API実装に進む。
