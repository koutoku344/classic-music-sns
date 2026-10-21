# STEP11-3-1 フォロー操作DB関数・適用手順

作成：2026-10-20
状態：**SQL作成済み・Neon未適用**。STEP11-2のSQL019が適用済みであること。
ファイル：[020_follow_functions.sql](../db/migrations/020_follow_functions.sql)

## 1. 対象と変更範囲

- `public.request_follow(actor,target)`：公開相手は即時accepted、followers/privateはpending。拒否済みなら待機期間なしで再申請し、pending/acceptedの二重実行は冪等。
- `public.respond_follow(actor,follow_id,accept)`：申請を受けた本人のみ、pendingの承認・拒否。重複する同操作は冪等。
- `public.remove_follow(actor,other_user,remove_follower)`：自分のpending申請取り消し／acceptedフォロー解除、または自分のacceptedフォロワー削除。重複削除は成功扱い。
- フォロー発生・申請・承認通知を状態変更と**同一DBトランザクション**で保存。自分へのフォローは禁止。通知は`event_key`で一意。
- `profiles`対象行をロックして、同一フォロー先への並列操作を直列化。既存データを変更するDDLなし。
- **重要：SQL019の`follows`・`notifications`はそのまま使用。020には既存データのDELETE/UPDATEはなく、3つの新規DB関数を定義するだけ。** 関数をAPIが呼ぶ段階ではじめて個別ユーザーのフォロー／通知データが増える。

## 2. 適用前確認（Neon SQL Editor）

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users','profiles','follows','notifications')
ORDER BY table_name;
```

期待：`follows`, `notifications`, `profiles`, `users` の4行。

```sql
SELECT
  (SELECT count(*) FROM public.follows) AS follows_count,
  (SELECT count(*) FROM public.notifications) AS notifications_count;
```

初回実装直後はそれぞれ0件を想定。別の値の場合は記録しておき、勝手に削除しない。

## 3. SQL020適用

GitHubの`020_follow_functions.sql`全文（BEGINからCOMMIT）をNeon SQL Editorで**1回だけ実行**する。SQL019を再実行しない。APIのデプロイはまだ行わない。

## 4. 適用後の参照専用確認

```sql
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS result_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('request_follow','respond_follow','remove_follow')
ORDER BY p.proname;
```

期待：3行（request_follow、respond_follow、remove_follow）。
特定の関数の引数・戻り値が本文と異なる場合はSTEP11-3-2へ進まず確認する。

```sql
SELECT
  (SELECT count(*) FROM public.follows) AS follows_count,
  (SELECT count(*) FROM public.notifications) AS notifications_count;
```

期待：適用前から変化なし。

## 5. 次工程

STEP11-3-2でBackendのAPIルーティング・Clerk JWT認証・ユーザーID検証・プロフィール設定制限・エラーハンドリングを実装する。
API経由で`public.request_follow()`等を呼び、別アカウント間の申請・承認・拒否・再申請・解除・同時リクエストを検証する。

**フォロワー限定コンテンツの権限変更は、STEP11-3-2とは別に横断的に行う。** 投稿一覧・詳細、プロフィール、コメント、メディア署名URL全経路の改修が完了するまで「followersが閲覧可能」とは扱わない。

通知の投稿コメント・いいね連携、通知一覧API・30日削除ジョブも後工程。現段階ではフォロー関連通知のみDB関数内で生成。
