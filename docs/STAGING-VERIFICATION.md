# Render staging 驗證紀錄

## 目標

確認 GitHub `main` 的最新遊戲內容已部署到 Render staging，並用公開 URL 驗證多人服務與玩家入口，而不是只依賴本機測試。

## 版本證據

- URL：<https://test-vccb.onrender.com>
- Render 已驗證的最後一個功能性 deployment commit：`723eb9e`（`feat: add adaptive game music and audio toggle`）；包含 `290303f` 的完整階段 gate 與 `cfb930f` 的重玩入口修正。`7ddad85` 與 `7d17a20` 是部署可觀測性／交接文件更新。
- 公開首頁最新前端 bundle：`/assets/index-ifvnWVxG.js`，已確認包含聲音開關與 6 種 music mode
- 公開 `/ready`：HTTP 200，`ready: true`，測試後 `rooms: 0`、`players: 0`、`connections: 0`
- 公開 `/metrics`：HTTP 200，包含 `shuai_gou_build_info`、`shuai_gou_ready`、連線、房間與 invalid action 指標
- `SERVICE_URL=https://test-vccb.onrender.com npm run ops:check`：在 `723eb9e` 功能部署後通過；當時公開服務回報 commit `723eb9ec1659637e2af885685cf68ff75cb76e69`，`/health`、`/ready`、`/metrics` 均正常，測試後房間／玩家／連線為 0
- 公開首頁與本機 `dist/assets/index-ifvnWVxG.js` 的 SHA-256 相同（`32917EEAC428C76C28C2DA099DDEBE385063F65003CF54A304FC1535FF73FA77`）；新版包含 `arenaStage` 與 audio toggle
- 公開 CSS 已切換至 `index-DKzjsNtz.css`，包含 420px 以下入口收窄規則；目前桌面 viewport `1280×720` 無橫向溢出，實體 390px 仍需真人裝置確認
- 最新功能性公開驗證觀測的 `/ready.startedAt`：`2026-08-24T19:06:43.384Z`

## 已通過

- `npm run test:staging`：4 客戶、雙房間隔離、斷線清理與重新加入
- `npm run test:staging:stress`：8 人月影庭、第 9 人拒絕、8 個 distinct spawn、真實 pass flight、狗路徑 130 個位置／58 個轉向樣本、150/192 action 送出、42/192 應用層丟失、最大延遲 3624ms、8 人重連與清理
- `npm run test:staging:replay`：公開短回合 4 回合 × 5 秒通過；另以 3 回合 × 15 秒長 replay 通過，每回合約 139–140 actions、404–409 state events／客戶，最終清理為 0
- `npm run test:staging:stages`：公開 Render 8 人月影庭持續對局直到收到完整 `teach → test → twist → mastery`，stageSeen 四階段完整、驗證當下 8 人／8 連線，測試後清理為 0
- `npm run test:staging:network`：真實 Render WebSocket；connect 約 682ms、join ack 約 161ms、128 個狀態樣本，間隔 p95 50ms／最大 813ms，disconnect→reconnect→重新加入通過，最終清理為 0
- `723eb9e` 公開 redeploy 回歸：8 人月影庭完整 `teach → test → twist → mastery`；network connect 662ms、join ack 159ms、p95 50ms／最大 813ms；4 回合 replay、8 人滿房／第 9 人拒絕、pass flight、狗路徑與重連清理均通過，最終 0 房／0 人／0 連線
- `npm run test:staging:long`：公開 Render 固定 3 回合 × 15 秒通過；每回合 139、139、140 actions，約 406–408 個 state events／客戶，測試前後房間／玩家／連線均為 0
- 公開瀏覽器單人練習：完成 1/3 → 2/3 → 3/3 → 練習完成
- 本機 Electron `npm run test:layout`：通過；`390×844` 下繁中／英文大廳與結算文字 fixture 均無水平溢位／文字裁切，語言、競技場、房間、暱稱、練習與加入控制項均在視窗內；實體手機仍待測
- 公開瀏覽器雙分頁：兩位玩家以不同角色加入同一個月影庭房間，兩頁同步顯示月影庭四個月燈路標與相同玩家位置；繁中／英文切換與 8 個正式 SVG 圖示載入成功
- 公開瀏覽器結算：實際雙人月影庭回合完成後，結算流程可回到大廳；最新版本按鈕顯示 `Play again`，且測試分頁關閉後服務回到 0 房／0 人／0 連線

## 尚不能宣稱完成

- 上述 8 人測試仍是同一執行環境的 Socket.IO 客戶端與應用層 jitter/loss 模擬；不等同 8 台實體裝置、不同 ISP 或路由器層封包損失。
- `test:staging:network` 的 interval jitter 是單一測試環境到 Render 的觀測值，不是所有玩家網路的 SLA；要完成跨 ISP／跨裝置證據仍需真人測試。
- 部署後第一次 network run 遇到 staging process 在進入 playing 前重啟，重試在新啟動完成後通過；這正是 Free staging 不適合作為正式多人 SLA 的證據。
- 尚未有非開發者的練習房／第一局觀察紀錄；請使用 `docs/PLAYTEST-OBSERVATION.md`，測試途中不要教玩家。
- 正式 v1 方案已決定為 Render 常駐付費 Web Service、單一 instance，但尚未建立正式服務 URL、外部告警／log drain；Render Free 休眠不可作為正式多人服務承諾。
