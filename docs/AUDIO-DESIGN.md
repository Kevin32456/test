# 甩狗音效與音樂設計

## 目前實作

- `src/client/audio/Sfx.ts`：傳球、Blink、出局、勝利、倒數與地圖階段提示音。
- `src/client/audio/AudioEngine.ts`：共用 AudioContext、SFX／music bus、主音量與音效開關。
- 音樂是專案內自製的程序化像素旋律，不依賴外部音檔或第三方授權素材。
- 大廳與練習房使用較慢的安全旋律；多人回合依 `teach → test → twist → mastery` 逐步加快節奏與音域。
- 玩家可在大廳用「聲音：開／關」或「Sound: On／Off」切換，設定會保存在本機。
- 音訊只在玩家點擊加入、練習或音量按鈕後解鎖，避免瀏覽器／Electron autoplay 政策阻擋。

## 真人驗收

以下仍必須在非開發者與實體裝置上確認：

- SFX 與旋律是否互相遮蔽，尤其是傳球、Blink、出局與階段提示同時發生時。
- `mastery` 階段的節奏是否增加緊張感但沒有疲勞或刺耳感。
- 繁中／英文玩家是否能找到並理解聲音開關。
- 瀏覽器、Windows Electron、耳機與喇叭的音量是否都可接受。

若真人測試指出需要真正錄製的音樂，先保留 `AudioEngine` 的 bus／模式介面，再替換旋律來源，不要讓場景直接依賴音檔路徑。
