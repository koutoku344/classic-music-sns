# 非機能要件設計書

## 1. 目的

本書は、クラシック奏者向けサービスの非機能要件および
それを実現するための基本設計を定義する。

対象とする非機能領域は以下とする。

- 可用性
- 性能
- 拡張性
- 監視
- ログ
- 運用
- コスト

Securityについては `security.md` に定義する。

本サービスは個人開発・小規模運用から開始するため、
初期段階から大規模システム向けの高コストな構成を採用しない。

Serverless ServiceおよびManaged Serviceを活用し、
運用負荷と固定費を抑えながら、
利用者増加に応じて段階的に拡張できる構成とする。


---

# 2. 前提

## 2.1 System構成

| 領域 | 採用Service |
| --- | --- |
| Frontend | Next.js / React / TypeScript |
| Frontend Hosting | Cloudflare Workers |
| Backend API | Cloudflare Workers |
| Database | Neon PostgreSQL |
| Authentication | Clerk |
| Object Storage | Cloudflare R2 |
| Payment | Stripe |
| Source Control | GitHub |


## 2.2 利用規模

サービス開始直後から大規模Accessを想定せず、
以下の成長を想定する。

| 時期 | 累計登録User | 想定MAU |
| --- | ---: | ---: |
| 初期 | - | 100 |
| Year 1 | 500 | 200 |
| Year 2 | 2,500 | 1,000 |
| Year 3 | 10,000 | 4,000 |
| Year 4 | 30,000 | 12,000 |
| Year 5 | 80,000 | 32,000 |

設計上はMAU 32,000程度までの成長を見据える。

ただし初期構成はMAU数百人規模を前提として
Costを最小化する。


## 2.3 非機能設計の基本方針

以下を基本方針とする。

1. 初期Costを抑える
2. Managed Service / Serverless Serviceを利用する
3. 一人で運用可能な構成とする
4. 日次の手動運用を極力発生させない
5. User増加時はボトルネックとなったComponentのみ拡張する
6. Service Providerが標準提供する冗長化機構を利用する
7. MVPではMulti-Region / Multi-Provider構成を採用しない
8. 外部Service障害を可能な限りService全体へ波及させない


---

# 3. コスト方針

## 3.1 基本方針

MVPでは月額運用費3,000円程度を目安とする。

可用性・性能確保のみを目的とした
専用の冗長Resourceは原則追加しない。

Cloudflare、Neon、Clerk、R2、Stripe等が
標準提供する以下の機能を活用する。

- 冗長化
- Auto Scaling
- Backup / Restore
- Hardware障害対応
- Infrastructure運用

Service規模・売上・有料User数の増加に伴い、
障害発生時のBusiness Impactが大きくなった場合は、
追加Costを投入して非機能要件を強化する。


## 3.2 Cost増加時の判断

Costが増加した場合は、
単純にResourceを拡張する前に原因を確認する。

確認対象：

- User増加
- Media増加
- API Request増加
- Database Query増加
- Bot / Abuse
- Application不具合
- 不要なExternal API Call
- 設定誤り

正常なService成長による増加であることを確認した上で
Resource / Planを拡張する。


---

# 4. 可用性設計

## 4.1 基本方針

本サービスは24時間利用可能なWeb Serviceとする。

ただしMVPでは、
高コストな冗長構成をApplication側で独自構築せず、
各Managed Service / Serverless Serviceが提供する
可用性・冗長化機構を利用する。

Service規模・収益に対して
過剰な可用性設計を行わない。


## 4.2 可用性目標

| 項目 | 目標 |
| --- | --- |
| Service提供時間 | 24時間365日 |
| Service稼働率 | 月間99.9%を目標 |
| 計画停止 | 原則なし |
| RTO | 4時間以内 |
| RPO | 24時間以内 |

99.9%は内部的なSLOとして扱う。

MVPではUserに対するSLAとして
99.9%の稼働率を保証しない。

また、外部Serviceの障害等によって
本Serviceの一部または全部が利用できなくなる可能性を許容する。


## 4.3 Component別可用性

MVPでは可用性確保のための独自の冗長Resourceを原則配置せず、
各Service Providerが標準提供する
冗長化・障害復旧機構を利用する。

| Component | Service | 冗長化・可用性方式 | Application側追加冗長化 |
| --- | --- | --- | --- |
| Frontend | Cloudflare Workers | Cloudflare Global Network上で分散実行 | なし |
| Backend API | Cloudflare Workers | Global Network上で分散実行・自動Scale | なし |
| Database | Neon PostgreSQL | StorageのMulti-AZ構成・Compute再生成 | MVPではなし |
| Media | Cloudflare R2 | 複数Data Centerへの分散・Data冗長化 | 別StorageへのBackupなし |
| Authentication | Clerk | Managed ServiceとしてProvider側で可用性を確保 | なし |
| Payment | Stripe | Managed ServiceとしてProvider側で可用性を確保 | なし |


## 4.4 Frontend

Cloudflare Workersを利用する。

特定ServerやAZをApplication側で指定して
冗長化する方式は採用しない。

Cloudflare Global Network上での分散実行を利用し、
Application側ではServer台数やStandby Serverを管理しない。


## 4.5 Backend API

Cloudflare Workersを利用する。

Frontend同様、
Cloudflare Global Network上での分散実行を利用する。

Request増加時はCloudflare Workersの
自動Scaleを利用する。


## 4.6 Database

Neon PostgreSQLを利用する。

StorageについてはNeonが提供する
Multi-AZ構成を利用する。

Compute障害時はNeonのCompute再生成機構を利用する。

MVPではApplication側で
Standby Databaseを追加しない。

Region全体の障害に備えた
Application独自のMulti-Region Databaseは構築しない。


## 4.7 Media

Cloudflare R2を利用する。

R2が提供するData Replication / Erasure Coding等の
Data冗長化機構を利用する。

Hardware障害等に対するData保全については
R2のDurabilityに依存する。

MVPではCostを考慮し、
別Object StorageへのMedia全量Backupは実施しない。


## 4.8 Authentication

Clerkを利用する。

Clerk自体の可用性については
Provider側のManaged Serviceに依存する。

Backend APIではClerk Session Tokenを
ローカル検証することを基本とし、
通常RequestごとのClerk Backend API Callを避ける。

これにより既存Sessionについては
Clerk Backend APIへの依存を抑える。

新規Login / Sign Up等については
Clerk障害の影響を受ける。


## 4.9 Payment

Stripeを利用する。

Stripe自体の可用性については
Provider側のManaged Serviceに依存する。

Stripe障害時は、

- 新規契約
- Plan変更
- Payment
- Subscription更新

等のPayment関連処理が利用できない可能性を許容する。

一方、

- Post
- Practice
- Recruitment
- Search
- Message

等のPaymentと直接関係しない機能は、
可能な限り継続利用可能とする。


## 4.10 External Service障害

各外部Serviceの障害について、
可能な限り影響範囲を対象機能に限定する。

| 障害 | 主な影響 |
| --- | --- |
| Cloudflare障害 | Frontend / Backend API利用不可 |
| Neon障害 | DBを使用する機能利用不可 |
| Clerk障害 | Login / Sign Up等に影響 |
| R2障害 | Audio / Image利用不可 |
| Stripe障害 | Payment関連機能利用不可 |

External Service障害を原因として、
無関係な機能まで意図的に停止させない。


## 4.11 Multi-Region / Multi-Provider

MVPではApplication独自の

- Multi-Region
- Multi-Provider
- Hot Standby

構成は採用しない。

ProviderまたはRegion全体で障害が発生した場合、
対象Serviceを利用する機能が
一時的に利用できなくなることを許容する。

以下が増加した場合に再評価する。

- MAU
- Premium User数
- 売上
- User Data量
- 障害発生時のBusiness Impact


---

# 5. Backup / Data保護設計

## 5.1 Database

Neonが提供するBackup / Restore機能を利用する。

主要な復旧対象：

- User
- Profile
- Post
- Practice
- Recruitment
- Message
- Subscription情報
- Media Metadata

目標RPOを24時間以内とする。


## 5.2 Media

Audio / ImageはCloudflare R2へ保存する。

MVPでは別Object Storageへの
**Media全量Backupを実施しない。** (誤削除対応でカバーする。)

Media Data保護については、

1. R2自体のData冗長化
2. User誤削除対策
3. Applicationからの不正削除防止

によって対応する。


## 5.3 Media削除・誤削除対策

UserによるMediaの誤削除に備え、
Media削除時は即時にR2 Objectを物理削除せず、
Logical Deleteを実施する。

Logical DeleteされたMediaは
「最近削除したMedia」として30日間保持する。

Userは保持期間中、以下の操作を行える。

- Mediaの復元
- Mediaの完全削除

削除から30日経過したMediaは、
SystemによってR2から自動的に物理削除する。


## 5.4 削除済みMediaのStorage容量

「最近削除したMedia」についても
R2上で実際にStorageを使用しているため、
UserのStorage使用量に含める。

Storage使用量：

Storage使用量
= Active Media
+ 最近削除したMedia

これによりUser単位のStorage上限と
System全体の最大Storage使用量を対応させ、
Storage Costを予測可能にする。

PlanごとのStorage上限：

| Plan | Storage上限 |
| --- | ---: |
| Free | 3GB |
| Premium | 20GB |


## 5.5 削除済みMediaのUI

Media管理画面に
「最近削除したMedia」を設ける。

以下を表示する。

- Media
- File Size
- 削除日時
- 完全削除予定日
- 復元
- 完全削除

Storage使用量については、
Active Mediaと最近削除したMediaを分けて表示する。

例：

使用量：2.8GB / 3GB

- Active Media：2.0GB
- 最近削除したMedia：0.8GB

Media削除時には、

「完全削除されるまでStorage使用量に含まれる」

ことをUserへ通知する。

Storage上限到達時には、
「最近削除したMedia」を完全削除することで
Storage容量を確保できることを案内する。

詳細についてはFAQにも記載する。


## 5.6 Media削除Flow

Media削除：

User Delete
↓
Logical Delete
↓
「最近削除したMedia」へ移動
↓
Storage使用量には継続して算入

30日以内：

復元
↓
Active Mediaへ戻す

または

完全削除
↓
R2 Object物理削除
↓
Storage容量解放

30日経過：

Systemによる自動削除
↓
R2 Object物理削除
↓
Storage容量解放


## 5.7 Applicationによる誤削除対策

通常のMedia削除操作では、
R2 Objectを直接物理削除しない。

通常のUser操作はLogical Deleteまでとする。

物理削除は、

- Userによる明示的な完全削除
- 30日経過後のSystem処理

に限定する。

これによりApplication操作による
意図しない即時削除のRiskを低減する。


## 5.8 復旧方針

障害発生時は以下の順序で対応する。

Detect
↓
影響範囲確認
↓
Application / External Service切り分け
↓
復旧
↓
動作確認
↓
原因調査
↓
再発防止

Database破損時はBackup / Restore機能を利用する。

Mediaについては、
「最近削除したMedia」で保持されている場合は復元可能とする。

R2から物理的に消失し、
別Backupが存在しないMediaについては
MVPでは復元不可とする。


---

# 6. 性能設計

## 6.1 基本方針

通常利用において
Userが待ち時間を強く意識しない性能を目標とする。

初期段階から大量Resourceを確保するのではなく、

- Application
- Query
- Index
- Pagination

を適切に設計し、
必要に応じてResourceを拡張する。


## 6.2 Response Time目標

Server処理時間について以下を目標とする。

| 処理 | 目標 |
| --- | ---: |
| 通常API | 1秒以内 |
| Search API | 2秒以内 |
| Timeline / 一覧取得 | 2秒以内 |
| Login関連 | 3秒以内 |
| Media Upload | Network速度依存 |
| 初期画面表示 | 3秒以内 |

通常APIとは以下のようなCRUD処理を指す。

- Profile
- Repertoire
- Practice
- Post
- Comment
- Recruitment

External Service処理時間や
User Networkによる遅延は別途考慮する。


## 6.3 Database性能

以下を基本とする。

- Primary KeyへのIndex
- Foreign Key検索に必要なIndex
- Timeline用Index
- User単位検索用Index
- Practice Date検索用Index
- Recruitment検索用Index
- Pagination

大量のRecordをApplicationへ取得してから
Filterすることを避け、
可能な限りDatabase側で対象Dataを絞り込む。


## 6.4 Pagination

一覧APIでは一度に全Recordを返却せず、
一定件数単位で取得するPaginationを使用する。

対象：

- Post
- Comment
- Practice
- Recruitment
- Search Result
- Message
- Notification

基本取得件数は20件程度とする。

Timeline等の時系列Dataでは
Cursor Paginationを基本とする。

例：

GET /posts?limit=20&cursor=xxx

Paginationを使用する主な目的は以下とする。

- Databaseからの大量Data取得防止
- Backend API負荷軽減
- Network帯域使用量削減
- FrontendのMemory使用量削減
- Userが閲覧しないDataの不要な取得削減

Userが続きを必要とした場合のみ
次のDataを取得する。

UX向上のため次Pageを事前取得する場合は、
不要なData取得とのTrade-offを考慮する。


## 6.5 Media性能

Audio / Image本体はBackend APIを経由させず、
FrontendとR2間で直接転送する。

Upload：

```text
Frontend
↓
Backend API
↓
Authentication / Authorization
↓
容量・File確認
↓
Presigned URL発行
↓
Frontend → R2
```

これによりBackend APIが
Media Data本体を中継することを避ける。


## 6.6 Rate Limit

System保護およびCost Attack対策として
Rate Limitを設定する。

| 処理 | Limit |
| --- | ---: |
| 一般参照API | 300 Request / 分 / User |
| Search | 60 Request / 分 / User |
| Post作成 | 10 Request / 分 / User |
| Comment | 20 Request / 分 / User |
| Like / Follow | 60 Request / 分 / User |
| Message | 60 Request / 分 / User |
| Recruitment作成 | 10 Request / 分 / User |
| Recruitment Application | 10 Request / 分 / User |
| Media Upload URL発行 | 10 Request / 分 / User |
| Public API | 120 Request / 分 / IP |

Rate Limit超過時はHTTP 429を返却する。

以下を組み合わせて
System負荷およびCostを制御する。

- Rate Limit
- File Size Limit
- Storage Limit
- Pagination
- Request Body Size Limit


---

# 7. 拡張性設計

## 7.1 基本方針

初期段階ではMAU数百人規模を想定した
低Cost構成とする。

User数、Request数、Data量の増加に応じて、
必要なComponentのみ段階的に拡張する。

原則として以下の順序で対応する。

1. Cloudflare Workers等の自動Scaleを利用
2. Query / Index等を最適化
3. Database Resourceを拡張
4. 高負荷処理を非同期処理へ分離
5. 必要になった場合のみServiceを分割


## 7.2 Component別拡張方針

| 対象 | 増加要因 | 初期構成 | 拡張方法 |
| --- | --- | --- | --- |
| Frontend | Access増加 | Cloudflare Workers | Cloudflare Workersの自動Scaleを利用 |
| Backend API | API Request増加 | Cloudflare Workers | Cloudflare Workersの自動Scaleを利用 → 高負荷処理を非同期化 |
| Database | User / Data増加 | Neon PostgreSQL | Query・Index最適化 → Compute拡張 → Read負荷分散 |
| Media | Audio / Image増加 | Cloudflare R2 | User容量制限・Lifecycle → 必要に応じて保存方針変更 |
| Authentication | User増加 | Clerk | 利用量に応じてPlan拡張 |
| Payment | Subscriber増加 | Stripe | 基本構成を継続 |
| Background処理 | 重い処理増加 | 原則なし | Queue + Workerを追加 |
| Video | Video機能追加 | MVP対象外 | Storage + Transcode / Streaming基盤追加 |


## 7.3 Frontend / Backend API

初期構成からCloudflare Workersによる
Serverless Architectureを採用する。

Access / Request増加時に
Application側でServer台数を増減させるのではなく、
Cloudflare Workersが提供する自動Scaleを利用する。

通常のCRUD APIについては
同期処理を維持する。


## 7.4 高負荷処理

処理時間の長い機能が追加された場合は、

Frontend
↓
Backend API
↓
Queue
↓
Worker

の構成へ拡張し、
User Requestと高負荷処理を分離する。

対象候補：

- Video変換
- 大量Notification
- Media解析
- 将来のAI処理


## 7.5 Database

Databaseは以下の順序で拡張する。

Query / Index最適化
↓
Connection最適化
↓
Compute拡張
↓
Read負荷分散
↓
必要に応じて構成見直し

初期段階ではDatabaseを分割しない。

単一PostgreSQLで対応できないことを確認してから、
Read ReplicaやDatabase分割等を検討する。


## 7.6 機能拡張

将来的な主な機能拡張候補：

- Video
- Teacher / Student
- Ensemble管理
- Notification高度化
- AI機能

高負荷処理については、
既存の同期APIへ直接組み込まず、
必要に応じて非同期処理として分離する。


---

# 8. 監視設計

## 8.1 基本方針

一人運用を前提とし、
常時有人監視は実施しない。

異常を自動検知し、
対応が必要な事象のみ管理者へ通知する。

監視対象：

- Availability
- Application
- Database
- External Service
- Security
- Cost
- Storage


## 8.2 Availability監視

外部から定期的にServiceへAccessし、
Serviceが利用可能であることを確認する。

対象：

- Frontend
- Backend API Health Check

Backend APIには以下のような
Health Check Endpointを設ける。

GET /health

正常時：

200 OK

Databaseまで含めた詳細Health Checkについては、
不要なDatabase Queryを発生させないよう
通常の死活監視とは分離する。


## 8.3 Application監視

以下を監視する。

- HTTP 5xx
- HTTP 429
- Application Exception
- API Response Time
- Request数
- Authentication失敗増加
- Authorization失敗増加

単発Errorでは原則通知せず、
継続または一定回数以上発生した場合に通知する。


## 8.4 Database監視

以下を監視する。

- Database接続Error
- Connection数
- Query Error
- Slow Query
- Storage使用量
- Database Resource使用量

性能問題発生時は、

Query
↓
Index
↓
Connection
↓
Compute

の順に確認する。


## 8.5 Media / Storage監視

以下を監視する。

- R2 Storage使用量
- Media Upload失敗
- Media Download失敗
- User Storage使用量
- 削除済みMedia量
- ObjectとDB Metadataの不整合

Storage Costが想定以上に増加した場合は、

- User増加
- Media投稿量
- 削除済みMedia
- 異常Upload

を確認する。


## 8.6 External Service監視

対象：

- Cloudflare
- Neon
- Clerk
- Stripe

Application異常時は
Applicationだけでなく各ServiceのStatusも確認する。

External Service障害の場合、
不要なApplication変更を行わない。


## 8.7 Payment監視

以下を監視する。

- Stripe Webhook失敗
- Webhook署名検証失敗
- Subscription更新失敗
- Payment失敗

Webhook処理は
二重処理が発生しないよう冪等性を確保する。


## 8.8 Security監視

以下を監視対象とする。

- Authentication失敗急増
- Authorization失敗急増
- Rate Limit超過
- Admin操作
- 異常なMedia Upload
- Stripe Webhook署名Error

詳細は `security.md` に従う。


## 8.9 Cost監視

個人開発であるため
Costを重要監視項目とする。

最低限、以下を月次確認する。

- Cloudflare
- Neon
- Clerk
- R2
- Stripe

通常利用量から大幅に増加した場合は、

- User増加
- Bot / Abuse
- Application不具合
- 設定誤り

を確認する。

利用可能なServiceについては
Budget / Usage Alertを設定する。


---

# 9. ログ設計

## 9.1 基本方針

障害調査・Security調査・運用確認に
必要な情報を記録する。

一方で、

- 不要な大量Log
- 個人情報
- Credential
- Media内容

は記録しない。

Log量を抑え、
運用Costを増加させない。


## 9.2 Log分類

| Log | 用途 |
| --- | --- |
| Access Log | API利用状況確認 |
| Application Log | Application障害調査 |
| Security Log | Security Event確認 |
| Audit Log | Admin操作追跡 |
| Payment Log | Stripe連携確認 |


## 9.3 Access Log

最低限以下を記録する。

- Timestamp
- Request ID
- HTTP Method
- Endpoint
- HTTP Status
- Response Time
- User ID（必要な場合）

Requestごとに一意のRequest IDを付与し、
Application Logと関連付け可能にする。


## 9.4 Application Log

以下を記録する。

- Request ID
- Timestamp
- Log Level
- Function / Component
- Error Type
- Error Message
- Stack Trace

Productionでは
UserへStack Traceを返却しない。


## 9.5 Security Log

以下を記録する。

- Authentication失敗
- Authorization失敗
- Rate Limit
- 不正Media操作
- Webhook署名Error


## 9.6 Audit Log

Adminによる重要操作を記録する。

最低限以下を記録する。

- Admin User ID
- Operation
- Target Resource
- Target ID
- Timestamp
- Result

Audit Logは通常Userから変更できないものとする。


## 9.7 Log Level

| Level | 用途 |
| --- | --- |
| ERROR | 処理失敗・障害 |
| WARN | 処理継続可能だが確認が必要 |
| INFO | 主要な正常処理 |
| DEBUG | Developmentのみ |

ProductionではDEBUG Logを原則出力しない。


## 9.8 Logへ記録しない情報

以下を記録しない。

- Password
- Session Token
- Authorization Header
- Presigned URL
- Database Password
- API Key / Secret
- Card情報
- Message本文
- Audio / Image本体


## 9.9 Log保持期間

MVPでは以下を基本とする。

| Log | 保持期間 |
| --- | ---: |
| Access Log | 30日 |
| Application Log | 30日 |
| Security Log | 90日 |
| Audit Log | 1年 |
| Payment関連Log | 1年 |

External ServiceのPlan上、
保持期間を満たせない場合は
Service標準の保持期間を利用する。

必要性とCostを確認した上で
長期保存を検討する。


---

# 10. 運用設計

## 10.1 基本方針

個人運用を前提として、

- 定常作業を極力減らす
- Managed Serviceを利用する
- Deployを自動化する
- 異常時のみ通知する
- 手動Backup等の日次作業を作らない

ことを基本とする。


## 10.2 Environment

最低限以下を分離する。

- Development
- Production

環境ごとに以下を分離する。

- Database
- Clerk
- R2
- Stripe Test / Live
- Secret
- Domain / Origin

必要性が発生した場合にStagingを追加する。


## 10.3 Deploy

Source CodeはGitHubで管理する。

基本Flow：

Local Development
↓
Git Commit
↓
GitHub Push
↓
Test / Build
↓
Production Deploy

Production Deploy前に最低限、

- Build成功
- Type Check成功
- Test成功

を確認する。

将来的にGitHub Actions等による
CI/CDを導入する。


## 10.4 Rollback

Application Release後に重大障害が発生した場合、
直前の正常VersionへRollbackする。

Database Schema変更については、
Application Rollbackとの互換性を考慮する。

破壊的なSchema変更を
Releaseと同時に実施しないことを基本とする。


## 10.5 定常運用

日次の手動作業は原則設けない。

### 月次確認

- Service Cost
- Error傾向
- R2 Storage使用量
- Database使用量
- MAU
- Premium User数
- Security Event

### 随時対応

- Dependency Update
- Security Update
- Master Data修正
- User問い合わせ
- Incident対応


## 10.6 Dependency管理

Frontend / BackendのDependencyについて、

- 不要Dependencyを削除
- Security Vulnerabilityを確認
- Major Updateは影響確認後に適用
- Lock FileをGit管理

する。

自動生成Codeに追加されたDependencyについても
Architecture上必要か確認する。


## 10.7 Database Migration

Database Schema変更は
Migrationとして管理する。

Production Databaseを
手動で直接変更することを原則禁止する。

Migration実施前に、

- 既存Dataへの影響
- Applicationとの互換性
- Rollback可否

を確認する。


## 10.8 Media運用

UserごとにStorage使用量を管理する。

| Plan | Storage |
| --- | ---: |
| Free | 3GB |
| Premium | 20GB |

Storage使用量には、

- Active Media
- 最近削除したMedia

の両方を含める。

Free Planについては
Media保持期間12か月を基本とする。

Userが削除したMediaは
「最近削除したMedia」へ移動し、
30日後に物理削除する。

Userが30日以内に完全削除した場合は、
その時点で物理削除する。


## 10.9 Incident対応

Incident発生時は以下の流れで対応する。

Detect
↓
影響確認
↓
切り分け
↓
暫定復旧
↓
正常性確認
↓
原因調査
↓
恒久対策

重大Incidentについては、

- 発生日時
- 影響
- 原因
- 対応
- 再発防止

を記録する。


## 10.10 User問い合わせ

User問い合わせは以下に分類する。

- Account
- Payment
- Content
- Bug
- Feature Request
- Abuse / Security
- Media復旧

Payment・Securityに関する問い合わせは
優先して確認する。

Media誤削除については、
30日以内であれば
「最近削除したMedia」からUser自身で復元可能とする。

User本人確認が必要な操作については、
User ID等のApplication上の識別情報を利用し、
Password等の認証情報を問い合わせで取得しない。


## 10.11 FAQ

Userが自己解決できる内容については
FAQを整備する。

最低限以下を記載する。

- Storage容量の考え方
- 最近削除したMediaについて
- 削除済みMediaもStorage容量に含まれること
- Mediaを完全削除して容量を空ける方法
- Free / PremiumのStorage上限
- Media保持期間
- Loginに関する一般的な問題
- Paymentに関する一般的な問題


---

# 11. 非機能目標一覧

| 分類 | 項目 | 目標 / 方針 |
| --- | --- | --- |
| Cost | MVP運用費 | 月額3,000円程度を目安 |
| 可用性 | Service提供時間 | 24時間365日 |
| 可用性 | 稼働率 | 99.9% / 月を内部目標 |
| 可用性 | RTO | 4時間以内 |
| 可用性 | RPO | 24時間以内 |
| 可用性 | 冗長化 | Provider標準機能を利用 |
| 可用性 | Multi-Region | MVPでは実施しない |
| 性能 | 通常API | 1秒以内 |
| 性能 | Search / Timeline | 2秒以内 |
| 性能 | 初期画面 | 3秒以内 |
| 性能 | 一覧取得 | Pagination必須 |
| 拡張性 | Frontend | Cloudflare Workersの自動Scale |
| 拡張性 | Backend API | Cloudflare Workersの自動Scale |
| 拡張性 | Database | 最適化 → Resource拡張 → Read負荷分散 |
| 拡張性 | 高負荷処理 | Queue / Workerへ分離 |
| Media | Free Storage | 3GB |
| Media | Premium Storage | 20GB |
| Media | 誤削除 | 最近削除したMediaとして30日保持 |
| Media | 削除済み容量 | User Storage使用量に算入 |
| Media | 全量Backup | MVPでは実施しない |
| 監視 | System | 自動監視 |
| 監視 | 通知 | 異常時のみ |
| 監視 | Cost | 月次確認 + 利用可能ならAlert |
| Log | Access / Application | 30日 |
| Log | Security | 90日 |
| Log | Audit / Payment | 1年 |
| 運用 | 定常作業 | 日次手動作業なし |
| 運用 | Environment | Development / Production分離 |


---

# 12. 将来の見直し条件

以下のいずれかが発生した場合、
非機能設計を再評価する。

- MAUが想定を大幅に超過
- Premium Userが増加
- 月額CostがBudgetを継続的に超過
- Database性能問題が発生
- Storage Costが大幅に増加
- 外部Service障害によるBusiness Impactが増加
- Data消失時のBusiness Impactが増加
- Video等の高負荷機能を追加
- 法的・契約上、追加のData保護が必要
- 一人運用が困難になる

特に、

- Media Backup
- Multi-Region
- Multi-Provider
- Database Read Replica
- Queue / Background Worker
- Monitoring高度化

については、
必要性が発生した段階で導入を検討する。


---

# 13. 設計原則

本システムの非機能設計では、

最初から大規模Systemを構築するのではなく、

低Costな初期構成
↓
監視
↓
ボトルネック特定
↓
対象Componentのみ改善
↓
必要に応じてScale / 分離

を基本とする。

Serverless / Managed Serviceによって
Frontend・Backend・Storage等の
Infrastructure運用を最小化する。

Service成長時は、

- Database
- 高負荷処理
- Media
- External Service依存
- Cost

を主要な監視・拡張Pointとする。

これにより、

- 初期Costを抑える
- 一人で運用可能にする
- User増加に対応する
- Data消失Riskを必要な範囲で抑える
- 不要な複雑性を持ち込まない

ことを両立する。