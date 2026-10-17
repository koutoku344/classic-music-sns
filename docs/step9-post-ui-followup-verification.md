# STEP9：投稿UI小修正（音声プレビュー・カード遷移・削除メニュー）

## 実装
- `CreatePost.tsx`：音声選択画面に選択済みの「作曲者 / 曲名｜曲を変更」を表示。未選択時は「未選択｜曲を選択」。曲を選ぶと音声画面へ戻り曲名が見える。
- `PracticeAudioPicker.tsx`：録音プレビューと既存音声プレビューのHTML audioに`controlsList="nodownload"`を指定。
- `PostMediaView.tsx`：投稿一覧・詳細のaudioに同じ指定。Chrome等のブラウザ標準再生速度メニューは維持する想定（環境により表示が異なる）。
- `PostSummary.tsx`と`Community.tsx`：投稿カードをクリック／Enterで詳細に遷移。音声プレイヤーを操作しても遷移しない。従来の「投稿詳細を見る」リンクは削除。
- `RouteScreen.tsx`、`MyPage.tsx`：マイページからの詳細遷移に`?from=my-page`を付ける。
- `PostDetail.tsx`：上部「…」は、`from=my-page`かつログイン本人の投稿だけに表示。「削除」のみに変更。削除成功後はマイページへ戻る。

## 設計上の注意（重要）
- `from=my-page`は**UI導線にすぎずセキュリティ上の認証情報ではない**。利用者はURLを自由に書き換えられる。よってこの文字列をBackend APIの権限判定には使わない。
- DELETE APIは既存実装のJWT認証と`posts.user_id = current_user.id`で所有者チェックを実施。未認証は401、他人の投稿は404。投稿削除の保護は**APIの所有者判定**で保証し、遷移元限定は**画面表示**の方針。
- 投稿編集UIは「…」から外した。既存のPATCH API／編集ページは互換性と将来拡張のため現時点では残す。編集による排他制御は別の課題であり「削除のみ」の選択は単純な導線にするため。
- `controlsList="nodownload"`はブラウザ標準のダウンロードボタンを隠す**UI指示**。R2の署名付きURLを取得可能な閲覧者によるファイル保存やネットワーク経由の取得を完全には禁止できない。
- 再生速度変更はHTMLAudioElementのクライアント側再生速度処理であり、同じストリームを速度を変えて再生するだけなら通常Backend APIへの追加リクエストやDB負荷はない。再度のメディアGETやRangeリクエスト等はブラウザに依存。

## 確認手順

WSL Ubuntu：

```bash
cd ~/classic-music-sns
git switch feat/step9-posts
git pull origin feat/step9-posts
npx tsc --noEmit
npm run dev
```

Chrome：
1. `/posts/new`→音声→保存済み音声→曲を選択。音声画面に「作曲者 / 曲名｜曲を変更」と出る。
2. 音声のプレビューを再生。Chromeの3点メニューは再生速度のみ（ダウンロードなし）を確認。ブラウザ差異があればスクリーンショットを残す。
3. `/posts`・`/search`・`/my-page`の投稿カード本文／余白を押すと詳細に遷移。音声の再生操作では遷移しない。「投稿詳細を見る」は表示されない。
4. `/posts`から自分の投稿を開くと詳細の3点メニューなし。
5. `/my-page`から自分の投稿を開くと詳細の3点メニューあり、内容は削除のみ。削除の確認ダイアログはキャンセルする。
6. 別ユーザーの投稿では3点メニューなし。未認証／他人のDELETE APIは従来どおり401／404。
7. `?from=my-page`を手作業で付けても、他人の投稿の削除は画面でもAPIでも不可能。
8. 既存の投稿／メディア／テストデータは削除しない。

今回はFrontendのみ変更であり、SQLマイグレーション／Backend再デプロイは不要。
