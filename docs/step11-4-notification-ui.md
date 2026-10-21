# STEP11-4-1: 通知画面の実API連携

状態：GitHubブランチ `feat/step11-follow-notifications` へ反映済み。Cloudflareへのデプロイは未実施。Playwrightブラウザ検証とTypeScript型チェックは未実施。

## 変更ファイル

- `features/sonolii/lib/notificationApi.ts`：Clerk Bearer JWTで通知一覧・未読件数・個別既読・一括既読を呼び出す
- `features/sonolii/screens/Notifications.tsx`：サンプル通知を廃止し、DB通知一覧に切り替え
- `app/_components/RouteScreen.tsx`：ヘッダー未読バッジをDB由来の件数に切替。既読時に画面内のイベントで再取得

## UIの仕様

- ログイン時に20件取得、続きは`もっと見る`（カーソル・ページング）
- 未読件数、通知種別に応じたアイコン、作成日時、未読の背景色
- 各通知の`既読`ボタン。更新後にヘッダー未読マークも再取得
- `すべて既読`は確認ダイアログで明示的に承認した場合のみPOST
- 更新ボタン、取得中/エラー/空状態を表示
- **相手の表示名・投稿内容・投稿リンクは未実装**。現在のAPIはIDや本文を返さないため、サンプルデータと混ぜたり、推測でリンクを付けたりしない。画面には種類別の定型文のみ表示する。
- HeaderにリアルタイムPushやポーリングは導入していない。画面遷移・個別既読・一括既読の際に再取得する。

## 確認手順

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
npx tsc --noEmit
npm run build
```

ローカルで目視確認：

```bash
npm run dev
```

1. 開発画面にClerkでログインし、`/notifications` を表示
2. 以前作成した通知が表示され、サンプルの人名・画像が出ないことを確認
3. 未読件数とヘッダーの未読ドットを確認
4. 一件だけ既読にした場合、未読件数・背景色・ヘッダー表示が更新されることを確認
5. `すべて既読`を押すと確認ダイアログが表示されることを確認。**操作すると全未読が更新されるので、確認だけならキャンセルする**
6. 件数が多いときに`もっと見る`を確認

ローカル画面での既読操作も、本番化予定の現在のNeon DBに書き込まれる。読み取り確認にとどめる場合、既読ボタンと全件既読は押さない。

## 追加で必要な作業

- 公開範囲・投稿削除・フォロー状態の再確認を含む通知詳細API（actor名やpost遷移先）を安全に設計
- Backend連携済みの一覧でE2Eテスト
- 一括既読の専用テスト環境での書き込み検証（既存通知の一括既読は行わない）
- 既読30日後の削除Cronが新デプロイで正常に実行されることを確認
