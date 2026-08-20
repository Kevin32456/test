# 甩狗（Shuai Gou）

《魔獸爭霸 III》自製地圖「甩狗」的網頁版還原：4 人連線、鬼抓人 + 熱土豆。

## 規則摘要

- 狗追**持球者**；持球越久狗越快，轉彎有甩尾飄移
- 右鍵點地移動；持球時右鍵點活人傳球
- 持球者不能 Blink；無球者可 Blink（有 CD）
- 被狗碰到（持球時）出局；最後存活者獲勝

## 開發

```bash
npm install
npm run dev
```

瀏覽器開啟終端顯示的網址（預設 `http://localhost:4317`）。開 4 個分頁或 4 台裝置連同一伺服器即可測 4 人局。

## Git 分支

見 [docs/BRANCHING.md](docs/BRANCHING.md)。**每次功能修改請開新分支**，確認後再合併 `main`。

## 文件

- [docs/GDD-v1.md](docs/GDD-v1.md) — 完整設計
- [CODEX_HANDOFF.md](CODEX_HANDOFF.md) — 專案交接
