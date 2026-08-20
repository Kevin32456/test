# Git 分支工作流程

本專案採 **main 保護穩定、功能分支開發** 的策略，避免一次改太多導致難以回退。

## 分支結構

| 分支 | 用途 |
|------|------|
| `main` | 可運行、已驗證的穩定版本 |
| `cursor/<描述>-a9d0` | 單一功能或單次修改（Cloud Agent 命名規範） |

## 每次修改的標準流程

```bash
# 1. 從最新 main 開分支
git checkout main
git pull origin main
git checkout -b cursor/<這次要做的事>-a9d0

# 2. 開發、自測

# 3. 提交（一個邏輯變更一個 commit）
git add -A
git commit -m "簡短說明這次改了什麼"

# 4. 推送分支
git push -u origin cursor/<這次要做的事>-a9d0

# 5. 確認沒問題後合併回 main
git checkout main
git merge cursor/<這次要做的事>-a9d0
git push origin main
```

## 命名範例

- `cursor/design-docs-baseline-a9d0` — 設計文件與版控基線
- `cursor/web-prototype-4p-a9d0` — 網頁 4 人連線原型
- `cursor/dog-tail-physics-a9d0` — 只調狗甩尾物理

## 原則

1. **一個分支只做一件事** — 方便 code review 與 `git revert`
2. **main 隨時能跑** — 合併前在分支上跑過 dev server / 基本測試
3. **改壞了可 abandon** — 直接刪分支，main 不受影響
4. **大改必開新分支** — 不要在一個已經很亂的分支上繼續堆

## 回退

```bash
# 放棄目前分支所有未提交修改
git checkout -- .
git clean -fd

# 回到 main 上一個穩定 commit
git checkout main
git log --oneline   # 找到好的 commit
git reset --hard <commit-sha>   # 僅在確定要丟棄後續提交時使用
```

## 目前分支紀錄

| 分支 | 狀態 | 說明 |
|------|------|------|
| `main` | **v0.4.0** | 像素 UI + 部署設定 |
| `cursor/ui-polish-a9d0` | 已合併 | Fusion Pixel 字體與大廳像素 UI |
| `cursor/design-docs-baseline-a9d0` | 已合併 | GDD、交接文件、分支規範 |
| `cursor/web-prototype-4p-a9d0` | 已合併 | 網頁 4 人連線原型 |
| `cursor/fix-round2-and-ball-anim-a9d0` | 已合併 | 第二局 + 球路動畫 |
| `cursor/tune-dog-speed-a9d0` | 已合併 | 狗速平衡 |
| `cursor/dog-slower-front-chase-a9d0` | 已合併 | 狗更慢 + 追正面 |
| `cursor/dog-chase-ball-in-flight-a9d0` | 已合併 | 傳球中狗追球 |
