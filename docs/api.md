# API設計書

## 1. 目的

本書は、FrontendとBackend API間の主要APIおよび基本仕様を定義する。

* API：Cloudflare Workers
* Authentication：Clerk
* Database：Neon PostgreSQL
* Media：Cloudflare R2

---

# 2. 基本方針

* REST APIを基本とする
* JSON形式でRequest / Responseを行う
* HTTPSのみ使用する
* 認証が必要なAPIはClerkの認証情報を使用する
* Resource単位でAuthorizationを実施する
* 一覧取得はPaginationを使用する
* Media本体はBackend APIを経由しない
* APIにはRate Limitを設定する

Base Path：

```text
/api/v1
```

---

# 3. User

| Method | Endpoint                   | 内容           |
| ------ | -------------------------- | ------------ |
| GET    | `/users/{id}`              | Profile取得    |
| GET    | `/users/me`                | 自分のProfile取得 |
| PATCH  | `/users/me`                | Profile更新    |
| DELETE | `/users/me`                | 退会申請（30日猶予開始） |
| POST   | `/users/me/restore`        | 退会取消 |
| GET    | `/users/{id}/performances` | 演奏履歴取得       |
| GET    | `/users/{id}/repertoire`   | レパートリー取得     |

---

Account削除は即時物理削除せず`deleting`状態へ遷移する。退会申請後はLogin・公開Profile等を停止し、30日以内のみ復旧可能とする。30日経過後の物理削除はSystem処理で行う。

新規登録時のEmail VerificationはClerkで必須化する。

---

# 4. Composer / Piece

| Method | Endpoint          | 内容             |
| ------ | ----------------- | -------------- |
| GET    | `/composers`      | Composer検索・一覧  |
| GET    | `/composers/{id}` | Composer取得     |
| GET    | `/pieces`         | Piece検索・一覧     |
| GET    | `/pieces/{id}`    | Piece取得        |
| POST   | `/pieces`         | UserによるPiece追加 |

Piece検索では以下を主な検索条件とする。

```text
title
composer
catalog_number
```

Piece Masterの修正・統合等の管理APIは一般User向けAPIと分離する。

---

# 5. User Pieces / Repertoire / Performance

## User Pieces（手動登録のユーザー固有曲）

すべてClerk認証必須。ユーザーIDはJWTから解決し、Clientのuser_id指定を信用しない。

| Method | Endpoint | 内容 | 成功 |
| --- | --- | --- | --- |
| GET | `/me/pieces` | 本人の手動登録曲一覧 | 200 |
| POST | `/me/pieces` | 手動曲の新規作成・正規化一致時の既存ID再利用 | 201（新規）/200（再利用） |
| PATCH | `/me/pieces/{id}` | 本人の手動登録曲の名称編集（STEP7ではUIなし） | 200 |

POST body: `{"composer":"J.S. Bach","title":"Partita No.2"}`。前後空白除去・大小文字無視した作曲者名+曲名で本人の既存曲が一致する場合は既存IDを再利用する。同時登録の競合もDBのUnique制約で処理する。

PATCH body: `{"composer":"J.S. Bach","title":"Partita No.2 Allemande"}`。IDは変更しない。既存曲との正規化名称衝突は409、本人以外・存在しないIDは404。STEP7では削除APIなし。

## Repertoire

| Method | Endpoint | 内容 |
| --- | --- | --- |
| GET | `/me/repertoire` | 本人のレパートリー取得 |
| POST | `/me/repertoire` | 共通マスタまたは本人の手動曲を登録 |
| PATCH | `/me/repertoire/{id}` | 状態更新 |
| DELETE | `/me/repertoire/{id}` | レパートリーから削除（user_piecesは保持） |

POSTは `{"pieceId":"UUID","status":"practicing"}` または `{"userPieceId":"UUID","status":"practicing"}`。どちらか一方だけ指定する。既存の `customComposer/customTitle` リクエストはSTEP7のFrontend更新後に廃止する。レスポンスは `piece_id` / `user_piece_id` と作曲者・曲名を返す。ほかのユーザーの `userPieceId` は404。

## Performance

| Method | Endpoint | 内容 |
| --- | --- | --- |
| POST | `/performances` | 演奏履歴登録 |
| GET | `/performances/{id}` | 演奏履歴取得 |
| PATCH | `/performances/{id}` | 演奏履歴更新 |
| DELETE | `/performances/{id}` | 演奏履歴削除 |

---

# 6. Practice

**1記録 = 1曲**。同一日・同一曲に複数記録を許可する。すべて本人の認証必須。

| Method | Endpoint | 内容 | 成功 |
| --- | --- | --- | --- |
| GET | `/practices` | 練習記録一覧・集計に必要なデータ | 200 |
| POST | `/practices` | 1曲の練習記録作成 | 201 |
| GET | `/practices/{id}` | 本人の練習記録詳細 | 200 |
| PATCH | `/practices/{id}` | 記録の編集 | 200 |
| DELETE | `/practices/{id}` | 記録の削除 | 204 |

### Request

POST body例：

```json
{
  "practiceDate": "2026-10-14",
  "userPieceId": "550e8400-e29b-41d4-a716-446655440000",
  "durationMinutes": 45,
  "comment": "中間部を練習"
}
```

`pieceId`（共通マスタ）または `userPieceId`（本人の手動登録曲）を必ずどちらか一方指定する。日付はYYYY-MM-DD、durationMinutesは整数1〜1440、commentは最大2000文字。PATCHは変更後の全フィールドを指定する（全量置換の更新契約）。Bodyに `user_id` は受け付けない。

### Response

GET一覧の例：

```json
{
  "practices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "practice_date": "2026-10-14",
      "piece_id": null,
      "user_piece_id": "550e8400-e29b-41d4-a716-446655440000",
      "composer_name": "J.S. Bach",
      "piece_title": "Partita No.2",
      "duration_minutes": 45,
      "comment": "中間部を練習",
      "created_at": "2026-10-14T01:00:00Z",
      "updated_at": "2026-10-14T01:00:00Z"
    }
  ]
}
```

GET / PATCH 詳細のレスポンスは `{"practice":{...}}`、POSTも同形式とする。DELETEはbodyなしの204。

一覧Queryは `from` / `to` （YYYY-MM-DD、双方指定）、`limit`（1〜100、デフォルト50）、`cursor`（次ページ取得用、不透明文字列）を採用する。新しい練習日→作成日時→ID順で並べ、`nextCursor` がNULLになるまでページング可能とする。日付別・曲別集計は、取得期間内の**全件**から集計し、1ページ分だけを合計しない。STEP7の実装では必要に応じ集計クエリを別途発行する。

### Error / Authorization

未認証401、形式不正400、本人以外または存在しない記録/手動曲ID404、名称重複409、Body超過413、内部障害500。本人の練習記録のみをSQLの `user_id` 条件で取得・更新・削除する。FrontendはAPIの成功後に一覧へ反映し、失敗時は保持する。音声の送受信・メタデータ参照はSTEP8で実装する。

---

# 7. Post / Timeline

| Method | Endpoint      | 内容         |
| ------ | ------------- | ---------- |
| POST   | `/posts`      | Post作成     |
| GET    | `/posts/{id}` | Post取得     |
| PATCH  | `/posts/{id}` | Post更新     |
| DELETE | `/posts/{id}` | Post削除     |
| GET    | `/posts`      | Post一覧取得（ALL / Follow） |

Post一覧はCursor Paginationを使用し、基本取得件数を20件程度とする。Userが続きを必要とした場合のみ次のDataを取得し、`scope`でALL / Followを切り替える。

例：

```text
GET /api/v1/posts?scope=all&cursor=xxx&limit=20
GET /api/v1/posts?scope=following&cursor=xxx&limit=20
```

Post作成・更新時には`comments_enabled`を指定できる。

---

# 8. Comment / Like

## Comment

| Method | Endpoint               | 内容          |
| ------ | ---------------------- | ----------- |
| GET    | `/posts/{id}/comments` | Comment一覧取得 |
| POST   | `/posts/{id}/comments` | Comment投稿   |
| DELETE | `/comments/{id}`       | Comment削除   |

音声へのFeedbackでは`media_timestamp`を指定可能とする。Postの`comments_enabled=false`の場合はComment投稿を拒否する。

## Like

| Method | Endpoint            | 内容        |
| ------ | ------------------- | --------- |
| POST   | `/posts/{id}/likes` | いいね       |
| DELETE | `/posts/{id}/likes` | いいね解除     |
| GET    | `/posts/{id}/likes` | いいねUser取得 |

同一Userによる重複Likeは禁止する。

---

# 9. Follow

| Method | Endpoint                | 内容          |
| ------ | ----------------------- | ----------- |
| POST   | `/users/{id}/follow`    | Follow      |
| DELETE | `/users/{id}/follow`    | Follow解除    |
| GET    | `/users/{id}/followers` | Follower取得  |
| GET    | `/users/{id}/following` | Following取得 |

Self Followは禁止する。

---

# 10. Media

Media本体はFrontendとR2間で直接転送する。

Backend APIはUpload許可およびMetadata管理を担当する。

```text
Frontend
   │
   │ Upload要求
   ▼
Backend API
   │
   ├─ Authentication
   ├─ File情報確認
   ├─ Storage容量確認
   └─ Upload許可
   │
   ▼
Frontend
   │
   │ Upload
   ▼
R2
```

| Method | Endpoint        | 内容                  |
| ------ | --------------- | ------------------- |
| POST   | `/media/upload` | Upload許可取得          |
| POST   | `/media`        | Upload完了・Metadata登録 |
| GET    | `/media/deleted` | 最近削除したMedia一覧取得 |
| DELETE | `/media/{id}` | Logical Deleteし「最近削除したMedia」へ移動 |
| POST   | `/media/{id}/restore` | 削除済みMediaを復元 |
| DELETE | `/media/{id}/permanent` | 削除済みMediaを完全削除 |

Upload時に以下を確認する。

* Media Type
* File Size
* Storage使用量
* User Plan
* Rate Limit

Storage上限：

```text
Free       3GB
Premium   20GB
```

Storage使用量にはActive Mediaと「最近削除したMedia」の両方を含める。

通常の削除ではR2 Objectを即時に物理削除せず、30日間「最近削除したMedia」として保持する。保持期間中はUser自身で復元または完全削除できる。完全削除または30日経過後にR2 Objectを物理削除し、Storage容量を解放する。

---

# 11. Recruitment / Application

## Recruitment

| Method | Endpoint             | 内容      |
| ------ | -------------------- | ------- |
| GET    | `/recruitments`      | 募集検索・一覧 |
| POST   | `/recruitments`      | 募集作成    |
| GET    | `/recruitments/{id}` | 募集詳細    |
| PATCH  | `/recruitments/{id}` | 募集更新    |
| DELETE | `/recruitments/{id}` | 募集削除    |

主な検索条件：

```text
scope (all / following)
piece
instrument
region
level
status
```

`scope=following`ではFollowしているUserが作成した募集を取得する。

## Application

| Method | Endpoint                          | 内容     |
| ------ | --------------------------------- | ------ |
| POST   | `/recruitments/{id}/applications` | 応募     |
| GET    | `/recruitments/{id}/applications` | 応募者一覧  |
| PATCH  | `/applications/{id}`              | 応募状態更新 |

---

# 12. Conversation / Message

MVPでは簡易的な1対1チャットを提供する。

| Method | Endpoint                       | 内容             |
| ------ | ------------------------------ | -------------- |
| GET    | `/conversations`               | Conversation一覧 |
| POST   | `/conversations`               | Conversation作成 |
| GET    | `/conversations/{id}/messages` | Message取得      |
| POST   | `/conversations/{id}/messages` | Message送信      |

Message取得にはPaginationを使用する。

Conversation参加者以外からのアクセスは禁止する。

---

# 13. Notification

| Method | Endpoint                   | 内容   |
| ------ | -------------------------- | ---- |
| GET    | `/notifications`           | 通知一覧 |
| PATCH  | `/notifications/{id}/read` | 既読化  |

MVPではIn-App Notificationのみを必須とする。

通知対象例：

* Comment
* Like
* Follow
* Recruitment Application
* Application状態変更
* Message

---

# 14. Subscription

| Method | Endpoint                 | 内容               |
| ------ | ------------------------ | ---------------- |
| GET    | `/subscription`          | 契約状態取得           |
| POST   | `/subscription/checkout` | Premium申込開始（Stripe Checkout） |
| POST   | `/subscription/portal` | Stripe Customer Portal Session作成 |
| POST   | `/webhooks/stripe`       | Stripe Webhook受信 |

Stripe Webhookを基にSubscription状態を更新する。解約・支払方法変更・決済履歴確認等はStripe Customer Portalを利用する。

Plan別制御はBackend APIで実施する。Media Upload等ではSubscriptionのPlanを確認し、Free 3GB / Premium 20GB等の制限をBackendで判定する。Frontendの表示制御のみをSecurity境界としない。

Card情報はBackendで保持しない。

---

# 15. Authentication / Authorization

認証が必要なRequestはClerkの認証情報を使用する。

```text
Frontend
   │
   │ Request + Authentication
   ▼
Backend API
   │
   ├─ Authentication検証
   └─ Authorization
          │
          ▼
       Resource
```

主なAuthorization：

* Post更新・削除：投稿者のみ
* Performance更新・削除：Ownerのみ
* Media削除・復元・完全削除：Ownerのみ
* Practice更新・削除：Ownerのみ
* Recruitment更新・削除：募集者のみ
* Application一覧：募集者のみ
* Conversation：参加者のみ

---

# 16. Response / Error

HTTP Status Codeを基本とする。

| Status | 内容                        |
| ------ | ------------------------- |
| 200    | Success                   |
| 201    | Created                   |
| 204    | Success / Response Bodyなし |
| 400    | Invalid Request           |
| 401    | Unauthenticated           |
| 403    | Unauthorized              |
| 404    | Resource Not Found        |
| 409    | Duplicate / Conflict      |
| 413    | File Size Over            |
| 429    | Rate Limit                |
| 500    | Internal Server Error     |

Error Responseは共通形式とする。

```json
{
  "error": {
    "code": "STORAGE_LIMIT_EXCEEDED",
    "message": "Storage limit exceeded."
  }
}
```

---

# 17. 設計方針

* RESTを基本とする
* API VersionをPathで管理する
* AuthenticationとAuthorizationを分離する
* Media本体はBackend APIを経由させない
* 一覧APIはPaginationを使用する
* Search条件・取得件数に上限を設定する
* Rate Limitにより大量Requestを防止する
* Mediaの通常削除はLogical Deleteとし、物理削除を分離する
* Piece Master管理APIは一般User APIと分離する
* API詳細なRequest / Response Schemaは詳細設計で定義する
