# 角色 Sprite

專案內的 8 名角色圖示是可交付的 12×16 像素 SVG 素材，供大廳、玩家列表、Phaser 場景、桌面包與 Steam 截圖共用。

如要修改色盤或像素網格，執行：

```bash
npm run assets:characters
```

Phaser 仍保留程式繪製的 deterministic fallback，只有在素材損壞或載入失敗時才會使用；正常 production path 會載入同目錄的 `char-*.svg`。
