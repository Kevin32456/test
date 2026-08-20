# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## 階段

**v0.4.0 — 像素 UI + 可部署（main）**

## 玩家幻想

球燙手，甩尾狗越追越快；在狗漂移繞圈過來之前，把球丟給隊友。

## v0.4 摘要

| 面向 | 改動 |
|------|------|
| UI | Fusion Pixel 12px 繁體、大廳直角像素風 |
| 部署 | `render.yaml`、Dockerfile、`/health`、單埠 production |

## 核心規則

- 狗追球；持球追正面；飛行追球軌跡
- 右鍵移動/傳球；持球禁 Blink
- 4 人連線；最後存活者勝

## 數值（constants.ts）

- 玩家 220 · 狗 155→600 · Blink 140px/3s · 傳球後保留 80% 狗壓

## Git

- `main` = v0.4.0
- 新功能：`cursor/<描述>-a9d0`

## 執行

```bash
npm install && npm run dev          # 開發
npm run build && npm start          # 正式（需 NODE_ENV=production）
```

## 下一個最安全任務

1. 4 人線上 playtest（部署 URL）
2. 補原始角色 sprite
3. 局內 HUD / 威脅條像素化打磨

## 風險

- Render 免費版休眠；WebSocket 需 Web Service 非 Static Site
- 角色圖仍為占位色塊
