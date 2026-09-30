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
| GET    | `/users/{id}/performances` | 演奏履歴取得       |
| GET    | `/users/{id}/repertoire`   | レパートリー取得     |

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

# 5. Repertoire / Performance

## Repertoire

| Method | Endpoint           | 内容      |
| ------ | ------------------ | ------- |
| POST   | `/repertoire`      | Piece登録 |
| PATCH  | `/repertoire/{id}` | 状態更新    |
| DELETE | `/repertoire/{id}` | 削除      |

## Performance

| Method | Endpoint             | 内容     |
| ------ | -------------------- | ------ |
| POST   | `/performances`      | 演奏履歴登録 |
| GET    | `/performances/{id}` | 演奏履歴取得 |
| PATCH  | `/performances/{id}` | 演奏履歴更新 |
| DELETE | `/performances/{id}` | 演奏履歴削除 |

---

# 6. Practice

| Method | Endpoint | 内容 |
| --- | --- | --- |
| GET | `/practices` | 練習記録一覧取得 |
| POST | `/practices` | 日付単位の練習記録作成 |
| GET | `/practices/{id}` | 練習記録詳細取得 |
| PATCH | `/practices/{id}` | 練習記録更新 |
| DELETE | `/practices/{id}` | 練習記録削除 |

`GET /practices` は表示方法に応じて日付別・曲別で取得できるものとする。

例：

```text
GET /api/v1/practices?view=date
GET /api/v1/practices?view=piece&piece_id=xxx
```

作成・更新時は1件のPractice Recordに複数のPiece、練習時間、Commentを含められる。

---

# 7. Post / Timeline

| Method | Endpoint      | 内容         |
| ------ | ------------- | ---------- |
| POST   | `/posts`      | Post作成     |
| GET    | `/posts/{id}` | Post取得     |
| PATCH  | `/posts/{id}` | Post更新     |
| DELETE | `/posts/{id}` | Post削除     |
| GET    | `/posts`      | Post一覧取得（ALL / Follow） |

Post一覧はPaginationを使用し、`scope`でALL / Followを切り替える。

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
| DELETE | `/media/{id}`   | Media削除             |

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
| POST   | `/subscription/checkout` | Premium申込開始      |
| POST   | `/webhooks/stripe`       | Stripe Webhook受信 |

Stripe Webhookを基にSubscription状態を更新する。

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
* Media削除：Ownerのみ
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
* Piece Master管理APIは一般User APIと分離する
* API詳細なRequest / Response Schemaは詳細設計で定義する
