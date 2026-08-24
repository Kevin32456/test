# Render staging 驗證紀錄

## 目標

確認 GitHub `main` 的最新遊戲內容已部署到 Render staging，並用公開 URL 驗證多人服務與玩家入口，而不是只依賴本機測試。

## 版本證據

- URL：<https://test-vccb.onrender.com>
- Render 已驗證的內容 commit：`7cbf411`（`docs: align handoff with pushed operations gate`）
- GitHub 後續紀錄 commit：`ceba1c8`（本文件與 handoff 更新；不改變遊戲 bundle）
- 公開 `/ready`：HTTP 200，`ready: true`，測試後 `rooms: 0`、`players: 0`、`connections: 0`
- 公開 `/metrics`：HTTP 200，包含 `shuai_gou_ready`、連線、房間與 invalid action 指標
- 公開首頁與本機 `dist/assets/index-DNgnsZ5W.js` 的 SHA-256 相同；新版動態 chunk 包含 `arenaStage`

## 已通過

- `npm run test:staging`：4 客戶、雙房間隔離、斷線清理與重新加入
- `npm run test:staging:stress`：8 人月影庭、第 9 人拒絕、151/192 action 送出、41/192 應用層丟失、最大延遲 3612ms、8 人重連與清理
- `npm run test:staging:replay`：4 回合 × 5 秒；每回合 2 客戶、47 actions、約 177–181 state events／客戶，最終清理為 0
- 公開瀏覽器單人練習：完成 1/3 → 2/3 → 3/3 → 練習完成
- 公開瀏覽器雙分頁：兩位玩家以不同角色加入同一個月影庭房間，兩頁同步顯示月影庭四個月燈路標與相同玩家位置；繁中／英文切換與 8 個正式 SVG 圖示載入成功

## 尚不能宣稱完成

- 上述 8 人測試仍是同一執行環境的 Socket.IO 客戶端與應用層 jitter/loss 模擬；不等同 8 台實體裝置、不同 ISP 或路由器層封包損失。
- 尚未有非開發者的練習房／第一局觀察紀錄；請使用 `docs/PLAYTEST-OBSERVATION.md`，測試途中不要教玩家。
- 尚未接外部告警／log drain，也尚未決定正式常駐伺服器方案；Render Free 休眠不可作為正式多人服務承諾。
