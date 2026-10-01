# アーキテクチャ設計書

## 1. 目的

本書は、クラシック奏者向けサービスのシステム構成、各コンポーネントの責務および主要なデータフローを定義する。

MVPでは以下を主要機能とする。

* 曲・レパートリー管理
* 練習記録（日付単位・曲別参照）
* 演奏履歴管理
* 音声・画像投稿
* Timeline / Feedback / Follow
* 募集掲示板
* Free / Premium管理

動画投稿・AI演奏分析はMVP対象外とする。

---

# 2. システム構成

```text
                         ┌──────────────┐
                         │    Clerk     │
                         │     Auth     │
                         └──────▲───────┘
                                │
                                │ Authentication
                                │
┌────────┐ HTTPS ┌──────────────┴─────────────┐
│  User  │──────►│ Cloudflare Workers         │
└────────┘       │ Next.js / React            │
                 │ Frontend                    │
                 └──────────────┬─────────────┘
                                │ HTTPS / API
                                ▼
                 ┌────────────────────────────┐
                 │ Cloudflare Workers         │
                 │ Backend API                │
                 └──────┬────────┬────────────┘
                        │        │
                   SQL  │        │ Payment
                        ▼        ▼
                 ┌──────────┐ ┌──────────┐
                 │   Neon   │ │  Stripe  │
                 │PostgreSQL│ │ Payment  │
                 └──────────┘ └──────────┘


                 Media Upload / Download
┌────────┐       ┌──────────────────────┐
│  User  │◄─────►│ Cloudflare R2        │
└────────┘       │ Audio / Image        │
                 └──────────────────────┘
```

---

# 3. コンポーネント

| コンポーネント          | 技術                           | 責務                             |
| ---------------- | ---------------------------- | ------------------------------ |
| Frontend         | Next.js / React / TypeScript | UI表示、ユーザー操作受付、Backend API呼出    |
| Frontend Hosting | Cloudflare Workers           | Webアプリ配信                       |
| Backend API      | Cloudflare Workers           | 業務ロジック、入力検証、認可、DB・外部サービスアクセス制御 |
| Database         | Neon PostgreSQL              | Application Dataの永続化・整合性維持     |
| Authentication   | Clerk                        | Login、認証、Session管理             |
| Object Storage   | Cloudflare R2                | 音声・画像の保存・配信                    |
| Payment          | Stripe                       | Premium決済                      |
| Source Control   | GitHub                       | Source / IaC / Document管理      |

---

# 4. Frontend

Next.js / React / TypeScriptを使用する。

主な責務：

* UI表示
* ユーザー操作受付
* Backend API呼出
* API Responseの画面反映
* Media Upload / Download

画面特性によってRendering方式を使い分ける。

| 対象        | 方式        |
| --------- | --------- |
| 公開プロフィール  | SSR / SSG |
| 公開投稿・曲ページ | SSR / SSG |
| Timeline  | CSR       |
| My Page   | CSR       |
| 投稿・編集画面   | CSR       |
| 管理系画面     | CSR       |

公開ページはSEOを考慮し、ログイン後の操作中心画面はCSRを基本とする。

Cloudflare固有機能への依存を必要最小限とし、必要に応じてFrontend Hostingを変更可能な構成とする。

---

# 5. Backend API

Backend APIはCloudflare Workersで実装する。

Backend APIはデータそのものを保持せず、FrontendからのRequestを受けて業務処理を実行し、Database・R2・Stripe等へのアクセスを制御する。

主な責務：

* Request / Response制御
* Authentication情報の検証
* Authorization
* 入力値検証
* Business Rule判定
* Databaseへの登録・更新・取得・削除
* Media Upload許可・Storage使用量判定
* Stripeとの連携
* Rate Limit

例：

```text
Frontend
   │
   │ POST /posts
   ▼
Backend API
   │
   ├─ Authentication確認
   ├─ Authorization
   ├─ 入力値検証
   ├─ Business Rule判定
   │
   └─ Database操作
          │
          ▼
        Neon
          │
          └─ Data永続化
```

Backend APIは音声・画像本体を保持・配信せず、Media Metadataのみを扱う。

---

# 6. Database

Neon PostgreSQLを使用する。

Databaseの責務はApplication Dataの永続化およびデータ整合性の維持とする。

主なデータ：

```text
User
Piece
Repertoire
Performance
Post
Media
Comment
Follow
Recruitment
Notification
Subscription
```

音声・画像本体はDatabaseに保存せず、R2 Object Key等のMetadataのみを保持する。

```text
Post
 │
 └── Media Metadata
        │
        └── R2 Object
```

Entity・Relation・Constraint・Index等はデータ設計書で定義する。

---

# 7. Media

音声・画像はCloudflare R2へ保存する。

Backend APIをMedia転送経路に含めず、FrontendとR2間でUpload / Downloadする構成を基本とする。

## Upload

```text
Frontend
 │
 │ ① Upload要求
 ▼
Backend API
 │
 ├─ Authentication / Authorization
 ├─ Storage使用量確認
 └─ Upload許可
 │
 ▼
Frontend
 │
 │ ② Media Upload
 ▼
R2
```

## Download / Playback

```text
Frontend
 │
 │ Media Request
 ▼
R2
 │
 ▼
Audio / Image
```

これによりMedia転送量増加とBackend API負荷を分離する。

Storage上限：

| Plan    | Storage |
| ------- | ------: |
| Free    |     3GB |
| Premium |    20GB |

---

# 8. Authentication / Authorization

AuthenticationはClerkを使用する。

```text
User
 │
 ▼
Clerk
 │
 │ Authentication
 ▼
Frontend
 │
 │ Token / Session
 ▼
Backend API
 │
 │ Authorization
 ▼
Resource
```

責務を以下のように分離する。

| 処理                     | 責務          |
| ---------------------- | ----------- |
| Authentication         | Clerk       |
| Authentication情報の検証    | Backend API |
| Resource Authorization | Backend API |

例：

```text
Authentication
「このUserは誰か」
        ↓
Clerk

Authorization
「このPostを編集できるか」
        ↓
Backend API
```

---

# 9. Payment

Premium決済にはStripeを使用する。

```text
User
 │
 ▼
Frontend
 │
 ▼
Stripe
 │
 │ Payment
 ▼
Webhook
 │
 ▼
Backend API
 │
 ▼
Neon
 │
 └─ Subscription情報更新
```

カード情報は本システムで保持しない。

Premium状態はStripeの決済結果と同期して管理する。

---

# 10. 主要データフロー

## 10.1 投稿作成

Media Upload後にPostを登録する。

```text
User
 │
 ▼
Frontend
 │
 │ Upload要求
 ▼
Backend API
 │
 │ Upload許可
 ▼
Frontend
 │
 │ Audio / Image
 ▼
R2


Frontend
 │
 │ Post登録
 ▼
Backend API
 │
 ├─ Authentication / Authorization
 ├─ 入力値検証
 └─ Business Rule判定
 │
 ▼
Neon
 │
 └─ Post / Media Metadata保存
```

---

## 10.2 Timeline取得・表示

```text
User
 │
 │ Timeline表示
 ▼
Frontend
 │
 │ GET /timeline
 ▼
Backend API
 │
 │ Query
 ▼
Neon
 │
 │ Post Metadata
 ▼
Backend API
 │
 │ Response
 ▼
Frontend
 │
 ├─ Post情報表示
 │
 └─ Audio / Image取得
          │
          ▼
          R2
```

Backend APIはTimeline表示に必要なMetadataを返し、Media本体はFrontendからR2へ取得する。

---

## 10.3 コメント投稿

```text
User
 │
 │ コメント入力
 ▼
Frontend
 │
 │ POST /posts/{postId}/comments
 ▼
Backend API
 │
 ├─ Authentication / Authorization
 ├─ 入力値検証
 └─ Business Rule判定
 │
 ▼
Neon
 │
 └─ Comment保存
```

---

## 10.4 音声再生

```text
User
 │
 │ 再生操作
 ▼
Frontend
 │
 │ Media Request
 ▼
R2
 │
 │ Audio
 ▼
Frontend
 │
 ▼
User
```

音声データ自体はBackend APIを経由しない。

---

# 11. 設計方針

| 項目             | 方針                          |
| -------------- | --------------------------- |
| Application    | Frontend / Backendを分離       |
| Backend        | Statelessを基本とする             |
| Database       | Relational DataはPostgreSQL  |
| Media          | Application Dataから分離してR2へ保存 |
| Authentication | Clerkへ委譲                    |
| Authorization  | Backend APIで実施              |
| Payment        | Stripeへ委譲                   |
| Media配信        | Backend APIを経由しない           |
| Cost           | Storage・API等の利用量に上限を設定      |
| Portability    | 特定Platformへの依存を必要最小限とする     |

---

# 12. 将来拡張

MVP後は需要に応じて以下を検討する。

* 動画投稿
* 動画Transcode
* HLS等の動画配信
* Teacher / Student
* Ensemble管理
* 検索基盤
* Realtime通知

動画追加時は以下のような非同期処理を想定する。

```text
R2 Original Video
       │
       ▼
Queue
       │
       ▼
Transcode Worker
       │
       ▼
R2 Compressed Video
```

将来機能を追加しても、Frontend / Backend API / Database / Object Storageの責務を可能な限り維持できる構成とする。
