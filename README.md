# Sonolii

クラシック演奏者向けSNS「Sonolii」の開発リポジトリです。

## Frontend

vinext / React / Cloudflare Workers

```bash
npm install
npm run dev
npm run build
npm run deploy
```

## Backend

Cloudflare Workers（`backend/`）。BackendのデプロイはFrontendとは別に行います。

## Note

`features/crescendo/` は既存コードの内部ディレクトリ名で、サービスの表示名とは独立しています。

## STEP8 メディア機能：検証・運用

実装済み範囲、確認済みテスト、Cronの翌日確認手順、リリース前の未対応事項は [docs/step8-media-verification.md](docs/step8-media-verification.md) を参照してください。

**保留：** STEP8-8-5-3のCron実行確認（テスト用 `pending` レコードが24時間経過後に `failed` へ変化したか）。Cloudflare ObservabilityとNeonの両方を確認します。

---

## STEP9 投稿機能（実装・総合テスト）

STEP9では投稿の作成・削除、一覧・詳細、マイページ・公開プロフィールでの投稿表示、共通曲マスターID検索、音声・画像添付と再利用を実装しています。投稿者本人のみDELETE可能。編集APIは残していますが、現在の投稿詳細UIの「…」はマイページ経由の本人投稿に限り「削除」を表示します。

**投稿の条件**：本文・音声・画像のいずれか1つ以上。曲の選択は任意ですが、曲を指定した場合は音声が必須です。音声最大1件、画像最大5件。

総合テスト結果は [STEP9-9 完了判定と残課題](docs/step9-9-closure.md) を参照。行ロック・削除競合の実測、R2障害復旧はリリース前の未実施事項です。**開発用の既存テストデータは削除しません。**
