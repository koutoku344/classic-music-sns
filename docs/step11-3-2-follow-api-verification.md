# STEP11-3-2 フォローBackend API 実装・検証手順

更新日：2026-10-20
状態：GitHubへ実装保存済み。**型チェック・Backendデプロイ・API実行テストはユーザー環境で未実施。**
前提：Neon SQL019と020が適用済み。

## 1. 変更ファイル

- `backend/src/follows.ts`（新規）：フォロー操作・申請一覧・フォロー中一覧・状態取得。
- `backend/src/index.ts`：新ルートの判定、JWT・Sonolii UUIDの認証経路への組込み。

今工程では`posts.ts`、`feedback.ts`、`media.ts`、R2、既存レコードには手を加えていない。

## 2. API一覧

| Method | URL | 内容・レスポンス |
| --- | --- | --- |
| GET | `/users/{userId}/follow` | 未認証可。自分との関係（status=null / pending / accepted / self）と相手visibility |
| PUT | `/users/{userId}/follow` | ログイン必須。公開→accepted、限定→pending、拒否→即再申請。JSON `{follow:{id,status,changed}}` |
| DELETE | `/users/{userId}/follow` | 自分の申請取下げ・フォロー解除。204（冪等） |
| GET | `/me/follow-requests?limit=20&cursor=...` | 自分宛pending申請の新着順。最大50件 |
| POST | `/me/follow-requests/{followId}/accept` | 承認。200 |
| POST | `/me/follow-requests/{followId}/reject` | 拒否。200 |
| DELETE | `/me/followers/{userId}` | 自分の承認済みフォロワー削除。204 |
| GET | `/me/following?limit=20&cursor=...` | 自分の承認済みフォロー中一覧 |

**未実装**：公開フォロワー一覧`GET /users/{id}/followers`は閲覧プライバシー仕様の整備後の工程。現状404。フォロワー限定投稿の閲覧権限、通知一覧・未読・自動削除も後工程。
本工程の新規書き込みAPIにはフィードバック用のRate Limitはまだ適用していない。量産的な連続リクエストテストはしないこと。STEP11-3-5でフォロー操作専用の制限を入れる。

プロフィール未設定者のPUTは`403 profile_required`、自己フォローは400、相手の登録済みプロフィールがないと404、本人以外の申請承認・拒否は404、異なる状態への不整合な応答は409。

## 3. WSL：デプロイ前の確認

```bash
cd ~/classic-music-sns
git switch feat/step11-follow-notifications
git pull origin feat/step11-follow-notifications
git status
npx tsc --noEmit
npm run build
```

エラーがあれば**デプロイしない**。特に`git status`の未コミット変更は勝手に破棄しない。
正常ならBackendのみデプロイ：

```bash
npx wrangler deploy --config backend/wrangler.jsonc
```

この工程ではFrontendのデプロイは不要。

## 4. 非破壊確認

SonoliiのアカウントでログインしてChrome F12 Consoleで実行。
下記はAPIのGETのみで、既存フォロー・通知・投稿・音声・画像に変更しない。

```javascript
(async () => {
  const api = "https://sonolii-api.g57cydy6ks.workers.dev";
  const token = await window.Clerk?.session?.getToken();
  if (!token) {
    console.error("ログインしてから実行してください");
    return;
  }

  const headers = { Authorization: `Bearer ${token}` };
  for (const path of ["/me/following", "/me/follow-requests"]) {
    const response = await fetch(api + path, { headers });
    const body = await response.json();
    console.log(path, response.status, body);
  }
})();
```

**期待**：両方200、初回は`following: []`、`requests: []`、`nextCursor: null`。
既存の履歴があれば空配列でなくてもよい。

## 5. 書込みの動作確認

既存DBを守るため、以下は**明示的にテストに使用する2アカウント**で実施し、実行する対象ユーザーIDを確認するまで開始しない。

- A（申請者）・B（申請先）のプロフィールを設定。
- Bを`followers`にしてAからPUT /users/{B}/follow → pending。
- B側`GET /me/follow-requests`で申請IDが見える。
- Bがaccept → accepted。AのGET状態もaccepted。
- AのDELETEで解除できる。Bの申請一覧・Aのフォロー中に残らない。
- 新規申請のreject→直後再申請でpendingに戻ることを確認。
- Aの同一申請を再度PUTしても`changed:false`で通知・申請が重複しないことを確認。
- Bの公開設定を`private`にしても、承認済みフォローの状態は維持する。ただし投稿は**この工程ではまだ承認済み閲覧を実装していない**ため、STEP11-3-3で確認。

**注意**：申請テストで新規作成した`follows`／`notifications`は、DELETEで申請関係を解消しても通知履歴は残る。既存データは一切削除しない。検証後のテスト通知の消去が必要なら、対象イベントのみを特定して別途手順化する。

## 6. 次工程

STEP11-3-3：`followers`時に承認済みフォロワーがプロフィール詳細・投稿・コメント・添付R2 read-urlを閲覧できるよう、関連する既存APIを横断的に更新。
`private`は本人限定を厳守する。
