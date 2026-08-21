# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## Project Goal

還原 WC3 自製地圖「甩狗」的網頁派對對局：伺服器權威、最多 8 人、熱土豆 + 甩尾狗。

## Current Phase

- Phase: 維護／平衡與連線手感
- Status: 可玩；本機 production + Radmin／Cloudflare 隧道 playtest

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
- `server/index.ts` — 送包節流與即時事件
- `src/client/scenes/GameScene.ts` — 輸入、插值、hover、離場清圖
- `src/client/main.ts` — 大廳（無操控模式）

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
$env:NODE_ENV='production'; $env:HOST='0.0.0.0'; $env:PORT='4320'; npx tsx server/index.ts
```

## Verification

- `npm run typecheck`：通過
- 本機 4320 + Cloudflare 隧道可載入大廳與新 bundle
- 離場殘影、傳球 hover 已在線上 build 驗證入口 HTML

## Known Risks / Untested Areas

- 8 人滿房、Radmin 滿載上傳尚未完整實測
- 接到球到可再傳仍受飛行時間 + 單程延遲限制（非接球硬直）
- 高速 agility 0.9 的甩尾／咬人平衡需再 playtest
- Render 尚未當正式常駐主機
- Cloudflare 快速隧道無 SLA；關機即斷

## Next Safest Task

playtest：高速甩尾是否還能無限脫身；傳球 hover 點空率；Radmin 與隧道延遲對比。若仍無敵，再調 `DOG_SPEED_AGILITY_GAIN` 或加連續掠過懲罰。
