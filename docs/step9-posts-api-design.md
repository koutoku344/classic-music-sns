# STEP9-3 Backend 投稿API 実装設計（実装前）

## 前提

- STEP9-2のマイグレーション011とINDEX整理012の適用・検証を終えてから実装する。
- STEP8の`media`は保存済み音声・画像の共通メタデータである。投稿作成でR2へ再アップロードしない。
- 投稿は本人所有の`ready`かつ未削除のMediaのみ紐付け可能。
- 入力は本文最大2000文字、画像最大5件、音声最大1件、曲は任意、最低でも本文またはメディア1つが必要。
- 全体の公開設定は`profiles.visibility`による。`public`は公開、`followers/private`は当面本人のみ。**本人以外に署名URLを渡す前**に必ず認可判定。
- フォロー・コメント・いいねはSTEP9の対象外。

## API候補（STEP9-3〜9-4）

| method | path | 用途 | 認証 |
| --- | --- | --- | --- |
| POST | /posts | 新規作成 | 必須 |
| GET | /posts | 公開タイムライン／検索（`pieceId`, `limit`, `cursor`） | 任意 |
| GET | /posts/:id | 詳細 | 任意 |
| PATCH | /posts/:id | 本人の編集 | 必須 |
| DELETE | /posts/:id | 本人の投稿削除（R2/Mediaは保持） | 必須 |
| GET | /users/:id/posts | 本人の投稿一覧／公開プロフィールの投稿一覧 | 任意 |
| POST | /posts/:id/media/:mediaId/read-url | 投稿閲覧権限を確認して短期R2 Read URLを発行 | 任意 |

`GET /posts`の検索・ページング詳細はSTEP9-3で仕様確定する。自分の投稿一覧と検索機能が同じAPIを利用できる場合、エンドポイントの追加を最小限にする。

## リクエスト案

```json
{
  "body": "演奏会の記録です",
  "pieceId": null,
  "userPieceId": null,
  "commentsEnabled": true,
  "feedbackPrefs": ["感想歓迎"],
  "mediaIds": [
    "audio-media-uuid",
    "image-media-uuid"
  ]
}
```

- 音声か画像かは`media.media_type`から判定する。クライアント申告の`media_type`を信頼しない。
- `display_order`は配列順に1から付与する。後で並べ替え操作を追加可能。
- GET/PATCH等のレスポンスではメディア参照ID・種別・表示順等を返すが、R2 Object Key・署名URLを永続データとして保存しない。

## Backend実装で検討が必要な箇所

1. `backend/src/index.ts`のルーティングとJWT任意／必須の判定。現在の`identity()`とCORSを共用する。
2. Neon HTTPクライアントのトランザクション機能／競合制御。`posts`と`post_media`の登録が部分成功しないようにする。通常の複数HTTP呼び出しを単一トランザクションとみなさない。
3. 投稿の作成・更新とメディアの論理削除が競合するケース。処理をトランザクション内で直列化する仕組みを確認。
4. 投稿者とメディア所有者の一致はDB複合FKで保証。実際の`media_type`、`upload_status`、`deleted_at`と件数はBackendでも検証。
5. 投稿閲覧権限はプロフィール単位。公開対象と本人以外には投稿本文・メディア情報・署名URLを返さない。
6. STEP8の`handleMedia`にあるゴミ箱移動・完全削除処理で`post_media`の参照もチェックする。
7. 投稿一覧は20件程度のカーソルページング（`created_at,id`）。未公開データをクライアント側だけでフィルタリングしない。
8. 本文キーワード検索と独自曲の横断検索は、具体的検索UX・クエリ・費用の確認後に別途追加する。

## 検証の順序

1. 未認証の投稿作成401、空投稿400、枚数超過400、他人のメディア指定拒否。
2. 作成成功、メディア紐付け保存、再取得による永続性確認。
3. 本人編集・削除、他人のPATCH/DELETE拒否。
4. public／followers／privateの投稿本文とRead URLの閲覧制限。
5. 投稿参照中メディアのゴミ箱移動拒否。投稿削除後にメディアが残ること。
6. カーソルページングとマスター曲IDの検索。独自曲IDの検索はSTEP9で実装しない。
