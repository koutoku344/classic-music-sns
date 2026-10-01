# 画面設計書

## 1. 目的

本書は、本サービスのMVPにおける画面一覧、画面遷移、各画面の主要要素を定義する。

SNSとして直感的に操作でき、演奏の投稿、練習記録、演奏者との交流、演奏者募集を容易に行える構成とする。

---

# 2. UI基本方針

* Smartphoneを基本とし、PCにもResponsive対応する
* 音声を主要コンテンツとして扱う
* 40代以上でも分かりやすいUIとする
* 投稿・User・募集を相互に辿れる構成とする
* Composer / Pieceはデータとして管理するが、MVPでは専用Detail画面を設けない
* 作成操作は対象機能の画面から行う
* 閲覧と作成の機能をできるだけ同じ場所にまとめる
* 音声へのFeedbackは、再生しながら特定Timestampへ簡単にCommentできるUIとする

---

# 3. メインナビゲーション

ログイン後の主要Navigation：

```text
Posts
Practice
Recruitment
Search
Messages
My Page
```

| Navigation  | 目的                           |
| ----------- | ---------------------------- |
| Posts       | 投稿の閲覧・作成                     |
| Practice    | 練習記録の登録・振り返り                 |
| Recruitment | 募集の閲覧・作成                     |
| Search      | Post / User / Recruitmentの検索 |
| Messages    | 通知・個人Chat                    |
| My Page     | 自分の情報・活動管理                   |

---

# 4. 画面一覧

| ID  | 画面                  | 主な目的                        |
| --- | ------------------- | --------------------------- |
| S01 | Landing             | サービス紹介                      |
| S02 | Login / Sign Up     | 認証                          |
| S03 | Posts               | ALL / Follow投稿閲覧            |
| S04 | Post Detail         | 投稿詳細・Comment                |
| S05 | Create Post         | Post作成                      |
| S06 | Practice            | 練習記録の確認                     |
| S07 | Practice Detail     | 日単位の練習記録詳細                  |
| S08 | Create Practice     | 日単位の練習記録作成                  |
| S09 | Recruitment         | ALL / Follow募集閲覧            |
| S10 | Recruitment Detail  | 募集詳細                        |
| S11 | Create Recruitment  | 募集作成                        |
| S12 | Search              | Post / User / Recruitment検索 |
| S13 | Messages            | 通知・Conversation一覧           |
| S14 | Conversation        | 個人Chat                      |
| S15 | User Profile        | 他UserのProfile               |
| S16 | My Page             | 自分の情報・活動管理                  |
| S17 | Repertoire          | レパートリー管理                    |
| S18 | Performance History | 演奏履歴                        |
| S19 | Subscription        | Premium管理                   |

※Comment作成専用ページは設けず、Post Detail上でCommentを作成する。

---

# 5. 主要画面遷移

```text
Landing
   │
   ▼
Login / Sign Up
   │
   ▼
   │
   ├──────────── Posts（ALL / Follow）
   │                │
   │                ├── Create Post
   │                │
   │                └── Post Detail
   │                       │
   │                       ├── Comment
   │                       └── User Profile
   │
   ├──────────── Practice
   │                │
   │                ├── Create Practice
   │                │
   │                └── Practice Detail
   │
   ├──────────── Recruitment（ALL / Follow）
   │                │
   │                ├── Create Recruitment
   │                │
   │                └── Recruitment Detail
   │                       │
   │                       └── User Profile
   │
   ├──────────── Search
   │                │
   │                ├── Post Detail
   │                ├── User Profile
   │                └── Recruitment Detail
   │
   ├──────────── Messages
   │                │
   │                ├── Notifications
   │                └── Conversations
   │                       │
   │                       └── Conversation
   │
   └──────────── My Page
                    │
                    ├── Profile
                    ├── Repertoire
                    ├── Performance History
                    └── Subscription
```

各画面に表示されるUser名・AvatarからUser Profileへ遷移可能とする。

---

# 6. 各画面

## S01 Landing

主要要素：

* サービス概要
* 主要機能紹介
* Login
* Sign Up

---

## S02 Login / Sign Up

Clerkを利用する。

主要要素：

* Login
* Sign Up
* Password Reset等

---

## S03 Posts

サービス内の投稿を閲覧するメイン画面。

画面上部に以下のTabを設ける。

```text
┌──────────┬──────────┐
│   ALL    │  Follow  │
└──────────┴──────────┘
```

### ALL

サービス全体の投稿を表示する。

新しい演奏やUserの発見を目的とする。

### Follow

FollowしているUserの投稿を中心に表示する。

### Post Card

* User
* 投稿日時
* Composer / Piece
* 本文
* Audio Player
* Image
* Feedback希望
* Like
* Comment

### 作成

画面右上にPost作成Buttonを配置する。

```text
Posts                         ＋ Post
────────────────────────────────────

          ALL    Follow

投稿
投稿
投稿
```

`＋ Post`選択でCreate Postへ遷移する。

### 操作

* Post選択 → Post Detail
* User選択 → User Profile
* Audio再生
* Like
* Comment

---

## S04 Post Detail

投稿内容の確認およびCommentを行う画面。

主要要素：

* User
* 投稿日時
* Composer / Piece
* 本文
* Audio Player
* Image
* Feedback希望
* Like
* Comment一覧
* Comment入力

User選択でUser Profileへ遷移する。

### 通常Comment

Timestampを指定せず、投稿全体に対してCommentする。

```text
Commentを入力...
                         送信
```

### Timestamp Comment

音声の特定位置に対してCommentできる。

音声再生中にComment操作を行うと、現在の再生位置を自動的にCommentへ設定する。

例：

```text
▶ ━━━━━━━━━●━━━━━━━━
        2:35 / 7:10

        ＋ ここにコメント
```

選択するとComment入力UIを表示する。

```text
2:35 にコメント

┌──────────────────────────┐
│ ここからのフレーズが      │
│ とても良かったです        │
└──────────────────────────┘

キャンセル                  送信
```

Comment入力は別ページへ遷移せず、Bottom Sheet / Modal / Inline UI等で表示する。

### Timestamp Comment表示

```text
2:35
ここからのフレーズがとても良かったです
```

Timestampを選択するとAudio Playerを該当位置へ移動し、その位置から再生できるようにする。

これにより、

```text
音声を聴く
   ↓
気になる場所でComment
   ↓
Commentを見る
   ↓
その位置をすぐ再生
```

というFeedback体験を実現する。

---

## S05 Create Post

主要要素：

* Piece選択
* Performance選択（任意）
* 本文
* Audio Upload
* Image Upload
* Feedback希望
* Comment ON / OFF
* 公開確認
* Post

Feedback希望例：

* 感想歓迎
* Advice歓迎
* 厳しめAdvice歓迎

Commentを受け付けたくない場合は、投稿時にCommentをOFFにする。

```text
コメントを許可する    ON / OFF
```

Pieceが存在しない場合は新規Piece登録を可能とする。

---

## S06 Practice

自分の練習を記録・振り返る画面。

練習記録自体は**日付単位**で登録する。

一方で、記録したデータは以下の2つの観点から確認可能とする。

```text
┌────────────┬────────────┐
│   日付別    │    曲別     │
└────────────┴────────────┘
```

### 日付別

1日ごとの練習内容を表示する。

例：

```text
Practice                         ＋ Record
────────────────────────────────────

2026/09/30

Bach
Partita No.2
60 min

Chopin
Etude Op.10-4
60 min

Total 120 min

────────────────────────────────────

2026/09/29

Bach
Partita No.2
45 min

Total 45 min
```

日付を選択するとPractice Detailへ遷移する。

### 曲別

Piece単位で過去の練習履歴を確認する。

例：

```text
Bach
Partita No.2

9/30    60 min
9/29    45 min
9/27    30 min

Total 135 min
```

```text
Chopin
Etude Op.10-4

9/30    60 min
9/28    40 min

Total 100 min
```

同じ練習記録データを日付別 / 曲別の2つのViewで表示する。

---

## S07 Practice Detail

1日単位の練習内容を確認する。

例：

```text
2026/09/30

────────────────────

Bach
Partita No.2

Practice Time
60 min

Comment
Sinfonia後半を中心に練習。
テンポを落として確認した。

────────────────────

Chopin
Etude Op.10-4

Practice Time
60 min

Comment
右手のテンポを重点的に練習。

────────────────────

Total
120 min

Edit
Delete
```

主要要素：

* 練習日
* Pieceごとの練習内容
* 練習時間
* Comment
* 1日の合計練習時間
* 編集
* 削除

---

## S08 Create Practice

1日単位で練習記録を登録する。

最初に練習日を設定し、その日に練習したPieceを追加する。

例：

```text
Practice Record

Date
2026/09/30

────────────────────

Piece
Bach / Partita No.2

Practice Time
60 min

Comment
Sinfonia後半を中心に練習

────────────────────

＋ Add Piece

────────────────────

Save
```

`＋ Add Piece`を選択すると、同じ日の練習曲を追加できる。

```text
Piece 1
Bach / Partita No.2
60 min
Comment...

Piece 2
Chopin / Etude Op.10-4
60 min
Comment...

＋ Add Piece
```

主要要素：

* 練習日
* Piece
* 練習時間
* PieceごとのComment
* Piece追加
* Piece削除
* Save

1日の練習記録に複数Pieceを登録可能とする。

Piece Masterに存在しない場合は新規Piece登録を可能とする。

---

## S09 Recruitment

サービス内の演奏者募集を一覧表示する。

Postsと同様に以下のTabを設ける。

```text
┌──────────┬──────────┐
│   ALL    │  Follow  │
└──────────┴──────────┘
```

### ALL

サービス全体の募集中Recruitmentを表示する。

新しい演奏仲間・募集の発見を目的とする。

### Follow

FollowしているUserが作成したRecruitmentを表示する。

### Recruitment Card

* 募集者
* Piece
* 募集Instrument
* Region
* Level
* Purpose
* Status

### 作成

画面右上に募集作成Buttonを配置する。

```text
Recruitment                  ＋ Recruitment
────────────────────────────────────

          ALL    Follow

募集
募集
募集
```

`＋ Recruitment`選択でCreate Recruitmentへ遷移する。

募集選択でRecruitment Detailへ遷移する。

---

## S10 Recruitment Detail

主要要素：

* 募集者
* Piece
* 募集Instrument
* Region
* Level
* Purpose
* Description
* Status
* 応募

募集者選択でUser Profileへ遷移する。

### 他Userの募集

* 応募

### 自分の募集

* 編集
* 募集終了
* 応募者確認

応募承認後はConversationで個別に連絡可能とする。

---

## S11 Create Recruitment

主要要素：

* Piece
* 募集Instrument
* Region
* Level
* Purpose
* Description
* 公開確認
* Create

---

## S12 Search

以下を横断検索する。

```text
Post
User
Recruitment
```

### Post

検索条件：

* Composer
* Piece
* User
* Instrument

### User

検索条件：

* User名
* Instrument
* Region

### Recruitment

検索条件：

* Piece
* Instrument
* Region
* Level
* Purpose

検索結果から各Detail画面へ遷移する。

---

## S13 Messages

通知と個人Chatをまとめて確認する。

```text
Messages
├── Notifications
└── Conversations
```

### Notifications

* Like
* Comment
* Follow
* Recruitment応募
* 応募状態変更
* Message通知

通知選択で対象画面へ遷移する。

### Conversations

* 相手User
* 最終Message
* 最終更新日時
* 未読状態

選択するとConversationへ遷移する。

---

## S14 Conversation

MVPでは1対1の簡易Chatとする。

主要要素：

* 相手User
* Message一覧
* Message入力
* Send

相手User選択でUser Profileへ遷移可能とする。

Realtime通信はMVP必須としない。

---

## S15 User Profile

他Userの公開情報・活動を表示する。

主要要素：

* Display Name
* Instrument
* Region
* Bio
* Follow
* Posts
* 公開Performance
* Repertoire
* Recruitment

Post選択でPost Detailへ遷移する。

Recruitment選択でRecruitment Detailへ遷移する。

---

## S16 My Page

自分の情報・活動を管理する。

主要要素：

* Profile / Profile編集
* 自分のPosts
* Repertoire
* Performance History
* Following / Followers
* Storage使用量
* Subscription

---

## S17 Repertoire

自分が取り組んでいるPieceを管理する。

主要要素：

* Piece一覧
* Composer
* Status
* Piece追加
* Status変更
* Piece削除

Status例：

```text
練習中
レパートリー
過去に演奏
```

Piece Masterに存在しない場合は新規Piece登録を可能とする。

---

## S18 Performance History

完成した演奏や演奏履歴を管理する。

主要要素：

* Piece
* Composer
* 演奏日
* Audio
* 公開状態

同一Pieceの複数Performanceを時系列で確認可能とする。

Practiceは日々の練習記録、Performance Historyは演奏成果・履歴として役割を分離する。

---

## S19 Subscription

主要要素：

* 現在Plan
* Storage使用量
* Free / Premium比較
* Premium申込
* 契約管理

| 項目      | Free | Premium |
| ------- | ---- | ------- |
| Storage | 3GB  | 20GB    |
| Media保持 | 12か月 | 長期保持    |
| 基本機能    | ○    | ○       |

---

# 7. 共通UI

主要Component：

* Header
* Navigation
* Post Card
* Recruitment Card
* Practice Record Card
* User Avatar
* Audio Player
* Comment Input
* Timestamp Comment
* Like Button
* Comment Button
* Follow Button
* Search Box
* Notification Badge
* Message Badge
* Modal / Bottom Sheet
* Loading
* Empty State
* Error Message

Audio Player：

* Play / Pause
* Seek
* Current Time
* Duration
* Timestamp Comment追加

---

# 8. Navigation / Responsive方針

## Smartphone

主要機能：

```text
Posts
Practice
Recruitment
Search
Messages
My Page
```

画面幅の制約があるため、6機能すべてを単純にBottom Navigationへ並べることは前提としない。

BoltによるPrototype作成時に、以下を比較する。

* Bottom Navigation + 一部Menu
* 5項目Bottom Navigation + その他機能
* HeaderとBottom Navigationの組み合わせ

Post / Practice / Recruitmentの作成操作は、それぞれの一覧画面右上から行う。

## PC

```text
Navigation │ Main Content │ Sub Content
```

を基本候補とする。

PCでは左Navigationに主要機能を一覧表示する構成を検討する。

---

# 9. 機能ごとの役割

| 機能          | 見る             | 作る                  | 主目的     |
| ----------- | -------------- | ------------------- | ------- |
| Posts       | ALL / Follow投稿 | Post                | 演奏共有・交流 |
| Practice    | 日付別 / 曲別練習履歴   | 日単位のPractice Record | 日々の練習管理 |
| Recruitment | ALL / Follow募集 | Recruitment         | 演奏仲間探し  |
| Search      | 検索結果           | -                   | 情報探索    |
| Messages    | 通知・Chat        | Message             | User間交流 |
| My Page     | 自分の情報          | Profile等            | 個人管理    |

---

# 10. UI設計方針

* Postsは`ALL / Follow`を切り替える
* Recruitmentも`ALL / Follow`を切り替える
* Post作成はPosts画面右上から行う
* Recruitment作成はRecruitment画面右上から行う
* Practice作成はPractice画面右上から行う
* 独立したCreate Navigationは設けない
* PostのComment許可 / 不許可は投稿者が作成時に設定する
* Feedback希望は「感想歓迎 / Advice歓迎 / 厳しめAdvice歓迎」を基本とする
* Comment専用ページは設けずPost Detail上で作成する
* Audio再生位置からTimestamp Commentを簡単に追加できるようにする
* Timestamp選択で該当する音声位置へ移動できるようにする
* Practiceは日付単位で登録する
* 1日のPracticeに複数Pieceを登録可能とする
* Practiceは同一データを「日付別 / 曲別」で確認可能とする
* Post選択でPost Detailへ遷移する
* Recruitment選択でRecruitment Detailへ遷移する
* User名・Avatar選択でUser Profileへ遷移する
* SearchはPost / User / Recruitmentを対象とする
* MessagesにNotifications / Conversationsを集約する
* Composer / PieceはMVPでは専用Detail画面を持たない
* Audio Playerを投稿一覧から直接操作可能とする
* Empty Stateでは次に行う操作を明示する
* 色だけで状態を表現しない
