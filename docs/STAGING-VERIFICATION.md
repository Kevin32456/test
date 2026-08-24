# Render staging 驗證紀錄

## 目標

確認 GitHub `main` 的最新遊戲內容已部署到 Render staging，並用公開 URL 驗證多人服務與玩家入口，而不是只依賴本機測試。

## 版本證據

- URL：<https://test-vccb.onrender.com>
- Render 已驗證的內容 commit：`7cbf411`（`docs: align handoff with pushed operations gate`）
- GitHub 後續 main commits：補充本文件、hand-off、正式方案與網路測試；不改變已驗證的遊戲 bundle
- 公開 `/ready`：HTTP 200，`ready: true`，測試後 `rooms: 0`、`players: 0`、`connections: 0`
- 公開 `/metrics`：HTTP 200，包含 `shuai_gou_ready`、連線、房間與 invalid action 指標
- 公開首頁與本機 `dist/assets/index-DNgnsZ5W.js` 的 SHA-256 相同；新版動態 chunk 包含 `arenaStage`
- 本次公開網路測試觀測的 `/ready.startedAt`：`2026-08-24T17:49:36.581Z`

## 已通過

- `npm run test:staging`：4 客戶、雙房間隔離、斷線清理與重新加入
- `npm run test:staging:stress`：8 人月影庭、第 9 人拒絕、151/192 action 送出、41/192 應用層丟失、最大延遲 3612ms、8 人重連與清理
- `npm run test:staging:replay`：4 回合 × 5 秒；每回合 2 客戶、47 actions、約 177–181 state events／客戶，最終清理為 0
- `npm run test:staging:network`：真實 Render WebSocket；connect 約 675ms、join ack 約 160ms、127 個狀態樣本，間隔 p95 51ms／最大 819ms，disconnect→reconnect→重新加入通過，最終清理為 0
- 公開瀏覽器單人練習：完成 1/3 → 2/3 → 3/3 → 練習完成
- 公開瀏覽器雙分頁：兩位玩家以不同角色加入同一個月影庭房間，兩頁同步顯示月影庭四個月燈路標與相同玩家位置；繁中／英文切換與 8 個正式 SVG 圖示載入成功
- 公開瀏覽器結算：實際雙人回合顯示勝者、本人存活／出局、出局原因、下一步與「準備下一局」入口

## 尚不能宣稱完成

- 上述 8 人測試仍是同一執行環境的 Socket.IO 客戶端與應用層 jitter/loss 模擬；不等同 8 台實體裝置、不同 ISP 或路由器層封包損失。
- `test:staging:network` 的 interval jitter 是單一測試環境到 Render 的觀測值，不是所有玩家網路的 SLA；要完成跨 ISP／跨裝置證據仍需真人測試。
- 尚未有非開發者的練習房／第一局觀察紀錄；請使用 `docs/PLAYTEST-OBSERVATION.md`，測試途中不要教玩家。
- 正式 v1 方案已決定為 Render 常駐付費 Web Service、單一 instance，但尚未建立正式服務 URL、外部告警／log drain；Render Free 休眠不可作為正式多人服務承諾。
