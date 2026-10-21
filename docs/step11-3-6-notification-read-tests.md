# STEP11-3-6 通知の既読APIテスト

2026-10-21 作成。GitHubコードのみ変更済み。**Playwright書き込みテストは未実行**。

## 目的

- 自分宛ての新規通知だけを個別既読にできる
- 他人宛ての通知は404（既読にできない）
- 同じ通知を2回既読にしても、`read_at` は変わらない
- 未読件数が正しく減少する
- 一括既読は**既存未読が0件のテスト用アカウントに限り**実施する

## 安全上の制約

- デプロイ済みの `sonolii-api` を使う。Backend変更、SQL適用は不要。
- テストは既存の実ユーザーに対する操作に使わない。公開リリース後には実行しない。
- AがBのテスト投稿に専用コメントを作り、そこで発生した **新規通知だけ**を既読化する。
- 個別既読テストは、元々ある未読通知を触らない。
- 一括既読テストは、既存未読が1件以上なら **skip** する。以前の通知生成テストの通知が未読で残っている場合はskipが正常。
- 一括既読の動作を検証するには、最初から未読0件の**専用テストユーザー・投稿**が必要。テストのために既存未読を一括既読にしてはならない。
- 通知は削除しない。コメントは論理削除。失敗・通信断時にはテスト用レコードが残る可能性がある。
- 一括既読はAPIの仕様上、同時に生成された通知も既読化するため、テスト中に別の操作を行わない。

## WSLでの手順

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
node --check tests/playwright/notifications-mark-read.spec.mjs
```

前回と同じClerk認証用環境変数を使用する：

- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `SONOLII_TEST_ACTOR_EMAIL`
- `SONOLII_TEST_OWNER_EMAIL`

書き込みテストのガードとフィクスチャ：

```bash
export SONOLII_TEST_PHASE=PRE_RELEASE
export SONOLII_TEST_WRITE_CONFIRM=I_CONFIRM_TEST_WRITES
export SONOLII_TEST_API_URL=https://sonolii-api.g57cydy6ks.workers.dev
export SONOLII_TEST_OWNER_ID='BのSonolii UUID'
export SONOLII_TEST_POST_ID='Bの投稿UUID'
```

実行（Neonへの書き込みあり）：

```bash
npm run test:playwright:notifications-read-state
```

通常、`clerk-setup` と「個別既読」テストが成功し、一括既読テストは既存未読がある場合 `skipped` になる。**skipは一括既読の成功を意味しない**。

## 次の工程

既読30日後の物理削除は未実装。既存Workersの定期実行処理と共存する形で、通知だけを期限条件付きで削除する処理を検討する。
