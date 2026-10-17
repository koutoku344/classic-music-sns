# STEP9：投稿機能 実装計画・設計確認

更新日：2026-10-16
作業ブランチ：`feat/step9-posts`
ベース：STEP8までをマージした `main`

## 目的

STEP8のPrivate R2に保存した音声や画像を、STEP9の投稿情報と紐付ける。
投稿の作成・編集・削除、一覧・詳細・本人ページ・ユーザープロフィール・投稿検索を
実データで運用できるようにする。現在の仮データは本実装へ移行する。

STEP8の音声・画像ファイルはそのまま再利用し、投稿の削除だけでは物理削除しない。

## 既存コード調査（main）

| 機能 | 現状 | 主なファイル |
| --- | --- | --- |
| 投稿作成 | 仮データ／録音・画像も一部ダミー、API保存なし | `features/sonolii/screens/CreatePost.tsx` |
| 投稿一覧 | `data.ts` の投稿を表示 | `features/sonolii/screens/Community.tsx` |
| 投稿詳細 | `data.ts` の投稿・画面内コメント | `features/sonolii/screens/PostDetail.tsx` |
| 投稿検索 | 仮データから曲別抽出 | `features/sonolii/screens/Search.tsx` |
| マイページ | 投稿領域は仮データ | `features/sonolii/screens/MyPage.tsx` |
| ユーザープロフィール | 投稿表示は未対応 | `features/sonolii/screens/UserProfile.tsx` |
| 曲／独自登録曲 | API・DBあり | `backend/src/index.ts`、`practiceApi.ts` |
| メディア | Owner向け署名URL、Private R2、ゴミ箱・容量制限 | `backend/src/media.ts`、`mediaApi.ts` |
| Profileの公開範囲 | User単位`public / followers / private` | `backend/src/index.ts` |

現在のBackendでは`followers`は承認済みフォロワーの判定機能がなく、プロフィール本人のみ閲覧可能。STEP9の投稿閲覧権限も同じ既存制約を明示し、後続のフォロー機能と連携させる。

## 実施順・完了条件

| STEP | 主な内容 | 完了条件 |
| --- | --- | --- |
| 9-1 | 既存画面・API調査、投稿仕様とテーブル関連決定 | 本計画と設計判断が合意済み |
| 9-2 | SQL Migration：投稿テーブル、曲参照、投稿メディア、必要な索引・制約 | Neonに適用、SELECT・制約テスト |
| 9-3 | Backend：投稿作成・一覧・詳細・更新・削除、ページネーション | 認証・エラー・CRUD動作テスト |
| 9-4 | R2連携：投稿メディアの所有者・ready検証、閲覧者向け短期Read URL、削除時の参照制御 | 本人／他人／非公開の閲覧・操作を検証 |
| 9-5 | Frontend投稿作成・編集：曲選択、テキスト、音声／画像、保存済みメディア再利用 | 再読込後も投稿がDBに残る |
| 9-6 | Frontend投稿一覧・詳細：実APIへの切替、メディア再生・画像表示、0件／エラー／ページネーション | 固定データへの依存を解消 |
| 9-7 | マイページ・他ユーザープロフィール・検索の投稿領域を接続 | DBに登録した投稿が権限に沿って表示 |
| 9-8 | 正常系・異常系・認可・負荷と費用影響のテスト | 非公開漏洩・他人更新・メディア権限を検証 |
| 9-9 | 設計／検証ドキュメント更新、リリース前残課題整理、mainマージ | PRと検証記録が整合 |

## データ設計：検討方針（確定前）

- `posts` に投稿者ID、内容、選択した曲ID（master `pieces` 又は本人の `user_pieces`）、コメント受付、フィードバック希望、作成／更新日時等を検討。
- 投稿メディアは既存`media`を再利用し、別の関連テーブル（例：`post_media`）で紐付ける。録音ファイルのコピーを作成しない。
- 投稿メディアを参照中にゴミ箱へ移動できるかは、参照元が壊れないよう所有者・参照保護の規則を確定してから実装。
- 投稿本文だけの投稿、画像のみ投稿、音声つき投稿を認めるか、曲の選択必須条件、件数制限は要件確定で判断。
- 索引は実際のアクセスに合わせて投稿作成日時／ユーザー／曲等に設け、過剰な複合索引は避ける。
- 投稿単位の公開設定は増やさず、`profiles.visibility`を基礎とする。現時点の`followers`はフォロー承認が実装されるまで本人のみとする。
- AI分析結果と演奏音声・画像は後日1つの投稿画面でそれぞれ選択する。STEP9では分析本体は作らない。

## STEP9-1 確定仕様（2026-10-17）

1. 本文・音声・画像のいずれか1つ以上で投稿可能。曲は任意。
2. 音声は1件まで、画像は最大5枚。投稿内の表示順は1〜6の整数で管理。
3. 同じメディアを複数の投稿・練習記録で再利用可能。R2ファイルの複製は不要。
4. 投稿で利用中のメディアは、ゴミ箱移動・完全削除を拒否する。投稿を削除してもメディア自体は保持。
5. 交流機能（コメント・いいね・フォロー）は後続STEP。STEP9は投稿作成・表示・検索まで。
6. `public` は本人以外も閲覧可能。`followers` と `private` はフォロー認可が実装されるまで本人のみ閲覧可能。
7. 公開範囲はユーザー単位、投稿単位で持たせない。閲覧判定はBackend APIで実施。
8. 音声／画像は`media`、投稿との関係は`post_media`で管理する。

## STEP9-2 DB設計とSQL

マイグレーション：[`db/migrations/011_create_posts_and_post_media.sql`](../db/migrations/011_create_posts_and_post_media.sql)

### posts

- `id`：UUID、PK。
- `user_id`：投稿者。FK `users.id`、投稿者とIDの複合UNIQUEを持つ。
- `piece_id`：マスター曲の任意FK。
- `user_piece_id`：本人登録曲の任意FK。複合FK`(user_id,user_piece_id)`により他人の曲参照を阻止。
- `piece_id`と`user_piece_id`は両方NULL可だが同時に非NULLにはできない。
- `body`：最大2000文字、空文字可（ただしメディアもない空投稿はBackendで拒否）。
- `comments_enabled`：将来のコメント受付に備えた設定。STEP9ではコメントを実装しない。
- `feedback_prefs`：将来の交流STEPでも利用するフィードバック希望。最大3項目。
- `created_at`/`updated_at`：作成／更新日時。

### post_media

- `post_id`：FK `posts.id` に対応。
- `media_id`：FK `media.id` に対応。
- `user_id`：複合FKで両者の所有者を一致させるための列。
- `display_order`：1〜6、1投稿で重複不可。
- `(post_id,media_id)`：複合PK、同一メディアの二重添付を防止。
- 親投稿の削除は`ON DELETE CASCADE`で関連だけ削除する。メディアファイルは保持。
- メディアの削除は`NO ACTION`により、利用中は参照整合性を保護する。

### DBだけでは保証しない条件

- 音声1件・画像5件、`media_type`の整合、`ready`で未削除か、内容が空なら最低1メディア必須、をBackendの同一トランザクションで検証する。媒体ごとの最大数は複数行の`media.media_type`を参照するためCHECK制約だけでは表現できない。
- 投稿作成・投稿メディア関連のINSERTは同一トランザクションで処理する。Neonの現在のSQLクライアントのトランザクション対応方式をSTEP9-3で検討する。
- 並行する投稿更新が枚数を超過しないよう、親`posts`行のロック等で直列化する。
- `post_media`が存在する場合は、STEP8のメディア削除APIも参照チェック対象を拡大する必要がある。
- 公開一覧は`profiles.visibility`および本人条件を必ずSQL/API側で評価する。
- 個別投稿をDELETEするとき、参照を消してよいのは関連テーブル`post_media`の行であり、`media`の行やR2オブジェクトを消さない。

### インデックス

- 全体時系列：`posts(created_at DESC,id DESC)`。
- 投稿者単位：`posts(user_id,created_at DESC,id DESC)`。
- マスター曲／本人登録曲：部分インデックスで曲別の一覧取得を支援。
- `post_media(post_id,media_id)`のPKと`(post_id,display_order)`のUNIQUEが投稿に属する媒体の取得を支援。
- `post_media(media_id)`で媒体の利用有無を確認。PKと同じ先頭列の冗長なインデックスを作成しない。

### SQL適用順

1. 事前SQLで`users`,`pieces`,`user_pieces`,`media`が存在すること、および`posts`,`post_media`がまだ存在しないことを確認。
2. 上記011 SQLのDDLと制約をレビュー。
3. Neon SQL Editorで011を1度だけ実行。
4. テーブル列・FK・INDEXの確認SQLを実行。
5. STEP9-3以降のAPI実装と異常系テストへ進む。

## 9-1で確定が必要な論点（解決済み・一部後続詳細化）

1. 投稿可能な最小構成：本文のみ／画像のみ／音声のみを許可するか、曲を必須とするか。
2. 添付数の初期上限：音声1件・画像1件を基本とするか、画像複数を許すか。
3. 保存済みメディアの再利用：同じメディアの複数投稿・練習記録との併用可否。
4. 投稿削除後のメディア保持・参照中メディアのゴミ箱制御。
5. コメント・いいね・タイムスタンプコメント／返信をSTEP9に含めるか、後続の交流STEPへ分離するか。
6. フォロワー限定公開が現状は本人のみになることをUIで説明するか。公開判定は必ずBackendで行う。
7. 投稿検索の対象：作品単位、自由記述キーワード、作曲者・曲名入力のUX。
8. 編集時の曲・メディア変更と、投稿本文・コメント受付・フィードバック希望の更新範囲。

## STEP9と後続機能の境界

STEP9は「投稿できる・適切な相手に表示できる・音声／画像を再生できる」を主目的とする。
フォロー承認、通知、コメント返信、いいね、AI分析などの別機能は要求を整理して段階的に実装する。
既存のPostDetailにある仮コメントUIを、API保存済み機能と誤認させないようにする。

## STEP8から継続する未完了事項

- STEP8-8-5-3：Cron Scheduled実行後、テスト用`pending`が`failed`に変更されたかCloudflare Observability／Neonで確認。
- 他ユーザーが所有するメディアへのアクセス、削除保護、R2とNeonの部分失敗時の復旧はリリース前に追加検証。
- R2 TTLは現時点Forever。リリース前にTTL／期限切れRead URL再取得／R2の容量・Class A/B費用を再検討。

## 直近の開始手順

WSL Ubuntu：
```bash
cd ~/classic-music-sns
git checkout main
git pull origin main
git fetch origin
git switch --track origin/feat/step9-posts
git status
```

その後9-1の仕様を確定し、9-2のSQL Migration作成へ進む。
