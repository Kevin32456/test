# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## 階段

**v0.3.0 — 選角 + 狗壓平衡（main）**

## 玩家幻想

球燙手，甩尾狗越追越快；在狗漂移繞圈過來之前，把球丟給隊友。

## v0.3 摘要

| 面向 | 改動 |
|------|------|
| 選角 | 大廳 4 角色、不可重複、伺服器驗證 |
| 平衡 | 狗基礎/加速/上限上調，正面截擊更黏、冰面抓地更強 |
| 素材 | 移除 AI 生成角色圖；`public/assets/characters/` 待換原始 PNG |

## 核心規則

- 狗追球；持球追正面；飛行追球軌跡
- 右鍵移動/傳球；持球禁 Blink
- 4 人連線；最後存活者勝

## 數值（constants.ts）

- 玩家 220 · 狗 155→600 · Blink 140px/3s · 傳球後保留 80% 狗壓

## Git

- `main` = v0.3.0
- 新功能：`cursor/<描述>-a9d0`

## 執行

```bash
npm install && npm run dev
```

## 下一個最安全任務

1. **v0.4 UI 優化** — 大廳/局內 HUD、選角卡片、威脅條與操作提示視覺打磨
2. 補上使用者原始四張角色 sprite（`char-hat/gauntlet/spike/coat.png`）
3. 4 人 playtest 驗證現有狗壓曲線

## 風險

- 狗速偏難（v0.3 已多輪上調，需 playtest）
- 角色圖仍為占位色塊（缺原始素材）
- Phaser bundle 偏大（~1.5MB），尚未 code-split
