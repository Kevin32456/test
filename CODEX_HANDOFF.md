# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## Project Goal

還原 WC3 自製地圖「甩狗」的網頁派對對局：伺服器權威、最多 8 人、熱土豆 + 甩尾狗。

## Current Phase

- Phase: Steam 上架前內容完成（alpha／vertical slice）
- Status: 核心回合、Render staging、新手指南、單人練習房、第二競技場與 teach／test／twist／mastery 最小 slice 已通過本機 QA；目前進入公開 staging 更新前的內容／網路驗證，Steamworks 暫停

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
- 瀏覽器 QA 修正遠端模式空 URL 誤連目前頁面的問題；公開版已驗證空 URL 阻止加入、有效 Render URL 可加入，console 無 error/warn
- `GameScene` 停止預載不存在的角色 PNG，保留 canvas fallback；公開 8 分頁對局不再產生 asset console errors
- 大廳新增可收合／可重看的玩法指南，倒數畫面補上目標與主要操作提示，結算狀態明確顯示勝者與下一局
- 8 名角色新增選角風格與描述，明確標示目前不改變戰鬥數值
- 新增 `docs/CONTENT-ROADMAP.md`，將練習房、第二競技場、回合變化與上架內容 gate 排序
- 新增 `PracticeScene` 單人練習房：走位 → Blink → 傳球三步驟，練習搭檔、緩速追球狗、完成／重試／返回大廳流程均在本機完成
- 新增 `src/shared/arenas.ts`：朱印圓場／月影庭的內容資料、調色盤、路線提示與 arena ID 驗證
- 第二競技場已接上房間快照、join payload 與 `selectArena` action；房間內所有玩家同步看到月影庭，核心圓形邊界與規則不變
- 第二競技場加入 teach／test／twist／mastery 四階段：伺服器依回合時間發出 `arenaStage`，月影庭切換單一路線、四月燈、斜線與全場動線；加入階段提示與短音效
- 新增 `docs/PLAYTEST-OBSERVATION.md`，規範不熟悉規則玩家的練習房、第一局與月影庭觀察流程

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
- `src/shared/arenas.ts` — 競技場內容資料與同步 ID
- `server/GameRoom.ts` — 權威物理、傳球、狗、擊殺
- `server/index.ts` — 房間管理、競技場同步、送包節流與即時事件
- `server/validation.ts`、`server/start.ts` — 網路 payload 驗證、跨平台 production 啟動
- `electron/main.cjs`、`tsconfig.server.build.json` — 桌面啟動器、內嵌 server、server emit build
- `src/client/network.ts`、`src/client/main.ts`、`src/client/style.css` — 遠端 URL／房間碼設定與大廳 UI
- `src/client/scenes/GameScene.ts` — 競技場繪製、輸入、插值、hover、離場清圖
- `src/client/audio/Sfx.ts` — 既有操作音效與四階段提示音
- `src/client/scenes/PracticeScene.ts` — 單人練習房的教學步驟、練習搭檔與非致命追球狗
- `src/shared/characters.ts` — 角色選角風格與描述資料
- `tests/server.test.ts`、`tests/staging.smoke.ts`、`tests/staging.stress.ts`、`.github/workflows/ci.yml` — focused tests、staging smoke、8 人 stress、CI
- `render.yaml`、`Dockerfile`、`package.json` — Render／Docker 編譯後啟動設定
- `STEAM_RELEASE_CHECKLIST.md` — Steamworks、SteamPipe、Windows 簽章與商店素材缺口
- `docs/CONTENT-ROADMAP.md` — 上架前內容里程碑與 cut list

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
- `npm run desktop:build`：通過；重新產生含練習房的 `release/Shuai-Gou-0.4.0-x64.exe`（105,326,025 bytes，SHA256 `C8A4370BE72E9A8617A15D01F5935024997C836F651FB9EEC06F7BE36923002C`）
- packaged unpacked runtime smoke：通過；動態 loopback port `/health` 200、phase `lobby`
- portable runtime smoke：通過；含練習房的 portable 首次解包後動態 loopback port `/health` 200、`ready: true`、phase `lobby`，測試程序已清理；artifact Authenticode 為 `NotSigned`
- 本機內容瀏覽器 smoke：通過；玩法指南可收合／重開，兩名測試玩家可加入、倒數後進入 Phaser canvas 對局，清理後 server `rooms:0`／`players:0`／`connections:0`
- 單人練習房瀏覽器 smoke：通過；畫面完成 `練習 1/3 → 2/3 → 3/3 → 練習完成`，重新練習與 Esc 回大廳成功，console 無 error/warn，清理後 server `rooms:0`／`players:0`／`connections:0`
- 練習房後多人回歸：通過；兩名玩家仍可加入、提前開始、進入 Phaser canvas，兩頁 console 無 error/warn，清理後 server `rooms:0`／`players:0`／`connections:0`
- multi-room Socket.IO smoke：通過；`ALPHA`／`BETA` 各自只看到同房 2 人，health 回報 2 房／4 人，斷線後房間清理
- `npm run start:prod`：通過；compiled server `/ready`、首頁靜態檔 200
- `npm run test:staging`：通過；4 人雙房間、斷線後 4 個角色可再次加入，最後 `rooms:0`／`players:0`／`connections:0`
- 公開 Render smoke：通過；`/ready` 與 `/health` 為新版 JSON，4 客戶／雙房間隔離、斷線清理與 4 角色重連成功，最後 `rooms:0`／`players:0`／`connections:0`
- `npm run test:staging:stress` 本機 production：通過；8 人同房、192 個模擬 action、48 個丟失、8 人重連與清理成功
- `npm run test:staging:stress` 公開 Render：通過；8 人同房、153/192 action 送出、39/192 action 丟失，所有客戶持續收到狀態，最後 `rooms:0`／`players:0`／`connections:0`
- `npm run typecheck`：通過；第二競技場的 shared/server/client arena contract 無型別錯誤
- `npm test`：通過；arena join/action 驗證、房間 arena snapshot 與既有倒數離場測試通過
- `npm run build`：通過；production bundle 含第二競技場資料與重畫邏輯
- `npm run test:staging:stress` 本機 production（新版 arena stage）：通過；8 人同房、第一位選月影庭後 8/8 收到 `moon-garden`、第 9 人拒絕、192 個延遲／丟失 action、stage 已進入 `test`、斷線與重連清理成功
- 本機第二競技場瀏覽器 smoke：通過；第一位玩家選月影庭後，第二位以朱印圓場加入仍被房間快照校正為月影庭；大廳切換可同步到兩頁，兩頁 canvas 均出現月庭四路標／菱形動線，console 無 error/warn
- 本機階段畫面 smoke：通過；canvas 顯示月影庭 teach 階段的單一路線、亮／暗月燈與階段文字提示，兩頁 console 無 error/warn
- 小螢幕入口 smoke：通過；390×844 下競技場選單、加入房間與練習房按鈕可見可操作，viewport 已恢復預設
- 公開瀏覽器 QA：通過；新版 bundle `index-D8uulqrq.js`，空白遠端 URL 顯示要求輸入並不建立房間；填入 `https://test-vccb.onrender.com` 可加入 `BRWQA22E`，離開後 `/ready` 回到 0 房／0 人／0 連線
- 公開 8 分頁瀏覽器 QA：通過；`BRWUI824` 8/8 逐頁加入、滿房自動倒數、8/8 Phaser canvas、8/8 無 console error/warn，離開後 `/ready` 回到 0 房／0 人／0 連線
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
- 角色 PNG 仍不存在；目前使用程式繪製的 deterministic pixel art，畫面可用但尚未完成可交付的正式素材包
- Phaser deferred chunk 仍大，需以 profiler／目標裝置決定是否進一步拆分
- desktop prototype 使用 Electron 預設圖示；portable artifact 的 Authenticode 狀態為 `NotSigned`，尚未配置正式 icon／Windows code signing
- desktop 預設啟動本機 server；遠端 URL／房間碼已可測試，但尚未有常駐遠端部署、Steam App ID、Steam Lobby
- Render staging URL 已取得並完成新版部署；8 人單房與應用層 action jitter/loss 已驗證，但尚未做真實 transport-level 丟包、跨裝置延遲或長時間壓測
- `npm run test:staging:stress` 的延遲／抖動／丟失是測試客戶端 action 模擬，不等同於作業系統或路由器層的封包損失
- 8 分頁瀏覽器 QA 仍是同一台機器／網路，尚未取代 8 台不同裝置／網路的真人對局證據
- Render free plan 可能休眠；Socket.IO 遠端對局需要確認實際方案與單實例限制
- Cloudflare 快速隧道無 SLA；關機即斷
- 本次內容切片尚未推送到 GitHub／Render；目前只在本機 production build／stress 驗證
- 練習房目前是非致命的三步驟教學 proof，尚未以非開發者玩家觀察完成率；正式對局仍是單一標準回合，第二競技場目前不改規則
- 角色描述目前是選擇提示而非不同能力；第二競技場目前是視覺／路線節奏 proof，尚未加入障礙物碰撞、特殊回合或正式素材包
- 第二競技場已完成同機 8 人與應用層延遲／丟失驗證，但尚未完成跨裝置、真人高延遲、非開發者理解度與長時間重玩驗證

## Next Safest Task

下一個最安全任務是把目前切片提交並部署到 Render staging，重跑公開 8 人／arena sync／斷線清理 smoke；同時安排非開發者依 `docs/PLAYTEST-OBSERVATION.md` 實測。正式角色素材、跨裝置真人測試與 Steam App ID／SteamPipe／簽章仍不混入本階段。詳見 `docs/CONTENT-ROADMAP.md` 與 `STEAM_RELEASE_CHECKLIST.md`。
