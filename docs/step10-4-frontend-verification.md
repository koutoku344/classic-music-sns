# STEP10-4 Frontend実装・最小確認手順

ブランチ：`feat/step10-feedback`
状態：GitHubにコード反映済み。ローカル型チェック・ビルド・デプロイ・画面検証は未実施。

## 実装内容

- `features/sonolii/lib/feedbackApi.ts`: GET/POST/DELETE コメント、返信取得、投稿・コメントのいいねAPI。
- `features/sonolii/components/PostFeedback.tsx`: 投稿いいね、親コメント新しい順、返信古い順、1階層のスレッド、削除済み表示、本人／投稿者削除、返信、コメントいいね、20件単位ページング。
- `features/sonolii/components/PostMediaView.tsx`: 標準HTMLAudioElementの再生位置をコメント画面へ渡し、コメントの時刻クリックで再生位置へ移動。
- `features/sonolii/screens/PostDetail.tsx`: 新しいコメントUIを統合。投稿・メディアの既存仕様は維持。

### 確定仕様の対応

| 機能 | 実装 |
| --- | --- |
| 親コメント | 時刻なし/あり、1〜1000文字 |
| 返信 | 返信への返信も親コメントの直下、@返信先 |
| 削除 | コメント本人・投稿者のみUIにボタン表示、実際の権限はAPI側で検証 |
| 墓石 | 返信ありの削除済み親は表示、返信がすべて消えると非表示 |
| コメント受付OFF | 投稿/返信フォームを表示せず、過去コメントは表示 |
| いいね | 投稿、通常コメント、タイムスタンプコメント、返信 |
| 時刻 | 親コメントのみ添付可能、現在の音声再生位置を秒に変換して保存 |
| ページング | 親コメント、返信ともにカーソルベース |

## 確認方法（最小）

1. WSL：`cd ~/classic-music-sns && git switch feat/step10-feedback && git pull origin feat/step10-feedback`
2. `npx tsc --noEmit && npm run build`。エラー時はデプロイせずログを共有。
3. 型チェック／ビルド成功後、Frontendを既存手順でデプロイ：`npm run deploy`。STEP10-4はFrontendのみ変更のためBackendの再デプロイは通常不要。
4. Sonoliiにログインして、公開または自分の投稿の詳細を開く。
   - 通常コメント投稿、返信、返信への返信、投稿/コメントのいいね
   - 音声の現在位置を添付して投稿→時刻を押して再生位置にジャンプ
   - **新規テスト用コメントだけ**を削除し、返信と墓石表示を確認
   - コメント受付OFFの投稿では投稿フォームが表示されず、既存コメントは見える
5. 画面確認結果を報告し、別アカウントの権限確認、長いコメント一覧、重複操作、レート制限をSTEP10-5総合テストで実施。

## 注意

- STEP9のテスト投稿・音声・画像・R2 Objectを削除しない。
- コメント削除ボタンによる論理削除は復元UIがないため、新規テスト用コメント以外は削除しない。
- Clerkトークンの取得はAPIクライアントがリクエストの都度実行する。Chrome Consoleの一時変数は不要。
- 動作不良の場合はNetworkのHTTP statusとConsoleエラーを収集。トークン/署名URLは共有しない。
