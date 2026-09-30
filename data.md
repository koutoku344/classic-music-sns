# データ設計書

## 1. 目的

本書は、本サービスで管理する主要Entity、Relationおよびデータ管理方針を定義する。

* Relational Data：Neon PostgreSQL
* 音声・画像：Cloudflare R2
* 認証情報：Clerk
* 決済情報：Stripe

---

# 2. ER概要

```text
Composer
   │
   └──< Piece
          ├──< Repertoire >── User
          ├──< Performance ── User
          ├──< PracticeItem
          └──< Recruitment

User
 ├──< PracticeRecord
 │       └──< PracticeItem
 │
 ├──< Post
 │      ├──< Media
 │      ├──< Comment
 │      └──< Like >── User
 │
 ├──< Follow >── User
 │
 ├──< Recruitment
 │       └──< Application
 │
 ├──< ConversationMember
 │       └── Conversation
 │              └──< Message
 │
 ├──< Notification
 └── Subscription
```

`Composer`、`Piece`、`Performance`、`Post`を独立Entityとする。

---

# 3. Entity一覧

| Entity             | 目的                      |
| ------------------ | ----------------------- |
| User               | ユーザー・プロフィール             |
| Composer           | 作曲家Master               |
| Piece              | 楽曲Master                |
| Repertoire         | ユーザーのレパートリー             |
| Performance        | 演奏履歴                    |
| PracticeRecord     | 日付単位の練習記録             |
| PracticeItem       | 練習記録内の曲ごとの練習内容       |
| Post               | SNS投稿                   |
| Media              | 音声・画像Metadata           |
| Comment            | コメント・Timestamp Feedback |
| Like               | 投稿へのいいね                 |
| Follow             | User間のFollow            |
| Recruitment        | 演奏者募集                   |
| Application        | 募集への応募                  |
| Conversation       | 個人チャット                  |
| ConversationMember | チャット参加者                 |
| Message            | チャットMessage             |
| Notification       | 通知                      |
| Subscription       | Free / Premium契約状態      |

---

# 4. 主要Entity

## 4.1 User

| 項目            | 内容            |
| ------------- | ------------- |
| id            | User ID       |
| clerk_user_id | Clerk User ID |
| display_name  | 表示名           |
| bio           | プロフィール一言・自己紹介 |
| instrument    | 主な楽器          |
| region        | 地域            |
| created_at    | 作成日時          |
| updated_at    | 更新日時          |

`clerk_user_id`はUniqueとする。

---

## 4.2 Composer

作曲家Masterとして管理する。

| 項目         | 内容          |
| ---------- | ----------- |
| id         | Composer ID |
| name       | 表示名         |
| name_en    | 英語名         |
| birth_year | 生年          |
| death_year | 没年          |

Pieceから共通参照する。

---

## 4.3 Piece

楽曲Masterとして管理する。

| 項目                  | 内容                    |
| ------------------- | --------------------- |
| id                  | Piece ID              |
| composer_id         | Composer              |
| title               | 曲名                    |
| title_en            | 英語名                   |
| catalog_number      | BWV / K. / Op.等       |
| source_type         | master / user         |
| created_by          | User追加時のUser ID       |
| verification_status | verified / unverified |
| merged_into_id      | 統合先Piece ID           |
| created_at          | 作成日時                  |
| updated_at          | 更新日時                  |

サービス開始時点で全クラシック作品を網羅することは必須としない。

```text
初期Master
    +
UserによるPiece追加
    ↓
Piece DBを段階的に拡充
```

---

## 4.4 Repertoire

| 項目         | 内容            |
| ---------- | ------------- |
| id         | ID            |
| user_id    | User          |
| piece_id   | Piece         |
| status     | 練習中 / レパートリー等 |
| created_at | 登録日時          |

原則 `user_id + piece_id` をUniqueとする。

---

## 4.5 Performance

| 項目           | 内容             |
| ------------ | -------------- |
| id           | Performance ID |
| user_id      | User           |
| piece_id     | Piece          |
| performed_at | 演奏日時           |
| visibility   | 公開範囲           |
| created_at   | 登録日時           |

同一Pieceについて複数回のPerformanceを登録可能とする。

---

## 4.6 PracticeRecord / PracticeItem

練習記録は日付単位の`PracticeRecord`と、その日に練習した曲単位の`PracticeItem`に分離する。

### PracticeRecord

| 項目 | 内容 |
| --- | --- |
| id | Practice Record ID |
| user_id | User |
| practice_date | 練習日 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

### PracticeItem

| 項目 | 内容 |
| --- | --- |
| id | Practice Item ID |
| practice_record_id | PracticeRecord |
| piece_id | Piece |
| duration_minutes | 練習時間（分） |
| comment | 曲ごとのコメント・課題等 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

1件のPracticeRecordに複数のPracticeItemを登録可能とする。同じデータを日付別・曲別の双方から参照する。

---

## 4.7 Post

| 項目             | 内容              |
| -------------- | --------------- |
| id             | Post ID         |
| user_id        | 投稿者             |
| piece_id       | Piece（任意）       |
| performance_id | Performance（任意） |
| body           | 本文              |
| feedback_type  | 希望するFeedback    |
| comments_enabled | Comment受付可否     |
| created_at     | 投稿日時            |
| updated_at     | 更新日時            |

---

## 4.8 Media

| 項目         | 内容            |
| ---------- | ------------- |
| id         | Media ID      |
| user_id    | Owner         |
| media_type | audio / image |
| object_key | R2 Object Key |
| size_bytes | File容量        |
| mime_type  | MIME Type     |
| duration   | 音声時間          |
| created_at | Upload日時      |

Media本体はR2へ保存する。

---

## 4.9 Comment / Like

### Comment

| 項目              | 内容              |
| --------------- | --------------- |
| id              | Comment ID      |
| post_id         | Post            |
| user_id         | User            |
| body            | コメント            |
| media_timestamp | 音声Timestamp（任意） |
| created_at      | 投稿日時            |

### Like

| 項目         | 内容    |
| ---------- | ----- |
| user_id    | User  |
| post_id    | Post  |
| created_at | いいね日時 |

`user_id + post_id` をUniqueとする。

---

## 4.10 Recruitment / Application

### Recruitment

主なデータ：

* 募集者
* Piece
* 募集楽器
* 地域
* Level
* 活動目的
* 募集内容
* 募集状態

### Application

主なデータ：

* Recruitment
* 応募User
* Message
* 応募状態

`recruitment_id + user_id` をUniqueとする。

---

## 4.11 Conversation / Message

募集等でつながったUser間の簡易チャットを管理する。

```text
Conversation
 ├── ConversationMember
 │      ├── User A
 │      └── User B
 │
 └── Message
        ├── Message 1
        └── Message 2
```

MVPでは1対1チャットを基本とする。

### Conversation

| 項目             | 内容              |
| -------------- | --------------- |
| id             | Conversation ID |
| recruitment_id | 起点となった募集（任意）    |
| created_at     | 作成日時            |

### ConversationMember

| 項目              | 内容           |
| --------------- | ------------ |
| conversation_id | Conversation |
| user_id         | User         |

### Message

| 項目              | 内容           |
| --------------- | ------------ |
| id              | Message ID   |
| conversation_id | Conversation |
| user_id         | 送信User       |
| body            | Message      |
| created_at      | 送信日時         |

将来的なGroup Chatにも拡張可能な構造とする。

---

## 4.12 Subscription

| 項目                     | 内容                     |
| ---------------------- | ---------------------- |
| user_id                | User                   |
| plan                   | free / premium         |
| stripe_customer_id     | Stripe Customer ID     |
| stripe_subscription_id | Stripe Subscription ID |
| status                 | 契約状態                   |
| current_period_end     | 契約期間終了日時               |

Card情報は保持しない。

---

# 5. Piece Master管理方針

Piece DBは以下の方針で段階的に構築する。

```text
リリース
   │
   ├─ 初期Piece Master
   │
   └─ User追加
          │
          ▼
      Piece蓄積
          │
          ▼
    運営による管理
     ├─ Master追加
     ├─ データ修正
     ├─ 重複検出
     └─ Piece統合
```

## 重複統合

既存Pieceを物理削除して参照を失わないようにする。

```text
Piece A ─┐
         ├─→ Piece C（正規Piece）
Piece B ─┘
```

統合時は、

1. Repertoire / Performance / Post等の参照を正規Pieceへ変更
2. 重複Pieceを`merged_into_id`で正規Pieceへ関連付け
3. 新規利用では正規Pieceのみを表示

とする。

これにより、リリース後でもPiece Masterの拡充・修正・重複整理を可能とする。

---

# 6. 主な制約

| 対象           | 制約                                         |
| ------------ | ------------------------------------------ |
| User         | Clerk ID Unique                            |
| Repertoire   | User + Piece Unique                        |
| PracticeRecord | User + Practice Dateを原則Unique |
| Like         | User + Post Unique                         |
| Follow       | Follower + Followee Unique / Self Follow禁止 |
| Application  | Recruitment + User Unique                  |
| Media        | Free 3GB / Premium 20GB                    |
| Media        | MVPはaudio / image                          |
| Subscription | Userにつき1契約状態                               |
| Payment      | Card情報を保持しない                               |

Foreign Keyを使用して参照整合性を維持する。

---

# 7. 削除・保持方針

Media MetadataとR2 Objectを対応させ、孤立Objectを残さない。

FreeユーザーのMediaは原則12か月を保持期間とする。

Pieceについては他データから参照されるため、重複・修正時に安易な物理削除を行わず、統合・論理管理を基本とする。

---

# 8. Index方針

主な候補：

* Piece：`composer_id`, `title`, `catalog_number`
* Post：`user_id`, `created_at`
* Comment：`post_id`, `created_at`
* Performance：`user_id`, `piece_id`, `performed_at`
* PracticeRecord：`user_id`, `practice_date`
* PracticeItem：`practice_record_id`, `piece_id`
* Like：`post_id`
* Recruitment：`status`, `region`, `instrument`
* Message：`conversation_id`, `created_at`
* Notification：`user_id`, `created_at`
* Follow：`follower_id`, `followee_id`

具体的なIndexはQuery設計後に決定する。

---

# 9. 設計方針

* Composer / PieceをMaster Dataとして管理する
* Piece Masterはリリース時点で網羅を必須としない
* UserによるPiece追加を許可する
* リリース後のMaster追加・修正・重複統合を可能とする
* Piece / Performance / Postを独立Entityとする
* Media本体はR2へ分離する
* 認証はClerk、決済はStripeへ委譲する
* Foreign Key / Unique Constraintで整合性を維持する
* 将来機能追加時も既存Entityの責務を可能な限り維持する
