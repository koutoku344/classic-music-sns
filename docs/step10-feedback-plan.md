# STEP10 フィードバック・交流機能：確定仕様／実装計画

更新日：2026-10-17
作業ブランチ：`feat/step10-feedback`（STEP9マージ後のmainをベース）
状態：STEP10-1仕様確定、STEP10-2 DB設計案作成、Neon適用待ち

## 目的

Sonoliiの演奏投稿に対し、ユーザーが通常コメント・音声の特定時間へのコメント・いいねで交流できるようにする。STEP9の投稿・閲覧・Media認可を再利用する。

## 1. STEP10-1 確定事項（ユーザー指定）

1. いいねをSTEP10で実装する。
2. コメント返信は後続STEPとする。
3. コメントの削除は「コメント本人」または「その投稿の投稿者」が可能。
4. `posts.comments_enabled=false`では既存コメントを表示するが、新規コメントを拒否する。
5. タイムスタンプは音声プレイヤーの再生位置をワンタップで添付する。秒数の手入力欄は設けない。

### STEP9から維持する仕様

- 投稿公開範囲は`profiles.visibility`単位。現状`public`は全員、`followers/private`は本人のみ（フォロー機能未実装）。
- 投稿の音声は最大1件。投稿に曲が登録されている場合は音声添付が必須。
- 投稿に既に存在する`comments_enabled`を使用し、新しいコメント許可フラグを追加しない。
- R2の音声／画像をコピーしない。コメントといいねはNeonのみ。

## 2. MVP詳細仕様（初期値）

| 対象 | 仕様 |
| --- | --- |
| コメント本文 | 前後空白を除去後1〜1000文字。文字列以外、不正な入力、長さ超過は400 |
| コメント種類 | 通常（時刻NULL）、タイムスタンプ（0以上の整数秒）を同一`post_comments`テーブルで管理 |
| Timestamp付与 | 音声の再生位置を1タップで添付、解除も可能。投稿先に音声がある場合のみ |
| Timestamp検証 | APIで投稿に現在紐づくready音声があるか確認。保存済みdurationが正しく取得できる場合のみ、duration内にあることを検証。duration不明なら時刻コメント受付を保留する |
| Timestamp再生 | 表示した`MM:SS`（1時間超なら`H:MM:SS`）を押すと該当投稿の音声プレイヤー位置へ移動 |
| コメント一覧 | 作成日時の昇順か降順かはUI実装前に決定。初期設計は新しい順のカーソルページング（20件/ページ） |
| コメント削除 | コメント本人か投稿者本人のみ。物理DELETE。削除後の復元機能なし |
| コメント受付OFF | コメントのGETと削除は可能、POSTのみ拒否（例：409 `comments_disabled`） |
| コメント認証 | GETは投稿が閲覧可能なら匿名可、POST/DELETEはClerk認証必須 |
| いいね | 投稿単位に1ユーザー1件。登録と解除を冪等に実装。いいね数と本人のいいね状態を表示 |
| いいねとコメント受付 | `comments_enabled=false`でもいいね可能 |
| 自分の投稿 | 自分自身へのコメント・いいねを禁止しない |
| 返信・通知・フォロー | STEP10では実装しない |

コメントを投稿した後で投稿の公開範囲が非公開になれば、その時点から閲覧者の権限でGET結果を制限する。Post所有者とコメント所有者はDBのUUIDで照合する。

## 3. API設計（STEP10-3で実装）

| Method | Endpoint | 認証 | 処理 |
| --- | --- | --- | --- |
| GET | `/posts/:postId/comments?limit=20&cursor=...` | 任意 | 投稿可視性を検査し、新しい順で一覧取得 |
| POST | `/posts/:postId/comments` | 必須 | コメント受付ON、投稿可視性、文字数、timestampの妥当性を検証して201 |
| DELETE | `/posts/:postId/comments/:commentId` | 必須 | コメント本人／投稿者本人なら204 |
| GET | `/posts/:postId/likes` | 任意 | 投稿可視性を検査し、件数・ログイン本人の状態を返す |
| PUT | `/posts/:postId/like` | 必須 | 重複時も成功扱いでいいね登録 |
| DELETE | `/posts/:postId/like` | 必須 | 未登録時も成功扱いで解除 |

- `POST /comments`リクエスト例：`{"body":"2小節目の表現が好きです","audioTimestampSeconds":83}`
- 通常コメントでは`audioTimestampSeconds:null`。
- コメント投稿と投稿側の`comments_enabled`変更／投稿削除が競合する場合は、投稿行ロック等で原子的に整合性を保持する。
- 公開範囲チェックは`GET /posts/:id`の認可条件と一致させる。
- いいね登録／解除はDBの複合主キーと`ON CONFLICT DO NOTHING`等で冪等にする。
- 新しいコメント／いいねルートは既存`/posts/:id`のルーティングと衝突しないよう、具体的なパスの判定順を確認する。

## 4. STEP10-2 DB設計

設計詳細：[STEP10-2 DB設計](step10-2-db-design.md)。

### `post_comments`

| 列 | 型 | 意味 |
| --- | --- | --- |
| id | UUID PK | コメント識別子 |
| post_id | UUID FK | 対象投稿（削除時CASCADE） |
| user_id | UUID FK | コメント投稿者（削除時CASCADE） |
| body | VARCHAR(1000) NOT NULL | コメント本文 |
| audio_timestamp_seconds | INTEGER NULL | 音声上の時刻、通常コメントならNULL |
| created_at | TIMESTAMPTZ NOT NULL | 作成時刻 |

### `post_likes`

| 列 | 型 | 意味 |
| --- | --- | --- |
| post_id | UUID PK/FK（一部） | 対象投稿、削除時CASCADE |
| user_id | UUID PK/FK（一部） | いいねした本人、削除時CASCADE |
| created_at | TIMESTAMPTZ NOT NULL | 登録日時 |

PK`(post_id,user_id)`で重複を禁止。追加INDEXはコメント一覧`(post_id,created_at DESC,id DESC)`、ユーザー削除時の参照`(user_id)`といいねの`(user_id)`。いいね数は当初`COUNT(*)`で取得し、集計列は設けない。

### 制約の分担

- DB CHECK：本文の長さ／前後空白、timestamp 0以上。FK：投稿・ユーザーが実在し削除時に孤立しない。
- Backend：投稿の可視性、comments_enabled、投稿／コメント所有者、紐づく音声の存在・時刻の上限を検査。
- **同時更新**：投稿編集で音声を外す操作と時刻コメント保存が競合するケースは、親投稿の行ロック順序も含めSTEP10-3で対策する。DB CHECKだけで別テーブルの音声尺は検証できない。
- 音声の関連解除後に既存の時刻コメントが残る可能性がある。MVPではコメント本文は残し、時刻へのジャンプは音声がある場合のみ有効（仕様）。既存コメントを連鎖削除しない。

## 5. フロントエンド導線（STEP10-4）

```text
投稿詳細
├ 演奏音声プレイヤー
├ いいね♡ + 件数
├ コメント一覧
│   ├ 通常コメント
│   └ [01:23] コメント本文 → 時刻を押すと再生位置へ
└ コメント入力（comments_enabled=trueの時のみ）
    ├ メッセージ
    ├ 再生位置を添付（音声ありの投稿のみ）
    └ 送信 → 押下後の入力エラー表示
```

UI上で非表示でもBackendの認証／権限／コメントOFFを必ず検査。非公開プロフィールのコメントも公開しない。

## 6. 非機能・テスト

- 投稿一覧の件数増加に備えページング・INDEX・レスポンスサイズ制限。
- XSS対策：コメント本文はReactの通常のテキスト描画を使用。
- API書込みレート制限を検討し、不正な連投やコスト増を防ぐ。
- コメント／いいねはNeonのRead/Write/Storageを増やすがR2保存容量は増やさない。タイムスタンプの再生移動はブラウザ側処理。
- テスト：未認証、投稿公開範囲、コメントOFF、投稿者削除、時刻コメント音声なし拒否、二重いいね、本人以外の削除、投稿削除時のCASCADE、カーソルページング、同時操作。
- STEP9のテスト用Post/Mediaを削除しない。STEP10-2のSQLは新規テーブルのみ追加し、既存投稿やMediaを更新しない。

## 7. 実装順

STEP10-1 仕様確定（完了） → STEP10-2 DB設計／SQL（適用待ち） → STEP10-3 Backend → STEP10-4 Frontend → STEP10-5 総合テスト → STEP10-6 設計書更新・mainマージ。
