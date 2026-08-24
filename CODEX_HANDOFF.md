# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## Project Goal

還原 WC3 自製地圖「甩狗」的網頁派對對局：伺服器權威、最多 8 人、熱土豆 + 甩尾狗。

## Current Phase

- Phase: Steam 上架前內容完成（alpha／vertical slice）
- Status: 核心回合、Render staging、新手指南、單人練習房、第二競技場、teach／test／twist／mastery、結算資訊、正式角色 SVG、繁中／英文介面切換與回合後重玩入口已通過本機 QA；最新 slice 已部署到公開 Render staging 並完成公開 API／瀏覽器／重玩驗證，仍待非開發者與跨裝置真人網路驗證，Steamworks 暫停

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
- 新增 `/metrics`、graceful shutdown、process error log 與 `docs/OPERATIONS.md`；正式方案維持單 instance，回滾以 Render previous deploy 或 `git revert` 為準
- `/ready`、`/metrics` 與 JSON log 已補 Git commit identity；可用於監控確認實際 build 與回滾目標，不再只依賴固定的 `version=staging`
- 新增 `scripts/check-service.ts`、`npm run ops:check` 與手動 GitHub Actions health gate；正式 URL 建立後可重跑同一組健康檢查
- 已取得 Render staging URL：`https://test-vccb.onrender.com`；公開 bundle hash 與本機 `dist` 一致，`/ready`、`/metrics` 與新版場地／練習房均已驗證
- 新增 `tests/staging.stress.ts` 與 `npm run test:staging:stress`：8 人滿房、第 9 人拒絕、應用層延遲／抖動／丟失 action、斷線清理與 8 人重連
- 新增 `tests/staging.network.ts` 與 `npm run test:staging:network`：量測真實 staging WebSocket 的連線／加入時間、狀態間隔 jitter，並驗證 disconnect→reconnect→重新加入
- 新增 `tests/staging.stages.ts` 與 `npm run test:staging:stages`：8 人月影庭持續對局，驗證所有客戶收到完整 `teach → test → twist → mastery` 階段序列
- 瀏覽器 QA 修正遠端模式空 URL 誤連目前頁面的問題；公開版已驗證空 URL 阻止加入、有效 Render URL 可加入，console 無 error/warn
- `GameScene`／`PracticeScene` 會載入專案內 8 個正式 SVG 角色圖示；保留 canvas fallback，避免素材載入失敗阻斷 playtest
- 大廳新增可收合／可重看的玩法指南，倒數畫面補上目標與主要操作提示，結算狀態明確顯示勝者與下一局
- 8 名角色新增選角風格與描述，明確標示目前不改變戰鬥數值
- 新增 `docs/CONTENT-ROADMAP.md`，將練習房、第二競技場、回合變化與上架內容 gate 排序
- 新增 `PracticeScene` 單人練習房：走位 → Blink → 傳球三步驟，練習搭檔、緩速追球狗、完成／重試／返回大廳流程均在本機完成
- 新增 `src/shared/arenas.ts`：朱印圓場／月影庭的內容資料、調色盤、路線提示與 arena ID 驗證
- 第二競技場已接上房間快照、join payload 與 `selectArena` action；房間內所有玩家同步看到月影庭，核心圓形邊界與規則不變
- 第二競技場加入 teach／test／twist／mastery 四階段：伺服器依回合時間發出 `arenaStage`，月影庭切換單一路線、四月燈、斜線與全場動線；加入階段提示與短音效
- 新增 `docs/PLAYTEST-OBSERVATION.md`，規範不熟悉規則玩家的練習房、第一局與月影庭觀察流程
- 結算區塊加入勝者、本人存活／出局、出局原因、下一步提示與下一局入口；GameScene 結算 banner 同步顯示相同資訊
- 回合結束後大廳按鈕會切換為 `再玩一局／Play again`；已以公開 Render staging 實際雙人回合驗證結算→大廳→重玩入口
- 新增 `src/client/i18n.ts` 與大廳語言切換，繁中／英文覆蓋大廳、角色、競技場、練習房、HUD、階段提示與結算文字
- 新增 `scripts/generate-character-assets.ts` 與 8 個 `public/assets/characters/char-*.svg` 正式像素圖示；`npm run test:content` 驗證素材、階段資料與雙語字串

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
- `src/client/i18n.ts` — 繁中／英文介面與內容文字
- `scripts/generate-character-assets.ts`、`public/assets/characters/` — 正式角色圖示與可重建素材流程
- `src/client/scenes/PracticeScene.ts` — 單人練習房的教學步驟、練習搭檔與非致命追球狗
- `src/shared/characters.ts` — 角色選角風格與描述資料
- `tests/server.test.ts`、`tests/content.test.ts`、`tests/layout.smoke.cjs`、`tests/staging.smoke.ts`、`tests/staging.stress.ts`、`tests/staging.stages.ts`、`.github/workflows/ci.yml` — focused tests、素材／雙語／390px layout、staging smoke、8 人 stress／階段 gate、CI
- GitHub Actions CI 已加入 `npm run test:content` 與本機 production `npm run test:staging:stages`；後續內容變更會先經過雙語／素材與四階段同步 gate
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
- `npm run desktop:build`：通過；重新產生含練習房與最新重玩入口的 `release/Shuai-Gou-0.4.0-x64.exe`（105,336,570 bytes，SHA256 `1B60CEB452932691277369E56300CBE6F04B2C7DBE81333FD1AE117A932094F5`）
- packaged unpacked runtime smoke：通過；動態 loopback port `/health` 200、phase `lobby`
- portable runtime smoke：通過；含練習房的 portable 首次解包後動態 loopback port `/health` 200、`ready: true`、phase `lobby`，測試程序已清理；artifact Authenticode 為 `NotSigned`
- 本機內容瀏覽器 smoke：通過；玩法指南可收合／重開，兩名測試玩家可加入、倒數後進入 Phaser canvas 對局，清理後 server `rooms:0`／`players:0`／`connections:0`
- 單人練習房瀏覽器 smoke：通過；畫面完成 `練習 1/3 → 2/3 → 3/3 → 練習完成`，重新練習與 Esc 回大廳成功，console 無 error/warn，清理後 server `rooms:0`／`players:0`／`connections:0`
- 練習房後多人回歸：通過；兩名玩家仍可加入、提前開始、進入 Phaser canvas，兩頁 console 無 error/warn，清理後 server `rooms:0`／`players:0`／`connections:0`
- multi-room Socket.IO smoke：通過；`ALPHA`／`BETA` 各自只看到同房 2 人，health 回報 2 房／4 人，斷線後房間清理
- `npm run start:prod`：通過；compiled server `/ready`、首頁靜態檔 200
- `npm run test:staging`：通過；4 人雙房間、斷線後 4 個角色可再次加入，最後 `rooms:0`／`players:0`／`connections:0`
- 公開 Render smoke（最新 staging）：通過；`/ready` 與 `/health` 為 JSON，4 客戶／雙房間隔離、斷線清理與 4 角色重連成功；測後 `rooms:0`／`players:0`／`connections:0`
- `npm run test:staging:stress` 本機 production：通過；8 人同房、192 個模擬 action、48 個丟失、8 人重連與清理成功
- `npm run test:staging:stress` 公開 Render（最新 staging）：通過；8 人月影庭同房、第 9 人拒絕、8 個 distinct spawn、真實 pass flight、狗路徑 130 個位置／58 個轉向樣本、150/192 action 送出、42/192 丟失、最大延遲 3624ms、8/8 持續收到狀態，重連與清理成功
- `npm run test:staging:stages` 本機 production：通過；8 人同房直到完整 teach／test／twist／mastery，8 人／8 連線持續到 mastery，清理成功
- `npm run test:staging:stages` 公開 Render（最新 staging）：通過；8 人月影庭收到完整 teach／test／twist／mastery，驗證當下 8 人／8 連線，清理成功
- `npm run typecheck`：通過；第二競技場的 shared/server/client arena contract 無型別錯誤
- `npm test`：通過；arena join/action 驗證、房間 arena snapshot 與既有倒數離場測試通過
- `npm run build`：通過；production bundle 含第二競技場資料與重畫邏輯
- `npm run test:content`：通過；8 個角色 SVG、2 個競技場、teach／test／twist／mastery 順序與繁中／英文字串完整
- `npm run test:layout`：通過；Electron `390×844` 下繁中／英文大廳與結算文字 fixture 均無水平溢位／文字裁切，主要控制項均在視窗內；實體手機仍待測
- `npm run test:staging:replay`：通過；本機 3 局 × 3 秒重玩、每局多人加入／playing／Moon Garden／斷線清理，最後 `rooms:0`／`players:0`／`connections:0`
- `npm run test:staging:stress` 本機 production（新版 arena stage）：通過；8 人同房、第一位選月影庭後 8/8 收到 `moon-garden`、第 9 人拒絕、192 個延遲／丟失 action、stage 已進入 `test`、斷線與重連清理成功
- 本機第二競技場瀏覽器 smoke：通過；第一位玩家選月影庭後，第二位以朱印圓場加入仍被房間快照校正為月影庭；大廳切換可同步到兩頁，兩頁 canvas 均出現月庭四路標／菱形動線，console 無 error/warn
- 本機階段畫面 smoke：通過；canvas 顯示月影庭 teach 階段的單一路線、亮／暗月燈與階段文字提示，兩頁 console 無 error/warn
- 本機英文內容 smoke：通過；語言切換後角色 SVG 8/8 完整載入，練習房英文畫面完成 `1/3 → 2/3 → 3/3`，Phaser canvas 無 asset error
- 本機結算 smoke：通過；兩名玩家實際對局後顯示勝者、本人出局、出局原因、下一步與下一局準備入口
- 小螢幕入口 smoke：通過；390×844 下競技場選單、加入房間與練習房按鈕可見可操作，viewport 已恢復預設；新增 Electron layout gate 驗證繁中／英文無水平溢位／文字裁切
- 公開瀏覽器 QA（最新 staging）：通過；單人練習完成 1/3→2/3→3/3，繁中／英文切換、8 個正式 SVG 圖示載入、兩個分頁同步月影庭與四月燈路標，實際雙人回合顯示勝者／出局原因／下一步，結算後回到大廳顯示 `Play again`；清理後 `/ready` 回到 0 房／0 人／0 連線
- 公開 8 分頁瀏覽器 QA（上一版 baseline）：通過；8/8 逐頁加入、滿房自動倒數、8/8 Phaser canvas、8/8 無 console error/warn；最新 8 人內容以公開 staging stress script 重跑，跨裝置仍待真人驗證
- `npm run test:staging:replay` 公開 Render（最新 staging）：通過；短 replay 4 回合 × 5 秒，另完成長 replay 3 回合 × 15 秒（每回合約 139–140 actions、404–409 state events／客戶），最後 `rooms:0`／`players:0`／`connections:0`
- `npm run test:staging:network` 公開 Render（最新 staging）：通過；connect 約 682ms、join ack 約 161ms、128 個樣本，狀態間隔 p95 50ms／最大 813ms，真實 disconnect／reconnect／重新加入與清理成功；第一次部署後執行曾遇到 staging 重啟，重試通過
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
- 正式角色 SVG 已加入並在瀏覽器載入；仍需以最終 Steam 商店截圖確認整體美術方向，並決定是否補更高解析度宣傳素材
- Phaser deferred chunk 仍大，需以 profiler／目標裝置決定是否進一步拆分
- desktop prototype 使用 Electron 預設圖示；portable artifact 的 Authenticode 狀態為 `NotSigned`，尚未配置正式 icon／Windows code signing
- desktop 預設啟動本機 server；遠端 URL／房間碼已可測試，但尚未有常駐遠端部署、Steam App ID、Steam Lobby
- Render staging 已反映最新 slice；公開 8 人測試的 jitter/loss 仍是應用層 action 模擬，不等同真實 transport-level 丟包，跨裝置延遲與長時間真人壓測仍待完成
- 公開網路基線已量測單一執行環境的連線與狀態間隔；這不代表不同 ISP／裝置的 transport-level 丟包 SLA
- `npm run test:staging:stress` 的延遲／抖動／丟失是測試客戶端 action 模擬，不等同於作業系統或路由器層的封包損失
- Electron 390×844 layout gate 已通過，但仍不能取代實體手機字體／輸入測試；8 分頁瀏覽器 QA 也仍是同一台機器／網路，尚未取代 8 台不同裝置／網路的真人對局證據
- Render free plan 可能休眠；Socket.IO 遠端對局需要確認實際方案與單實例限制
- `/metrics` 與 JSON logs 已提供基本監控資料，但尚未接入外部告警／log drain；正式服務仍需配置常駐方案與告警目的地
- Cloudflare 快速隧道無 SLA；關機即斷
- 本輪遊戲內容部署基線為 GitHub `290303f`，包含回合後重玩入口與完整階段 gate；Render staging 已公開驗證，後續部署需保留 Render previous deploy／`git revert` 回滾路徑
- 練習房目前是非致命的三步驟教學 proof，尚未以非開發者玩家觀察完成率；正式對局仍是單一標準回合，第二競技場目前不改規則
- 角色描述仍是選擇提示而非不同能力；第二競技場目前是視覺／路線節奏 proof，尚未加入障礙物碰撞或特殊回合
- 第二競技場已完成同機 8 人、公開長 replay 與應用層延遲／丟失驗證，但尚未完成跨裝置、真人高延遲、非開發者理解度與真人長時間重玩意願驗證；公開回合後 `Play again` 入口已補齊，但仍需真人確認是否願意立即重開

## Next Safest Task

下一個最安全任務是安排至少一名不熟悉規則的玩家依 `docs/PLAYTEST-OBSERVATION.md` 完成練習房／第一局觀察，並以兩台以上不同網路裝置測試月影庭的出生點、傳球可讀性、狗甩尾、延遲與重連。正式常駐伺服器、外部告警／log drain、正式音樂／混音、Steam App ID／SteamPipe／簽章仍未完成。詳見 `docs/CONTENT-ROADMAP.md`、`docs/STAGING-VERIFICATION.md` 與 `STEAM_RELEASE_CHECKLIST.md`。
