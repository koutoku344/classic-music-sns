# セキュリティ設計書

## 1. 目的

本書は、クラシック奏者向けサービスにおけるセキュリティ方針、主要な脅威への対策、および各コンポーネントのセキュリティ責務を定義する。

対象構成：Frontend = Next.js / React / TypeScript、Hosting / Backend API = Cloudflare Workers、Database = Neon PostgreSQL、Authentication = Clerk、Object Storage = Cloudflare R2、Payment = Stripe、Source Control = GitHub。

動画投稿・AI演奏分析はMVP対象外とし、追加時に本設計を見直す。

---

# 2. セキュリティ基本方針

1. AuthenticationとAuthorizationを分離する。
2. FrontendからDatabaseへ直接アクセスさせない。
3. Frontendから送信された値を信用せず、Backend APIで検証する。
4. 最小権限を原則とする。
5. SecretをSource CodeおよびGitへ保存しない。
6. Production通信はHTTPS / TLSで暗号化する。
7. Mediaへのアクセスは公開範囲に応じて制御する。
8. Rate Limit・容量制限により大量Request・大量Uploadを防止する。
9. Security Eventを追跡できるログを保持する。
10. 外部Service障害・Credential漏えい時の影響範囲を限定する。

Frontendによるボタン非表示等はUX上の制御にすぎず、セキュリティ境界とはみなさない。Backend APIを主要なSecurity Enforcement Pointとする。

---

# 3. 保護対象とデータ分類

| 分類 | 主なデータ | 方針 |
| --- | --- | --- |
| 公開情報 | 公開Post、公開Profile、公開Recruitment | 公開範囲に従い閲覧可能 |
| User Data | Practice、非公開Performance、Repertoire等 | Ownerまたは許可されたUserのみ |
| 通信データ | Conversation、Message、Application | 当事者のみ |
| 認証情報 | Clerk Session / Token | ClerkおよびBackendで安全に管理 |
| 決済情報 | Subscription状態、Stripe ID | 必要最小限のみ保持 |
| Card情報 | Card Number等 | 本システムでは保持しない |
| Secret | DB URL、API Key、Webhook Secret、R2 Credential | Secret管理機能で管理 |

地域情報はプロフィール・募集に必要な粗い地域を基本とし、住所等の不要な詳細位置情報は収集しない。

---

# 4. Authentication

AuthenticationはClerkへ委譲する。Backend APIは認証が必要なRequestごとにClerkのSession Tokenを検証する。

主な検証項目：

- Token署名
- 有効期限
- 必要なIssuer / Claim
- 想定Frontendから発行されたTokenであること
- 認証済みUser ID

Clerk SDKの推奨認証処理を使用し、独自認証方式を実装しない。認証失敗時はHTTP 401を返す。

---

# 5. Authorization

AuthorizationはBackend APIで実施する。Path ParameterやRequest Bodyの user_id を信用せず、認証済みUser IDとResourceのOwner / Member情報を照合する。

| Resource / Operation | Authorization |
| --- | --- |
| User Profile更新 | 本人のみ |
| Repertoire更新・削除 | Ownerのみ |
| Practice更新・削除 | Ownerのみ |
| Performance更新・削除 | Ownerのみ |
| 非公開Performance閲覧 | Ownerのみ |
| Post更新・削除 | 投稿者のみ |
| Comment削除 | 原則Comment投稿者のみ |
| Media削除 | Ownerのみ |
| Recruitment更新・削除 | 募集者のみ |
| Application一覧・状態更新 | Recruitment Ownerのみ |
| Conversation / Message | Conversation Memberのみ |
| Subscription参照 | 本人のみ |

認可失敗時はHTTP 403を基本とする。Resourceの存在自体を第三者へ知らせるべきでない場合は404も検討する。

## 5.1 IDOR対策

Resource IDを書き換えて他UserのPractice、Media、Conversation等へアクセスする攻撃を防止する。各APIでResource取得後にOwner / Memberを必ず確認し、IDだけでアクセス可否を判断しない。

---

# 6. API Security

## 6.1 Input Validation

Backend APIで必須項目、型、文字数、数値範囲、Enum、日時形式、ID形式、Pagination上限、Search条件、Media Type、File Size、Business Ruleを検証する。Frontend側Validationだけには依存しない。

## 6.2 Injection対策

SQLはParameter Binding / Prepared Statementを使用し、User入力をSQL文字列へ直接連結しない。Sort条件等もAllowlistで制御する。

## 6.3 XSS対策

- Reactの標準escapeを利用する
- User入力を安易にHTMLとして描画しない
- dangerouslySetInnerHTML は原則使用しない
- Rich Text導入時はSanitize処理を追加する
- Content-Security-Policyを設定する

対象User入力にはPost、Comment、Profile、Message、Recruitment等を含む。

## 6.4 CSRF対策

Clerkの推奨方式を使用する。Cookieを利用する状態変更RequestではSameSite等のCookie属性およびOriginを考慮し、Cross-Site Requestによる不正操作を防止する。

## 6.5 CORS

Backend APIおよびR2のCORSは必要なFrontend Originのみ許可する。Productionでは原則としてワイルドカードを使用しない。Development / Staging / ProductionのOriginを分離する。

## 6.6 Rate Limit

| API | 方針 |
| --- | --- |
| 一般GET API | User / IP単位で制限 |
| Post / Comment | User単位で制限 |
| Follow / Like | User単位で制限 |
| Search | User / IP単位で制限 |
| Message | User単位で制限 |
| Media Upload許可 | User単位で強めに制限 |
| Recruitment / Application | User単位で制限 |
| Stripe Webhook | Rate Limitより署名検証を優先 |

具体的な閾値は負荷試験・利用状況を踏まえて詳細設計で決定し、超過時はHTTP 429を返す。

---

# 7. Media Security

Media本体はCloudflare R2へ保存し、R2 CredentialをFrontendへ渡さない。

## 7.1 Upload

Backend APIはAuthentication、Plan、Storage使用量、File Type / Size、Rate Limitを確認した後、Backend側でObject Keyを生成し、短時間のみ有効なUpload用Presigned URL等を発行する。

Presigned URLは以下を満たす。

- 有効期限を短くする
- PUT等の必要なMethodだけに限定する
- 対象Object Keyを一意に限定する
- Content-Typeを可能な範囲で固定する
- Userに任意のObject Keyを指定させない

Object Key例： users/{user_id}/media/{uuid}

## 7.2 Upload後検証

Client申告のMIME Typeだけを完全には信用しない。MVPでは許可Media Type、MIME Type、File Size、Storage Limit、MetadataとR2 Objectの対応を確認する。将来必要に応じてMagic Number検証やMalware Scanを追加する。

## 7.3 Download / Playback

公開Mediaと非公開Mediaを区別する。非公開Performance等はBucketを単純Public公開せず、Backend APIでAuthorization後に短寿命のRead URLを発行する。

Presigned URLはBearer Token相当として扱い、ログ等へ不用意に出力しない。

## 7.4 削除

Media削除はOwner確認後にLogical Deleteとし、通常の削除操作ではR2 Objectを即時に物理削除しない。削除済みMediaは30日間「最近削除したMedia」として保持し、Ownerのみ復元または完全削除できる。

R2 Objectの物理削除は、Ownerによる明示的な完全削除または30日経過後のSystem処理に限定する。物理削除時もOwner / System権限を検証し、他UserのObjectを削除できないようにする。孤立Object等の不整合は監視対象とする。

---

# 8. Database Security

Neon PostgreSQLはBackend APIからのみアクセスし、Frontendからの直接接続を禁止する。

- TLS接続を使用する
- Connection StringはSecretとして管理する
- Production / Development Databaseを分離する
- Serverless構成に適したConnection Poolingを使用する
- Application用DB Userは必要最小限の権限とする
- 運用管理用CredentialとApplication用Credentialを可能な限り分離する
- Foreign Key / Unique / NOT NULL等でDB側でも整合性を維持する

Application用Roleから不要なSchema変更権限等を除外する構成を詳細設計で決定する。

---

# 9. Payment Security

PaymentはStripeへ委譲し、Card情報を本システムでは保存・処理しない。

Stripe Webhookでは以下を実施する。

- Stripe-Signatureを必ず検証する
- Webhook SecretをSecretとして管理する
- Raw Request Bodyで署名検証する
- Event ID等を利用して重複処理を防止する
- 想定するEvent Typeのみ処理する
- 署名検証成功前にSubscriptionを更新しない
- Webhook再送を前提に冪等に処理する

Subscription状態はClientから直接変更させず、Stripeの決済結果を基にBackendで更新する。

---

# 10. Secret Management

秘密情報：Neon Connection String / Password、Clerk Secret Key、R2 Access Key / Secret、Stripe Secret Key、Stripe Webhook Secret、その他外部Service API Key。

秘密情報はCloudflare Workers Secrets等で管理し、Source Codeへ直接記載しない。.env、.env.*、.dev.vars、.dev.vars.* はGitへCommitしない。

Production / DevelopmentでCredentialを分離し、漏えいが疑われる場合は速やかに失効・再発行する。

---

# 11. HTTP / Browser Security

Production通信はHTTPSを使用する。Frontend Responseには必要に応じて以下を設定する。

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Permissions-Policy
- frame-ancestors または X-Frame-Options

CSPの許可先はClerk、Stripe、R2等の実際の通信先を確認して詳細設計で定義し、不要な unsafe-inline / unsafe-eval は許可しない。

---

# 12. Privacy / Personal Data

必要以上の個人情報を収集しない。RecruitmentやProfileで住所、電話番号、個人Email等を公開必須項目にしない。Conversation / Messageは公開しない。

Account削除時のUser Profile、Post、Comment、Practice、Performance、Media、Message、Recruitment / Application、Subscriptionの扱いは実装前に詳細化し、法令・決済上必要な保持とUser要求による削除を区別する。

---

# 13. Logging / Monitoring

記録候補：Request ID、Timestamp、API Endpoint、HTTP Method / Status、Authentication成否、必要なUser ID、Authorization失敗、Rate Limit、Media Upload失敗、Stripe Webhook検証失敗、Application Error。

原則ログへ記録しない情報：Password、Session Token、Authorization Header、Presigned URL全体、DB Password、API Secret、Card情報、不要なMessage本文等。

大量ログによるCost Spikeを防ぐためRetention、Sampling、Log Levelを設定する。

---

# 14. Error Handling

Clientには共通Error Codeと必要最小限のMessageを返す。Production ResponseにはStack Trace、Credential、SQL詳細、Connection String等を含めず、詳細はServer Logで管理する。

---

# 15. Availability / Abuse対策

API Rate Limit、Pagination、Search取得件数上限、Upload File Size上限、Storage容量上限、Request Body上限、Timeout、Retry上限、Exponential Backoff、Bot / DoS対策、重いQueryの抑制、DB Connection数管理を実施する。

| Plan | Storage |
| --- | ---: |
| Free | 3GB |
| Premium | 20GB |

Storage使用量にはActive Mediaと「最近削除したMedia」を含め、Logical Deleteを繰り返すことで実Storage使用量がPlan上限を超過し続けないようにする。

User操作によって運営Costが実質無制限に増えない設計とする。

---

# 16. Dependency / Supply Chain Security

- package-lock.jsonをGit管理する
- Dependencyの脆弱性を定期確認する
- 不要Dependencyを削除する
- Major Update時はBreaking Changeを確認する
- CI/CD Tokenを最小権限化する
- 生成AI・コード生成ツールが追加したDependencyもArchitectureとの整合を確認する

現時点のBolt Prototypeに含まれるSupabase DependencyはSupabase採用を意味しない。実装時に不要であれば削除する。

---

# 17. Environment分離

最低限Development / Productionを分離し、必要に応じてStagingを追加する。環境ごとにDatabase、Clerk設定、R2 Bucket、Stripe Test / Live、Secret、Domain / Originを分離する。

---

# 18. Security Test

Release前に最低限以下を確認する。

### Authentication / Authorization
- 未認証Userが保護APIへアクセスできない
- User AがUser BのPracticeを更新・削除できない
- User AがUser Bの非公開Performanceを閲覧できない
- Conversation Member以外がMessageを取得できない
- Recruitment Owner以外がApplication一覧を取得できない

### Input
- 不正な型・過大文字列を拒否する
- SQL Injection文字列でQuery構造が変化しない
- Script文字列がHTMLとして実行されない

### Media
- 容量超過Uploadを拒否する
- 不正MIME Typeを拒否する
- 他UserのObjectを削除できない
- Expired Presigned URLを利用できない
- 非公開Mediaを未認証Userが取得できない

### Payment
- 不正署名Webhookを拒否する
- 同一Event再送で二重処理しない
- ClientからPremium状態を直接変更できない

### Secret
- Git RepositoryにSecretが存在しない
- Production Response / LogにSecretが出力されない

---

# 19. Incident Response

基本フロー：Detect → Impact確認 → Containment → Investigation → Recovery → 再発防止。

ContainmentではCredential失効、Account / Endpoint制限、必要に応じた機能停止を行う。Git履歴へSecretをCommitした場合は、Git上から削除するだけでなく漏えいCredential自体を失効・再発行する。

---

# 20. 主要脅威と対策

| 脅威 | 主な対策 |
| --- | --- |
| Account不正利用 | Clerk、Session検証、Rate Limit |
| IDOR | Resource単位のOwner / Member認可 |
| SQL Injection | Parameter Binding、Allowlist |
| XSS | React Escape、CSP、HTML直接描画禁止 |
| CSRF | Clerk推奨方式、Cookie / Origin制御 |
| Unauthorized Media Access | Private Bucket、短寿命Read URL、認可 |
| Malicious Upload | Type / Size検証、容量制限、将来Scan |
| Credential漏えい | Workers Secrets、Git除外、Credential分離 |
| Webhook偽装 | Stripe署名検証 |
| API Abuse / Bot | Rate Limit、Pagination、Request上限 |
| Cost Attack | Storage / Upload / API上限 |
| Data Leak via Logs | Sensitive Data非記録 |
| Dependency脆弱性 | Lock File、定期Update・脆弱性確認 |

---

# 21. セキュリティ責務

| Layer | 主な責務 |
| --- | --- |
| Frontend | 安全な表示、Token取扱い、Security Header |
| Backend API | 認証検証、認可、Validation、Rate Limit |
| Clerk | Authentication / Session |
| Neon | Application Data保存 |
| R2 | Media保存 |
| Stripe | Payment / Card情報 |
| GitHub | Source / Document管理 |
| Operator | Secret管理、権限管理、監視、Incident Response |

外部Serviceへ委譲しても、設定・Credential管理・Application固有Authorization等の責務は本システム側に残る。

---

# 22. 詳細設計で決定する項目

- APIごとのRate Limit値
- Request Body上限
- Audio / Image最大File Size
- Presigned URL有効期限
- CSP Directive
- CORS Allow Origin
- Session / Cookie設定
- DB Role / Grant
- Log Retention
- Backup / Restore手順
- Account削除時のData Retention
- 管理者機能のAuthentication / Authorization
- Malware Scan導入要否
- Security Alert閾値

---

# 23. 設計原則

本システムでは「Frontendから送られてきた情報を信用せず、Backend APIをセキュリティ境界として、認証・認可・入力検証・利用量制御を行う」ことを基本原則とする。

Clerk、Neon、R2、Stripe等のManaged Serviceへ基盤Securityを委譲しつつ、Application固有のAuthorizationとBusiness RuleはBackend APIで一元管理する。