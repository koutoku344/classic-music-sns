# ビジネスモデル・コスト試算

## 1. ビジネスモデル

Free / PremiumのFreemiumモデルを採用する。

| 項目         | Free | Premium |
| ---------- | ---: | ------: |
| 月額         |   0円 |  1,000円 |
| Storage    |  3GB |    20GB |
| メディア保持     | 12か月 |    長期保存 |
| 音声・画像投稿    |    ○ |       ○ |
| 基本機能       |    ○ |       ○ |
| 高度な演奏履歴・比較 | 制限あり |       ○ |
| 動画投稿（将来）   |   少量 |      拡張 |

MVPは**音声＋画像**とし、動画・AI演奏分析は対象外とする。

---

# 2. 試算前提

## 2.1 サービス単価

2026年9月時点。為替は **$1 = 150円** とする。

| サービス    | 課金対象            |                単価 |
| ------- | --------------- | ----------------: |
| R2      | Storage         | $0.015 / GB-month |
| R2      | Internet Egress |                無料 |
| Workers | 基本料金            |            $5 / 月 |
| Workers | Request         |         10M/月まで含む |
| Workers | Request超過       |        $0.30 / 1M |
| Workers | CPU             |  30M CPU-ms/月まで含む |
| Workers | CPU超過           | $0.02 / 1M CPU-ms |
| Neon    | Compute         |   $0.14 / CU-hour |
| Neon    | Storage         |  $0.35 / GB-month |
| Clerk   | MRU             |        50,000まで無料 |
| Stripe  | 国内カード           |         売上 × 3.6% |

---

## 2.2 シナリオ

### 事業前提

| 項目                |     悲観 |     通常 |     楽観 |
| ----------------- | -----: | -----: | -----: |
| Premium転換率        |     1% |     3% |     5% |
| Premium料金         | 1,000円 | 1,000円 | 1,000円 |
| 平均Storage / MAU   |  2.0GB | 0.93GB |  0.5GB |
| DAU / MAU         |    40% |    30% |    20% |
| API / DAU / 日     |    500 |    250 |    150 |
| 音声再生 / DAU / 日    |     30 |     15 |     10 |
| Workers CPU / API |   10ms |    5ms |    3ms |

平均Storage 0.93GBは、通常ケースで以下を前提とする。

```text
投稿ユーザー = MAU × 50%
投稿数       = 10投稿 / 月
Media容量    = 15.5MB / 投稿
保持期間     = 12か月

15.5MB × 10 × 12 × 50%
≒ 0.93GB / MAU
```

---

## 2.3 MAU

| 年  |     悲観 |     通常 |     楽観 |
| -- | -----: | -----: | -----: |
| Y0 |    100 |    100 |    100 |
| Y1 |    150 |    200 |    300 |
| Y2 |    500 |  1,000 |  1,500 |
| Y3 |  1,500 |  4,000 |  6,000 |
| Y4 |  4,000 | 12,000 | 18,000 |
| Y5 | 10,000 | 32,000 | 50,000 |

---

# 3. 計算式

## 売上

```text
Premium User
= MAU × Premium転換率

MRR
= Premium User × 1,000円
```

## R2 Storage

```text
Storage
= MAU × 平均Storage / MAU

R2 Storage Cost
= max(Storage - Free枠, 0)
  × $0.015
  × 150円
```

## Backend API

```text
DAU
= MAU × DAU/MAU

API Request / 月
= DAU × API/DAU/日 × 30日
```

## Workers

```text
Request Cost
= max(API Request - 10M, 0)
  ÷ 1M × $0.30 × 150円

CPU-ms
= API Request × CPU-ms/API

CPU Cost
= max(CPU-ms - 30M, 0)
  ÷ 1M × $0.02 × 150円

Workers Cost
= 基本料金 + Request Cost + CPU Cost
```

## 音声再生

```text
音声再生数 / 月
= DAU × 音声再生/DAU/日 × 30日

音声配信量
= 音声再生数 × 平均実転送量
```

音声はWorkers API経由ではなくR2から配信する。
R2 GET等のOperationは別途監視する。

## Neon

```text
Neon Compute Cost
= 平均CU × 730時間 × $0.14 × 150円

Neon Storage Cost
= DB容量 × $0.35 × 150円
```

Media本体はNeonではなくR2へ保存する。

## Stripe

```text
Stripe Fee
= MRR × 3.6%
```

## 月間収支

```text
Running Cost
= R2 + Workers + Neon + Clerk + Stripe + その他

月間収支
= MRR - Running Cost
```

---

# 4. イニシャルコスト

個人開発のため開発者本人の人件費は含めない。

| 項目         |           金額 |
| ---------- | -----------: |
| Domain     |       3,000円 |
| 開発・検証Cloud |       5,000円 |
| UI / Asset |       5,000円 |
| その他        |       7,000円 |
| **合計**     | **約20,000円** |
| **予算上限**   |  **50,000円** |

---

# 5. ランニングコスト・収支

## 5.1 悲観

Premium 1%、Storage 2GB/MAU。

| 年  |    MAU |      MRR |    Cost/月 |         収支/月 |
| -- | -----: | -------: | --------: | -----------: |
| Y0 |    100 |   1,000円 |   約5,000円 |  **▲4,000円** |
| Y1 |    150 |   1,500円 |   約5,000円 |  **▲3,500円** |
| Y2 |    500 |   5,000円 |  約11,000円 |  **▲6,000円** |
| Y3 |  1,500 |  15,000円 |  約24,000円 |  **▲9,000円** |
| Y4 |  4,000 |  40,000円 |  約53,000円 | **▲13,000円** |
| Y5 | 10,000 | 100,000円 | 約116,000円 | **▲16,000円** |

---

## 5.2 通常

Premium 3%、Storage 0.93GB/MAU。

| 年  |    MAU |      MRR |    Cost/月 |          収支/月 |
| -- | -----: | -------: | --------: | ------------: |
| Y0 |    100 |   3,000円 |   約5,000円 |   **▲2,000円** |
| Y1 |    200 |   6,000円 |   約5,000円 |   **＋1,000円** |
| Y2 |  1,000 |  30,000円 |  約12,000円 |  **＋18,000円** |
| Y3 |  4,000 | 120,000円 |  約29,000円 |  **＋91,000円** |
| Y4 | 12,000 | 360,000円 |  約71,000円 | **＋289,000円** |
| Y5 | 32,000 | 960,000円 | 約170,000円 | **＋790,000円** |

---

## 5.3 楽観

Premium 5%、Storage 0.5GB/MAU。

| 年  |    MAU |        MRR |    Cost/月 |            収支/月 |
| -- | -----: | ---------: | --------: | --------------: |
| Y0 |    100 |     5,000円 |   約5,000円 |         **±0円** |
| Y1 |    300 |    15,000円 |   約6,000円 |     **＋9,000円** |
| Y2 |  1,500 |    75,000円 |  約13,000円 |    **＋62,000円** |
| Y3 |  6,000 |   300,000円 |  約34,000円 |   **＋266,000円** |
| Y4 | 18,000 |   900,000円 |  約86,000円 |   **＋814,000円** |
| Y5 | 50,000 | 2,500,000円 | 約214,000円 | **＋2,286,000円** |

---

# 6. Y5比較

| 項目           |         悲観 |        通常 |           楽観 |
| ------------ | ---------: | --------: | -----------: |
| MAU          |     10,000 |    32,000 |       50,000 |
| Premium率     |         1% |        3% |           5% |
| Premium User |        100 |       960 |        2,500 |
| MRR          |       10万円 |      96万円 |        250万円 |
| Cost/月       |    約11.6万円 |     約17万円 |      約21.4万円 |
| **収支/月**     | **▲1.6万円** | **＋79万円** | **＋228.6万円** |

---

# 7. Cost Guardrail

想定外のコスト増加を防ぐため以下を実施する。

| 対象         | 対策                         |
| ---------- | -------------------------- |
| Storage    | Free 3GB / Premium 20GB    |
| Free Media | 12か月で削除                    |
| API        | Rate Limit                 |
| DB         | Index / Pagination / N+1防止 |
| Media      | R2から直接配信                   |
| Deleted Media | 30日保持しStorage上限に算入      |
| Bot / DoS  | Rate Limit / WAF等          |
| Retry      | 回数制限・Backoff               |
| Logging    | Retention設定                |
| Cost       | Budget Alert・利用量監視         |

Storage上限にはActive Mediaと「最近削除したMedia」の両方を含める。これにより削除済みMediaを含めてもUser単位の最大Storage使用量をPlan上限内に制御する。

Storageの最大R2原価は以下となる。

| Plan    |   上限 | 最大Storage原価/User/月 |
| ------- | ---: | -----------------: |
| Free    |  3GB |             約6.75円 |
| Premium | 20GB |               約45円 |

---

# 8. 動画追加時

動画はMVP対象外とする。

需要が確認された場合、圧縮・Transcodeした上で追加する。

| 項目        |   Free | Premium |
| --------- | -----: | ------: |
| Storage   |    3GB |    20GB |
| 動画        |     少量 |      拡張 |
| 1動画       | 最大5分想定 |      拡張 |
| Transcode |   上限あり |    上限あり |

動画ではStorageとは別にTranscode Costが発生する。

```text
Transcode Cost
= Transcode単価/分 × Transcode時間
```

Storage容量だけではTranscode費を制御できないため、**Storage GBとTranscode Minutesを別々に制限する。**

---

# 9. 試算対象外

| 項目                    | 理由      |
| --------------------- | ------- |
| 動画Transcode / 配信      | MVP対象外  |
| AI演奏分析                | 対象外     |
| 広告費                   | 未定      |
| 有料Monitoring / Search | 未定      |
| 外注費                   | 個人開発    |
| 開発者人件費                | 個人開発    |
| 法務・会計・法人費             | 事業化時に試算 |

---

# 10. 主要管理指標

| 分類        | KPI                            |
| --------- | ------------------------------ |
| Growth    | MAU                            |
| Retention | D7 / D30                       |
| Usage     | 投稿率、Storage/MAU、音声再生数          |
| Revenue   | Premium転換率、MRR、Churn           |
| Cost      | Cost/MAU、R2、Workers、DB Compute |
| Profit    | MRR - Running Cost             |

特に以下をビジネスモデル成立性の主要指標とする。

* Premium転換率
* Storage / MAU
* API / DAU
* 音声再生 / DAU
* Cost / MAU
* MRR - Running Cost

実サービス開始後は実測値で前提を更新し、定期的に再試算する。
