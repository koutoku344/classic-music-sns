# STEP8 メディア機能：実装・検証・運用記録

更新日：2026-10-16  
対象ブランチ：`feat/step8-media`  
対象：Cloudflare Workers Backend / R2 / Neon / Frontend

> この文書はSTEP8の**現在の実装と確認結果**を記録する。将来の設計目標（Premium 20GB、Free音声12か月保持など）と混同しない。Cron自動実行の確認が終わるまではSTEP8全体を完了扱いにしない。

## 1. 実装済み

- 音声（MP3、M4A、WAV、WebM）最大200MB、画像最大10MB。R2 Private Bucket `sonolii-media` に元形式のまま保存。単一PUTであり分割アップロードは未対応。
- Clerk認証済みユーザーがBackendでUpload URLを取得し、R2へ直接PUT。その後、BackendがR2のHEADでサイズ・Content-Typeを照合してNeonの `public.media.upload_status` を `pending → ready` に更新。
- `practice_records.audio_media_id` による練習記録への音声紐付け（最大1件）。練習記録削除後も音声本体は保持。
- `/record` と `/practice/new` でブラウザ録音（最大30分）、停止・プレビュー・録り直し・保存。WebM録音時は再生時間メタデータを補正。録音画面から練習記録への音声ID引き継ぎ。
- `/settings/media` で保存済みメディア一覧、音声プレビュー、ゴミ箱への移動、復元、完全削除、使用量表示。
- 誤削除防止：練習記録で利用中の音声は削除APIが `media_in_use` で拒否。
- Freeの使用量上限は**3,000,000,000バイト**。容量計算は `pending` と `ready`（論理削除済みを含む）の合計。予約時はUser行ロックで同時実行を直列化。アップロードURLの予約頻度制限は1分10件。
- Backendのみでアクセス許可を判定し、R2への短時間署名URL（Upload 900秒、Read 300秒）を発行。FrontendとBackendは別デプロイ。
- 毎日03:00 UTC（日本時間12:00）にScheduled Handlerを実行。24時間超の `pending` を `failed` に、期限を過ぎたゴミ箱を物理削除。各処理1回最大100件。

## 2. 動作確認結果（2026-10-16）

| 項目 | 結果 | 補足 |
| --- | --- | --- |
| Backend Health / 未認証拒否 | PASS | 未認証 `/media` → HTTP 401 |
| R2への保存、Neon `ready` 化 | PASS | 実ファイルで確認 |
| 録音 → 練習記録へ紐付け → 再生 | PASS | 通常のChrome |
| WebM録音終了直後の再生時間 | PASS | Chromeで再生前に秒数表示 |
| メディア管理・使用量表示 | PASS | FrontendとBackend API |
| ゴミ箱移動・復元・完全削除 | PASS | 専用テスト音声 |
| 練習記録に紐づく音声の削除拒否 | PASS | UI/API |
| 未対応形式 | PASS | HTTP 400 |
| 音声200MB超の申告 | PASS | HTTP 400 |
| 存在しないメディアIDの参照拒否 | PASS | HTTP 404 |
| `/media/usage` | PASS | HTTP 200、画面表示と整合 |
| R2へのPUTがない状態で完了要求 | PASS | HTTP 409、再生URLはHTTP 404、Neonは`pending` |
| DB予約上限ちょうど、上限超過、Rollback | PASS | `reserve_media_upload` を検証用Quotaで実行 |
| Cronスケジュール登録 | 確認済み | Cloudflare DashboardのTrigger events |
| **Cron実行後の `pending → failed`** | **未確認** | 24時間経過後のScheduled実行待ち |
| **期限切れゴミ箱のCron自動削除** | **未確認** | 隔離環境・テストデータで別途検証 |
| 別ユーザーによる実在メディアへのアクセス拒否 | 未確認 | 2アカウントでの実機検証が必要 |
| 実際の3GB超過時のAPI HTTP 413 | 未確認 | DB関数の条件テストはPASS |
| ブラウザ互換性／スマホ／大容量実ファイル | 未確認 | Chrome以外、長時間録音・200MB付近は未確認 |

> APIやDBの単体テストのPASSを、未実施のE2E・CronテストまでPASSとみなさない。

## 3. 明日以降の最優先確認：Cron（STEP8-8-5-3）

### 前提

- Cloudflare Worker：`sonolii-api`
- 設定：`backend/wrangler.jsonc` の `triggers.crons: ["0 3 * * *"]`
- 処理入口：`backend/src/index.ts` の `scheduled()`
- 処理本体：`backend/src/media.ts` の `cleanupMedia()`
- Cronの対象：`upload_status = 'pending' AND created_at < now() - INTERVAL '24 hours'`
- 毎日日本時間12:00に実行。対象レコード作成から24時間経過した**後**の最初の実行で処理される予定。

### 1. Cloudflareの実行履歴

Cloudflare Dashboard → Workers & Pages → `sonolii-api` → **Observability** でScheduled Handlerの実行結果・エラーを確認する。

Settings → Trigger events はスケジュールの登録確認であり、成功した実行の証明ではない。

### 2. Neonでテストレコードを確認

STEP8-8-3で発行した `mediaId` を指定して実行する。

```sql
SELECT
  id,
  user_id,
  upload_status,
  size_bytes,
  created_at,
  updated_at,
  created_at + INTERVAL '24 hours' AS cleanup_eligible_at
FROM public.media
WHERE id = 'ここにSTEP8-8-3のmediaId'::uuid;
```

期待：対象のCron成功後、`upload_status = 'failed'`、`size_bytes = 1`、`updated_at` が処理時刻付近。

`pending` のままなら、対象条件・Cronログ・処理上限100件・R2削除時エラーを確認する。**本番の既存レコードの `created_at` や `purge_at` を手動変更しない。**

### 3. 容量の再確認

```sql
SELECT
  upload_status,
  count(*) AS records,
  COALESCE(sum(size_bytes), 0) AS bytes
FROM public.media
WHERE id = 'ここにSTEP8-8-3のmediaId'::uuid
GROUP BY upload_status;
```

`failed` への変更後は、`/media/usage` の `pending_bytes` 集計対象から外れる。

## 4. 運用上の注意と残課題

- Secret、Clerk Token、R2署名URLはログやGitHubに保存しない。
- 完全削除はR2とNeonの分散操作。途中失敗時の再実行・整合性回復は、リリース前に追加検証が必要。
- Scheduled Handlerは1回各100件まで。滞留増加時の監視・アラートは追加検討する。
- `failed` は使用量対象外となるが、DBレコード自体は残る。履歴レコードの整理方針は別途検討する。
- R2のTTL/Expirationは現時点でForever。リリース前に期限設計・期限切れ時のBackend側URL再取得・R2 Standard容量とClass A/B操作を含む費用見積りを再検討する。
- Premium 20GB・Free音声12か月保持は**現時点で未実装**。実際のBackendはFree 3GB固定で、録音の通常保持期限は設定していない。ゴミ箱に入れたファイルのみ30日後に削除予定。
- 投稿メディアの公開権限、他ユーザー閲覧、投稿への音声紐付けは後続STEPで実装する。

## 5. 最終検証に使うコマンド

実行場所：WSL Ubuntu、リポジトリ直下。

```bash
git pull origin feat/step8-media
npx tsc --noEmit
npm run build
```

Backend Workerを更新した場合のみ、別途以下でデプロイする。

```bash
npx wrangler deploy --config backend/wrangler.jsonc
```

FrontendとBackendは別のWorkerなので、それぞれのデプロイ結果を分けて確認する。
