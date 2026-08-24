# 甩狗（Shuai Gou） v0.4.0

《魔獸爭霸 III》自製地圖「甩狗」的網頁版還原：最多 8 人連線、鬼抓人 + 熱土豆。伺服器權威（Vite + Phaser 3 + Socket.io）。

## 規則摘要

- 開局前從 8 名角色中選角，角色不可重複；2 人即可開局，滿 8 人自動倒數
- 狗追**球**：持球時追持球者（近身帶一點前方偏移）；傳球飛行中追球
- 持球越久狗越快，壓力與狗速**無上限**；傳球當下壓力只保留 90%（掉 10%），飛行中壓力仍繼續累加
- **僅右鍵**：點地移動；持球且球不在飛時，右鍵點存活隊友傳球（有飛行軌跡）
- 持球時滑鼠移到隊友身上會顯示「可傳球」提示；點選半徑 44px
- 全員可 Blink（Space，160px／CD 2.8 秒），持球也可 Blink
- 被狗碰到（持球且球不在飛）出局；全場凍結 2 秒後球從死者位置飛向隨機存活者
- 最後存活者獲勝

## 本機開發

```bash
npm install
npm run dev
```

Focused server checks：

```bash
npm test
npm run typecheck
```

- 前端：http://127.0.0.1:4317
- 伺服器：4318（Socket.io，Vite 會 proxy）

## 正式環境（單埠）

```bash
npm install
npm run build
```

PowerShell：

```powershell
$env:HOST='0.0.0.0'; $env:PORT='4320'; npm start
```

Unix：

```bash
NODE_ENV=production HOST=0.0.0.0 PORT=4320 npm start
```

`npm start` 會跨平台以 production 模式啟動；未指定 `PORT` 時預設為 4318。

瀏覽器開對應埠即可（靜態頁 + WebSocket 同一 port）。預設未設 `PORT` 時為 4318。

## Staging 部署與 smoke test

Render Blueprint 已設定為 `npm ci && npm run build`，啟動使用編譯後的 `npm run start:prod`，健康檢查為 `/health`。本機可用同一流程驗證：

```powershell
npm ci
npm run build
$env:HOST='127.0.0.1'; $env:PORT='4395'; $env:APP_VERSION='staging-local'; npm run start:prod
```

伺服器提供 `/health` 與 `/ready`，會回報版本、啟動時間、uptime、房間數、玩家數與連線數；`/metrics` 提供基本 Prometheus counters；啟動、加入、拒絕、錯誤與斷線會輸出 JSON log。正式服務方案、告警與 rollback 規則見 [docs/OPERATIONS.md](docs/OPERATIONS.md)。對已部署的 URL 執行 4 人／雙房間 smoke：

```powershell
$env:STAGING_URL='https://你的-staging-url'; npm run test:staging
```

Docker 也會使用 `dist-server` 的編譯結果啟動，不需要在 runtime 重新載入 TypeScript。

## Windows 桌面版（Steam 前置）

桌面版目前使用 Electron 包裝 Phaser，啟動時會在本機 loopback 動態埠啟動內嵌的 production server；這是本機／Steam 前置測試，不需要 Steamworks App ID 或 Steam Direct 費用。

```powershell
npm run desktop:dev
npm run desktop:build
```

portable 輸出位置：`release/Shuai-Gou-0.4.0-x64.exe`。目前執行檔尚未配置正式遊戲圖示與程式碼簽章，也尚未接 Steamworks；遠端多人伺服器仍需另外部署。

桌面版大廳可選「目前伺服器（本機／此頁面）」或「遠端伺服器」，並輸入房間碼。房間碼為 4–12 碼英數字；要一起玩的玩家必須使用相同的伺服器 URL 與房間碼。桌面版預設使用自己啟動的本機伺服器，改用遠端測試時，所有玩家輸入同一個公開 URL 即可。

## 給朋友連線

### Radmin VPN（延遲較低）

1. 全員加入同一個 Radmin 網路
2. 房主開正式伺服器（聽 `0.0.0.0`）
3. 朋友瀏覽器開 `http://<房主虛擬IP>:<PORT>`，例如 `http://26.x.x.x:4320`
4. Windows 防火牆需放行該埠

### Cloudflare 快速隧道

```powershell
cloudflared tunnel --url http://127.0.0.1:4320
```

把產生的 `https://*.trycloudflare.com` 分享給朋友。路徑會繞 Cloudflare，延遲通常高於 Radmin／區網。電腦休眠或關掉隧道／伺服器視窗，網址即失效。

進入遊戲後選「遠端伺服器」，貼上該 URL，再讓所有玩家輸入同一房間碼（例如 `ALPHA`）。不同房間碼會互相隔離，不會看到彼此玩家或狀態。

**注意：** 關瀏覽器分頁會把該玩家移出房間；關伺服器或隧道視窗則整場斷線。

## 部署

### Render

1. 將 repo 連到 [Render](https://render.com)
2. 選 **Blueprint** 或手動 Web Service（根目錄有 `render.yaml`）
3. 手動設定：
   - Build：`npm ci && npm run build`
   - Start：`npm run start:prod`
   - Env：`NODE_ENV=production`

目前 playtest 以本機 + 隧道／Radmin 為主，尚未綁定常駐雲端。

### Docker

```bash
docker build -t shuai-gou .
docker run -p 4318:4318 -e NODE_ENV=production shuai-gou
```

## 網路與同步

- 物理 **60Hz**，位置快照 **30Hz**
- 傳球、落地、Blink、擊殺、開局／勝負：**發生當下立刻廣播**
- 快照已精簡（不上報內部速度／輸入），座標量化

## 主要數值（`src/shared/constants.ts`）

| 項目 | 值 |
|------|-----|
| 玩家速度 | 300 |
| 狗基礎速度 | 135 |
| 狗每秒加速 | 56（無上限） |
| 傳球壓力保留 | 90% |
| 傳球飛行速度 | 800 px/s |
| Blink | 160px／2.8s |
| 咬人半徑 | 玩家 15 + 狗 18 = 33px |
| 傳球點選半徑 | 44px |
| 死亡停頓 | 2000ms |
| 高速轉向放大 | `DOG_SPEED_AGILITY_GAIN` 0.9（避免高速甩尾無敵） |

## 版本

| 版本 | 說明 |
|------|------|
| **v0.4.0** | Fusion Pixel 字型、大廳像素 UI、8 人／8 角、部署設定 |
| （main 後續） | 僅右鍵操作；傳球飛行；60/30 同步；離場清殘影；傳球 hover；狗高速轉向補償 |
| **v0.3.0** | 開局選角、狗追人強化 |
| **v0.2.0** | 插值平滑、狗壓力條、持球環、音效 |
| **v0.1.0** | 首個可玩版本 |

## Git

- **Repository**：https://github.com/Kevin32456/test
- 分支策略見 [docs/BRANCHING.md](docs/BRANCHING.md)。穩定版在 `main`。

## 文件

- [docs/GDD-v1.md](docs/GDD-v1.md) — 設計與現行規格
- [CODEX_HANDOFF.md](CODEX_HANDOFF.md) — 專案交接
- [DEBUG_HANDOFF.md](DEBUG_HANDOFF.md) — 已知物理／缺陷紀錄
