# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## Project Goal

還原 WC3 自製地圖「甩狗」的網頁派對對局：伺服器權威、最多 8 人、熱土豆 + 甩尾狗。

## Current Phase

- Phase: Steam 前置／staging hardening
- Status: 可玩；Render 公開服務已通過 4 人與 8 人多人 smoke，進入 online QA／Steam 前置階段

## 玩家幻想

球燙手，甩尾狗越追越快；在狗漂移繞圈過來之前，把球丟給隊友。

## Latest Completed Work

- 移除 WASD／操控模式，僅右鍵移動／傳球、Space Blink
- 傳球為飛行彈道（800 px/s），落地才持球；持球 hover 顯示可傳球，點選半徑 44px
- 物理 60Hz、位置包 30Hz；傳球／落地／Blink／擊殺即時廣播；快照精簡量化
- 狗壓無上限；每秒加速 56；傳球保留 90%；飛行中壓力繼續累加
- 開局狗給基礎速度；高速時轉向與折返隨速度放大（避免無限甩尾無敵）
- 咬人半徑 15+18；死亡停頓 2 秒後從死者位置重開球
- 離場玩家會從畫面移除（socket id 換新不再殘影）
- Socket.IO join/action 已加入 runtime payload 驗證，malformed payload 不再讓 server 崩潰
- 倒數期間低於 2 人會取消倒數並回到大廳
- `npm start` 改為跨平台 production 啟動；新增 server focused tests 與 GitHub Actions CI
- Phaser 改為進入倒數／遊戲時才 dynamic import，縮小初始 entry bundle
- 新增 Electron desktop wrapper；啟動時內嵌 production server，產生 Windows portable `.exe`
- 新增 4–12 碼英數房間碼；伺服器按房間隔離 Socket.IO 狀態與玩家名單，空房會清理
- 大廳可切換目前伺服器／遠端伺服器；遠端 URL 與房間碼會記住在本機 localStorage
- join 邊界拒絕未知角色 ID；玩家名單改用 text node 渲染，避免遠端暱稱注入 HTML
- staging 改用 `dist-server` 編譯結果啟動；新增 `/ready`、版本／uptime／房間／連線狀態
- 新增結構化 JSON server log（啟動、連線、加入拒絕／成功、斷線 reason）與 `npm run test:staging`
- 已取得 Render staging URL：`https://test-vccb.onrender.com`；公開端已完成新版 redeploy，`/ready` 回傳 `ready: true`、`version: staging`
- 新增 `tests/staging.stress.ts` 與 `npm run test:staging:stress`：8 人滿房、第 9 人拒絕、應用層延遲／抖動／丟失 action、斷線清理與 8 人重連

## 核心規則

- 狗追球；持球追人；飛行追球
- 右鍵移動／傳球；持球也可 Blink
- 死亡全場停 2 秒，再重新分配球權
- 最多 8 人；最後存活者勝

## 數值（`src/shared/constants.ts`）

- 玩家 300 · 狗基礎 135 · 每秒加速 56 · 壓力與狗速無上限
- Blink 160px／2.8s · 傳球後保留 90% 狗壓 · 飛行 800
- 急回頭牽引 5.5 · 朝向轉速 10／急轉 16 · 高速 agility 0.9
- 擊殺判定 33px · 死亡停頓 2000ms · tick 60／net 30

## Important Modified Files

- `src/shared/constants.ts` — 平衡與同步頻率
- `server/GameRoom.ts` — 權威物理、傳球、狗、擊殺
- `server/index.ts` — 房間管理、送包節流與即時事件
- `server/validation.ts`、`server/start.ts` — 網路 payload 驗證、跨平台 production 啟動
- `electron/main.cjs`、`tsconfig.server.build.json` — 桌面啟動器、內嵌 server、server emit build
- `src/client/network.ts`、`src/client/main.ts`、`src/client/style.css` — 遠端 URL／房間碼設定與大廳 UI
- `src/client/scenes/GameScene.ts` — 輸入、插值、hover、離場清圖
- `tests/server.test.ts`、`tests/staging.smoke.ts`、`tests/staging.stress.ts`、`.github/workflows/ci.yml` — focused tests、staging smoke、8 人 stress、CI
- `render.yaml`、`Dockerfile`、`package.json` — Render／Docker 編譯後啟動設定

## Git

- repo：https://github.com/Kevin32456/test
- `main` = v0.4.0 基底 + 後續平衡／netcode／UI commit
- 新功能建議：`cursor/<描述>-a9d0`

## 執行

```bash
npm install && npm run dev
npm run build
```

PowerShell 正式（常用 playtest 埠）：

```powershell
$env:HOST='0.0.0.0'; $env:PORT='4320'; npm start
```

## Verification

- `npm test`：通過（payload validation、倒數離場重置）
- `npm run typecheck`：通過
- `npm run build`：通過；初始 entry 約 54 KB，Phaser deferred chunk 約 1.48 MB
- `npm run desktop:build`：通過；產生 `release/Shuai-Gou-0.4.0-x64.exe`（105,320,850 bytes，SHA256 `4F5C44937F64ABB07B57EE088C8DE8844E1D72E1EF0CEEA2B1319944447CE0C3`）
- packaged unpacked runtime smoke：通過；動態 loopback port `/health` 200、phase `lobby`
- portable runtime smoke：通過；首次解包等待後動態 loopback port `/health` 200、phase `lobby`
- multi-room Socket.IO smoke：通過；`ALPHA`／`BETA` 各自只看到同房 2 人，health 回報 2 房／4 人，斷線後房間清理
- `npm run start:prod`：通過；compiled server `/ready`、首頁靜態檔 200
- `npm run test:staging`：通過；4 人雙房間、斷線後 4 個角色可再次加入，最後 `rooms:0`／`players:0`／`connections:0`
- 公開 Render smoke：通過；`/ready` 與 `/health` 為新版 JSON，4 客戶／雙房間隔離、斷線清理與 4 角色重連成功，最後 `rooms:0`／`players:0`／`connections:0`
- `npm run test:staging:stress` 本機 production：通過；8 人同房、192 個模擬 action、48 個丟失、8 人重連與清理成功
- `npm run test:staging:stress` 公開 Render：通過；8 人同房、153/192 action 送出、39/192 action 丟失，所有客戶持續收到狀態，最後 `rooms:0`／`players:0`／`connections:0`
- staging JSON log：通過；可觀察 `server_started`、`join_accepted`、`connection_closed` 與 disconnect reason
- Windows `npm start`、`/health`、production 首頁：通過
- malformed join/action smoke：回傳 `invalid_payload`，server 維持運作
- 瀏覽器大廳／兩人開局 smoke：可建立 Phaser canvas 並進入對局
- 本機 4320 + Cloudflare 隧道可載入大廳與新 bundle
- 離場殘影、傳球 hover 已在線上 build 驗證入口 HTML

## Known Risks / Untested Areas

- 8 人滿房、Radmin 滿載上傳尚未完整實測
- 接到球到可再傳仍受飛行時間 + 單程延遲限制（非接球硬直）
- 高速 agility 0.9 的甩尾／咬人平衡需再 playtest
- 角色 PNG 仍不存在；目前依需求保留程式繪製 fallback 與對應載入錯誤
- Phaser deferred chunk 仍大，需以 profiler／目標裝置決定是否進一步拆分
- desktop prototype 使用 Electron 預設圖示，尚未配置正式 icon／Windows code signing
- desktop 預設啟動本機 server；遠端 URL／房間碼已可測試，但尚未有常駐遠端部署、Steam App ID、Steam Lobby
- Render staging URL 已取得並完成新版部署；8 人單房與應用層 action jitter/loss 已驗證，但尚未做真實 transport-level 丟包、跨裝置延遲或長時間壓測
- `npm run test:staging:stress` 的延遲／抖動／丟失是測試客戶端 action 模擬，不等同於作業系統或路由器層的封包損失
- Render free plan 可能休眠；Socket.IO 遠端對局需要確認實際方案與單實例限制
- Cloudflare 快速隧道無 SLA；關機即斷

## Next Safest Task

下一個最安全任務是做真實瀏覽器／跨裝置 8 人對局與 transport-level 網路測試，再整理 Steam 發行前的桌面包裝、簽章、Steamworks 與商店素材清單。先不要付 Steam Direct 或接完整 Steamworks SDK。
