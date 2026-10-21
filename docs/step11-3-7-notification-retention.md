# STEP11-3-7: 既読通知を30日後に自動削除

状態（2026-10-21）：GitHubコード反映済み。NeonへのSQL023適用・Workerデプロイ・実DB削除は**未実行**。

## 目的と仕様

- 通知を既読にした日時 `read_at` から **30日を超えた通知だけ物理削除**。
- **未読通知（read_at IS NULL）は日数に関係なく残す**。
- 30日未満・ちょうど30日の既読通知は残す（条件は `read_at < now() - interval '30 days'`）。
- 削除は既存 `sonolii-api` の定期実行 `0 3 * * *`（UTC午前3時＝日本時間12時）に追加する。新しい外部サービスの契約不要。
- 一回のCronイベントで最大500行×10バッチ＝5,000行削除。超過分は翌日のCronへ持ち越し。
- 既存 `cleanupMedia()` と並列実行し、一方のエラーがもう一方の開始を妨げない。
- 新しいHTTP APIは作らない。ユーザーによる通知一覧や個別・一括既読APIの仕様は変えない。

## 変更ファイル

- `backend/src/notifications.ts`：`cleanupExpiredNotifications(sql)` を追加。
- `backend/src/index.ts`：既存の `scheduled()` に追加。
- `db/migrations/023_notification_retention_index.sql`：期限判定用の部分インデックスを追加（既存データ削除なし）。
- `backend/wrangler.jsonc`：変更なし。Cron設定も変更なし。

## STEP11-3-7-1 コード取得・静的確認

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
npx tsc --noEmit
```

## STEP11-3-7-2 Neonで安全に事前確認（SELECTのみ）

SQL Editorで実行する：

```sql
SELECT
  COUNT(*) FILTER (WHERE read_at IS NULL) AS unread_to_keep,
  COUNT(*) FILTER (
    WHERE read_at IS NOT NULL
      AND read_at >= now() - INTERVAL '30 days'
  ) AS recent_read_to_keep,
  COUNT(*) FILTER (
    WHERE read_at < now() - INTERVAL '30 days'
  ) AS expired_read_to_delete
FROM public.notifications;
```

削除候補の中身を確認したい場合：

```sql
SELECT id, type, created_at, read_at
FROM public.notifications
WHERE read_at < now() - INTERVAL '30 days'
ORDER BY read_at, id
LIMIT 20;
```

**ここまではDBへの変更なし。** `expired_read_to_delete` が0なら、現在消える通知はない。

## STEP11-3-7-3 SQL023をNeonに適用

`db/migrations/023_notification_retention_index.sql` を、現在のSonoliiのNeon SQL Editorで**ファイル全体**実行する。インデックスのみ作成し通知は削除しない。適用前にNeonブランチ・DBを確認する。

登録確認（SELECTのみ）：

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'notifications'
  AND indexname = 'notifications_read_retention_idx';
```

## STEP11-3-7-4 Backendのデプロイ

**デプロイ後は既存Cronの次回実行時に、条件に合致する通知が自動で物理削除される**。Neonの事前SELECT結果を確認し、意図しない削除候補がないことを確認してからデプロイする。

```bash
npx wrangler deploy --config backend/wrangler.jsonc
```

デプロイ対象は `sonolii-api`。Frontendは変更しない。

通常ヘルスチェック：

```bash
curl -i https://sonolii-api.g57cydy6ks.workers.dev/health
```

## STEP11-3-7-5 動作検証

- 未読が保持されていること、30日以内の既読が残っていることはNeon SELECTで確認できる。
- 時間経過前に実データの削除を試すために、既存通知の `read_at` を過去に書き換えないこと。
- Cronを強制実行するなら、**対象が0件であることを事前に確認**すること。強制実行は既存メディアの定期削除も起動するため慎重に扱う。
- 厳密な境界・件数・ページングのテストは、別のテストDBでダミーレコードを用いるユニット/統合テストを推奨。
- 運用開始後はCloudflare Workers LogsでCronエラーを監視する。

## SQLの削除条件

```sql
WITH expired AS (
  SELECT id
  FROM public.notifications
  WHERE read_at < now() - INTERVAL '30 days'
  ORDER BY read_at, id
  LIMIT 500
  FOR UPDATE SKIP LOCKED
)
DELETE FROM public.notifications n
USING expired
WHERE n.id = expired.id
  AND n.read_at < now() - INTERVAL '30 days'
RETURNING n.id;
```

※これは**実際に削除するSQL**の説明用抜粋であり、Neon SQL Editorで直接実行する手順ではない。
