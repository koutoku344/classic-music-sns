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
   └──< Piece（共通マスタ）
          ├──< Repertoire >── User
          ├──< PracticeRecord >── User
          ├──< Performance ── User
          └──< Recruitment

User
 ├──< UserPiece（本人の手動登録曲）
 │       ├──< Repertoire
 │       └──< PracticeRecord
 ├──< PracticeRecord（1記録 = 1曲）
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
| UserPiece          | ユーザー固有の手動登録曲（本人のみ利用） |
| Repertoire         | ユーザーのレパートリー             |
| Performance        | 演奏履歴                    |
| PracticeRecord     | 1件1曲の練習記録（同日複数件可）    |
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
| status        | active / deleting |
| deletion_requested_at | 退会申請日時（通常時NULL） |
| scheduled_delete_at | 完全削除予定日時（通常時NULL） |
| created_at    | 作成日時          |
| updated_at    | 更新日時          |

`clerk_user_id`はUniqueとする。

退会申請時は`status=deleting`とし、30日間User Dataを保持する。退会取消時は`active`へ戻す。30日経過後は本人固有Dataを物理削除する。

### UserInstrument

| 項目 | 内容 |
| --- | --- |
| id | ID |
| user_id | User |
| instrument | 楽器 |
| experience_years | 演奏歴（年） |
| is_primary | 主な楽器か |

### UserActivityPurpose

| 項目 | 内容 |
| --- | --- |
| user_id | User |
| purpose | 活動目的 |

活動目的は複数選択可能とし、自由記述はUserの`bio`で補完する。

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

## 4.4 UserPiece / Repertoire

`user_pieces` は本人が手動入力した曲の独立マスタで、レパートリーから削除しても消さない。共通マスタ`pieces`とは別IDで管理し、同じ作曲者名・曲名でも自動統合しない。

### user_pieces

| 項目 | 型・制約 |
| --- | --- |
| id | UUID PK |
| user_id | UUID NOT NULL / users FK / ON DELETE CASCADE |
| composer | VARCHAR(120) NOT NULL / trim後非空 |
| title | VARCHAR(240) NOT NULL / trim後非空 |
| created_at / updated_at | TIMESTAMPTZ NOT NULL |

同一ユーザー内の `lower(btrim(composer))` + `lower(btrim(title))` をUNIQUEとする（内部の空白差・略称差は統合しない）。既登録の組み合わせを再入力したときは、新規IDを発行せず既存IDを返す。編集APIは提供するがSTEP7で編集画面は設けず、削除APIも設けない。

### user_repertoire（STEP7変更後）

| 項目 | 型・制約 |
| --- | --- |
| id | UUID PK |
| user_id | UUID NOT NULL / users FK |
| piece_id | UUID NULL / 共通pieces FK |
| user_piece_id | UUID NULL / 本人のuser_piecesを参照 |
| status | practicing / repertoire / performed（既存DB制約を維持） |
| created_at / updated_at | TIMESTAMPTZ NOT NULL |

`piece_id` と `user_piece_id` は必ずどちらか一方のみを指定。所有者と楽曲IDの組み合わせで複合FKを設定し、他人の `user_pieces` を参照させない。マスタ曲とユーザー固有曲はそれぞれユーザー内で重複登録を防止する。レパートリー削除は `user_repertoire` の行のみを削除する。

既存の `custom_composer`・`custom_title` はSTEP7で廃止する。既存手動曲が**0件**の場合のみマイグレーション可能とし、残存する場合はトランザクションを中断してデータ損失を防ぐ。移行処理は今回実装しない。

---

## 4.5 Performance

| 項目 | 内容 |
| --- | --- |
| id | Performance ID |
| user_id | User |
| piece_id | Piece（将来、user_piece_id対応をSTEP8で検討） |
| performed_at | 演奏日時 |
| visibility | 公開範囲 |
| created_at | 登録日時 |

同一Pieceについて複数回のPerformanceを登録可能とする。

---

## 4.6 PracticeRecord

`practice_records` は**1行 = 1曲の練習記録**であり、`practice_items` は作成しない。同一ユーザー・日付・曲に複数行を許可する。

| 項目 | 型・制約 |
| --- | --- |
| id | UUID PK |
| user_id | UUID NOT NULL / users FK / ON DELETE CASCADE |
| piece_id | UUID NULL / 共通pieces FK |
| user_piece_id | UUID NULL / 本人のuser_piecesを参照 |
| practice_date | DATE NOT NULL |
| duration_minutes | INTEGER NOT NULL / 1〜1440 |
| comment | VARCHAR(2000) NOT NULL DEFAULT '' |
| created_at / updated_at | TIMESTAMPTZ NOT NULL |

`piece_id` と `user_piece_id` の一方のみ設定するCHECK制約を適用。本人の手動曲のみ参照できるよう `(user_id, user_piece_id)` 複合FKを設定する。曲別実績は、共通曲なら `piece_id`、手動曲なら `user_piece_id` で集計する。日別・週別・月別は `practice_date` で集計する。タイムゾーン変換で練習日を変えない。

音声オブジェクトのメタデータ・練習記録への紐づけはSTEP8で設計し、本STEPではオブジェクトキーを追加しない。

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
| deleted_at | Logical Delete日時（Active時はNULL） |
| purge_at   | 物理削除予定日時（削除時は原則deleted_at + 30日） |
| created_at | Upload日時      |

Media本体はR2へ保存する。

---

## 4.9 Comment / Like

### Comment

| 項目              | 内容              |
| --------------- | --------------- |
| id              | Comment ID      |
| post_id         | Post            |
| user_id         | User（完全退会後はNULL可） |
| body            | コメント            |
| media_timestamp | 音声Timestamp（任意） |
| created_at      | 投稿日時            |

### Like

| 項目         | 内容    |
| ---------- | ----- |
| user_id    | User  |
| post_id    | Post  |
| created_at | いいね日時 |

退会申請中のUserが作成したCommentは表示上「退会済みユーザー」とする。30日経過後のAccount完全削除時は`Comment.user_id`をNULLにし、Comment本文を保持する。

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

## 4.12 Notification

MVPではIn-App Notificationを管理する。

| 項目 | 内容 |
| --- | --- |
| id | Notification ID |
| user_id | 通知先User |
| actor_user_id | 操作User（NULL可） |
| type | comment / follow / recruitment_application / application_status / message等 |
| target_type | 遷移先Resource種別 |
| target_id | 遷移先Resource ID |
| read_at | 既読日時 |
| created_at | 作成日時 |

---

## 4.13 Subscription

| 項目                     | 内容                     |
| ---------------------- | ---------------------- |
| user_id                | User                   |
| plan                   | free / premium         |
| stripe_customer_id     | Stripe Customer ID     |
| stripe_subscription_id | Stripe Subscription ID |
| status                 | 契約状態                   |
| current_period_end     | 契約期間終了日時               |
| cancel_at_period_end   | 期間終了時解約予定か             |

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
| UserPiece | User + 正規化した作曲者名・曲名 Unique |
| Repertoire | User + PieceまたはUserPiece Unique |
| PracticeRecord | User + Practice DateにUniqueを設定しない（複数記録可） |
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

Userによる通常のMedia削除はLogical Deleteとし、R2 Objectを即時に物理削除しない。削除済みMediaは「最近削除したMedia」として30日間保持し、User自身による復元または完全削除を可能とする。30日経過後はSystem処理でR2 Objectを物理削除する。

Storage使用量はActive Mediaと「最近削除したMedia」の合計とし、削除済みMediaもFree 3GB / Premium 20GBの上限に算入する。

FreeユーザーのMediaは原則12か月を保持期間とする。

Pieceについては他データから参照されるため、重複・修正時に安易な物理削除を行わず、統合・論理管理を基本とする。

---

# 8. Index方針

主な候補：

* Piece：`composer_id`, `title`, `catalog_number`
* Post：`user_id`, `created_at`
* Comment：`post_id`, `created_at`
* Performance：`user_id`, `piece_id`, `performed_at`
* UserPiece：`user_id`, `created_at`（名称の正規化Unique Indexとは別）
* PracticeRecord：`user_id`, `practice_date DESC`, `created_at DESC`, `id DESC`
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

---

## STEP8確定モデル（Migration 009）
- `performances` は実装しない。既存の概念図・古いPerformance節は旧構想であり、STEP8以降の採用モデルではない。
- `media`: `id`, `user_id`, `object_key`（UNIQUE）, `media_type`（audio/image）, `mime_type`, `size_bytes`, `duration_seconds`, `upload_status`（pending/ready/failed）, `deleted_at`, `purge_at`, `created_at`, `updated_at`。実体はprivateなR2 Object。
- `practice_records.audio_media_id` はnullableで、1レコード1音声をDBカラム数で表現する。複合FK `(user_id, audio_media_id) -> media(user_id,id)` によって別所有者のMedia参照を禁止する。Backendでもaudio・ready・未削除を検証する。
- レパートリーやPracticeの曲の参照方法（`piece_id` XOR `user_piece_id`）は変更しない。
- メディアを再利用する場合、同一Media IDを複数の練習記録で参照できる。参照中のMediaは削除前に参照解除を要求する。STEP9で投稿を参照元に追加する場合も同様に扱う。
- `pending` はアップロード予約状態。完了通知時にR2 HEAD結果からサイズ・存在・保存情報を検証し`ready`に変更する。`failed`と未完了オブジェクトは定期回収する。
- 使用容量は有効Mediaと論理削除Mediaの実サイズ、およびpendingの予約サイズで算出する。再利用参照によって同じMediaを重複加算しない。
- 物理削除はR2削除の成功を確認してからメタデータを整理する。30日間の論理削除状態は`deleted_at` / `purge_at`で管理する。
- 移行SQLは`db/migrations/009_create_media_and_practice_audio.sql`。既存Practiceデータに影響しないnullable列追加で、R2バケットやSecretsを作成しない。
