# 甩狗（Shuai Gou） v0.4.0

《魔獸爭霸 III》自製地圖「甩狗」的網頁版還原：最多 8 人連線、鬼抓人 + 熱土豆。

## 規則摘要

- 狗追**球**（持球時追玩家正面；傳球飛行中追球）
- 持球越久狗越快，轉彎有甩尾飄移
- 右鍵點地移動；持球時右鍵點活人傳球（有球路動畫）
- 持球者也可 Blink（有 CD）
- 被狗碰到（持球時）出局；最後存活者獲勝
- 開局前從 8 名角色中選角，角色不可重複

## 本機開發

```bash
npm install
npm run dev
```

- 前端：http://127.0.0.1:4317
- 伺服器：4318（Socket.io）

## 正式環境（單埠）

```bash
npm install
npm run build
NODE_ENV=production PORT=4318 npm start
```

瀏覽器開 `http://127.0.0.1:4318` 即可（靜態頁 + WebSocket 同一 port）。

## 部署

### Render（推薦）

1. 將 repo 連到 [Render](https://render.com)（需 GitHub/GitLab）
2. 選 **Blueprint** 或手動 Web Service
3. 若用 Blueprint：repo 根目錄已有 `render.yaml`
4. 手動設定：
   - Build：`npm install && npm run build`
   - Start：`npm start`
   - Env：`NODE_ENV=production`

### Docker

```bash
docker build -t shuai-gou .
docker run -p 4318:4318 -e NODE_ENV=production shuai-gou
```

### 快速給朋友測（本機 + 隧道）

```bash
npm run build && NODE_ENV=production PORT=4318 npm start
# 另開終端
cloudflared tunnel --url http://127.0.0.1:4318
```

把隧道產生的 `https://*.trycloudflare.com` 連結分享給朋友。

## 版本

| 版本 | 說明 |
|------|------|
| **v0.4.0** | Fusion Pixel 像素字、大廳像素 UI、部署設定 |
| **v0.3.0** | 開局選角、狗追人強化 |
| **v0.2.0** | 插值平滑、狗壓力條、持球環、音效 |
| **v0.1.0** | 首個可玩版本 |

## Git

- **Repository**：https://github.com/Kevin32456/test
- 分支策略見 [docs/BRANCHING.md](docs/BRANCHING.md)。穩定版在 `main`。

## 文件

- [docs/GDD-v1.md](docs/GDD-v1.md) — 完整設計
- [CODEX_HANDOFF.md](CODEX_HANDOFF.md) — 專案交接
