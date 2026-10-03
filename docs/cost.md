# Cost Design

## 1. 目的

本書は、MVPおよび初期運用におけるCost発生要因、Cost Control、監視および見直し方針を定義する。

本SystemではManaged / Serverless Serviceを中心に利用し、User数が少ない段階で大きな固定費を持たない構成とする。

---

# 2. 基本方針

- 初期費用は可能な限り0円に近づける。
- MVPの月額運用費は3,000円程度を目安とする。
- 固定Resourceを常時確保する構成より、利用量に応じてScaleするManaged / Serverless Serviceを優先する。
- Cost増加時は即座にResourceを拡張せず、原因を確認した上で必要なComponentのみ改善・拡張する。
- Budget / Usage Alertだけに依存せず、Rate Limit、Storage Limit等により利用量そのものを制御する。
- Service料金は変更される可能性があるため、特定の単価を設計値として固定せずCost発生要因とControl方法を管理する。

---

# 3. Cost発生箇所

| Service | 用途 | 主なCost発生要因 | 主な対策 |
| --- | --- | --- | --- |
| Cloudflare Workers | Frontend / Backend API | Request数、CPU使用量 | Rate Limit、Pagination、Cache、不要Polling禁止 |
| Cloudflare R2 | Audio / Image | Storage量、Object操作 | User容量上限、Retention、File Size制限、削除Lifecycle |
| Neon | PostgreSQL | Compute、Storage、DB利用量 | Index、Pagination、Query最適化、N+1防止 |
| Clerk | Authentication | User / Active User等の利用量 | Email Verification、Sign-up Rate Limit |
| Stripe | Payment | 決済額・決済件数 | 売上連動Costとして収益性を確認 |
| Monitoring / Logging | 監視・Log | Log量、保持期間 | Log Level、Retention制御 |
| GitHub | Source / CI/CD | Plan、CI/CD利用量等 | MVPでは無料枠を基本とする |

---

# 4. Media Storage Cost

Mediaは継続的に蓄積されるため、主要なCost監視対象とする。

```text
Storage Usage
=
Active Media
+
Recently Deleted Media
```

| Plan | Storage |
| --- | ---: |
| Free | 3GB |
| Premium | 20GB |

Free Mediaは原則12か月保持とする。

通常削除されたMediaはRecently Deletedへ移動し30日間保持する。この期間もStorage使用量へ算入する。

30日以内にUserが完全削除した場合、または30日経過後にSystem処理が実行された場合、R2 Objectを物理削除する。

BackendはUpload前にUser認証、Plan、現在のStorage使用量、Upload予定Size、File Type、File Size Limit、Rate Limitを確認する。Storage上限を超えるUploadは拒否する。

---

# 5. Database Cost

Database Costは主にQuery、Compute、Storage増加によって増加する。

基本対策：

- 一覧APIではPaginationを利用する。
- Timeline等はCursor Paginationを基本とする。
- 検索条件・Join条件に必要なIndexを設定する。
- N+1 Queryを防止する。
- 不要なDB Queryを発行しない。
- Slow Queryを監視する。
- 必要以上のColumn / Recordを取得しない。

Costまたは性能問題発生時は以下の順に確認する。

```text
Query
 ↓
Index
 ↓
Connection
 ↓
Compute Resource
 ↓
Read Distribution
 ↓
Architecture Review
```

---

# 6. API / Workers Cost

Cloudflare Workersは自動Scaleを利用し、Application側で常時稼働Serverを確保しない。

Botによる大量Request、無限Retry、不要Polling、大量Search、不要なAPI Call、一度に大量Recordを取得する処理による利用量増加を防止する。

主な対策はRate Limit、Pagination、Cache、Retry回数上限、Client側Request制御とする。

---

# 7. Authentication Cost

AuthenticationはClerkを利用する。

不正・不要なAccount作成によるCost増加を抑えるため、新規Sign Up時はEmail Verificationを必須とし、Sign UpにはRate Limitを適用する。

Bot / Fake Accountによる大量登録が実際に問題となった場合は、CAPTCHA、Disposable Email対策等を追加検討する。

---

# 8. Payment Cost

PaymentはStripeを利用する。

Stripe CostはPremium売上に連動する変動費として扱う。

```text
Premium Revenue
-
Stripe Fee
-
Premium Userによる追加Infrastructure Cost
=
Contribution
```

Premium User増加時は売上だけでなく、Premiumの20GB Storage上限等による追加Costも確認する。

---

# 9. Logging / Monitoring Cost

Log量と保持期間の増加によるCostを防ぐ。

Log Retentionはnon-functional.mdで定義した期間を基本とし、不要なDebug LogをProductionで常時出力しない。

Password、Session Token、Authorization Header、Presigned URL、Secret、Card情報、Message本文、Media等はLogへ記録しない。

Monitoringは一人運用を前提とし、常時有人監視ではなく自動検知・通知を基本とする。

---

# 10. Cost Spike対策

想定外の高額Costを防止するため、Alertだけではなく利用量そのものを制御する。

- API Rate Limit
- Sign-up Rate Limit
- User Storage Limit
- Upload File Size Limit
- Media Retention
- Pagination
- Retry回数上限
- 不要Polling禁止
- Log Retention
- Budget / Usage Alert（利用Serviceで利用可能な場合）

特にBot、Abuse、Bugによる大量Request / Upload / RetryをCost Riskとして扱う。

---

# 11. Cost Monitoring

Costは原則として月1回確認する。

| 分類 | 確認項目 |
| --- | --- |
| Cost | Service別月額Cost |
| User | MAU |
| API | Request数 |
| Database | Compute / Storage / Query状況 |
| Media | R2 Storage、Upload量 |
| Authentication | User / Active User数 |
| Payment | Premium User数、売上、Stripe Cost |

Cost増加時は利用量とCostを併せて確認する。

---

# 12. Cost増加時の対応

```text
Cost Increase
      ↓
原因特定
      ↓
正常なUser増加か
 ┌────┴────┐
 No          Yes
 ↓            ↓
Bot / Bug   Bottleneck確認
不要Request      ↓
等を修正      Query / Cache等を最適化
                ↓
             それでも不足
                ↓
             対象ServiceのみScale
```

単純なResource増強を最初の対応としない。

---

# 13. 見直し条件

以下の場合はCost設計を見直す。

- 月額運用費が3,000円程度の目安を継続的に超える
- MAUが想定Growth Modelを大きく上回る
- R2 Storage Costが主要Costとなる
- Database Costが急増する
- Clerk Costが無視できない水準になる
- Premium UserのInfrastructure Costが想定以上になる
- Video対応を開始する
- Queue / Worker等のBackground Processingを導入する
- Monitoring / Logging基盤を拡張する
- 外部Serviceの料金体系が大きく変更される

---

# 14. Cost Design Principle

```text
Low Fixed Cost
      ↓
Usage Monitoring
      ↓
Identify Cost Driver
      ↓
Optimize
      ↓
Scale Only Required Component
```

User増加に伴う正常なCost増加と、Bot・Bug・非効率な実装による不要なCost増加を区別する。

Cost削減のみを目的としてSecurity、Data保護、主要機能を損なう変更は行わない。
