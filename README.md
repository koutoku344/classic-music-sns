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
