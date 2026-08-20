# CODEX_HANDOFF — 甩狗（Shuai Gou）還原專案

## 階段

**v0.2.0 — Alpha 優化版（main）**

## 玩家幻想

球燙手，甩尾狗越追越快；在狗漂移繞圈過來之前，把球丟給隊友。

## v0.2 優化摘要

| 面向 | 改動 |
|------|------|
| 手感 | 玩家/狗/球 60fps 插值；傳球飛行中狗壓力不歸零 |
| 可讀性 | 持球脈衝環、移動標記、狗壓力條、局內倒數 |
| 回饋 | Web Audio 音效（傳球/Blink/死亡/勝利/倒數） |

## 核心規則

- 狗追球；持球追正面；飛行追球軌跡
- 右鍵移動/傳球；持球禁 Blink
- 4 人連線；最後存活者勝

## 數值（constants.ts）

- 玩家 220 · 狗 115→320 · Blink 140px/3s

## Git

- `main` = v0.2.0
- 新功能：`cursor/<描述>-a9d0`

## 執行

```bash
npm install && npm run dev
```

## 下一個最安全任務

1. 4 人 playtest 驗證壓力曲線與插值延遲感
2. v0.3：KaMe、部署、手機觸控

## 風險

- 傳球後狗壓力保留可能偏難（需 playtest）
- Phaser bundle 偏大（~1.5MB），尚未 code-split
