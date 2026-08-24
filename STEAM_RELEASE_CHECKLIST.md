# 甩狗（Shuai Gou）Steam 發行前清單

截至 2026-08-22。本清單以目前架構為準：Windows Electron client + Render 上的 Socket.IO 遠端伺服器。

## 目前可交付物

- 版本：`0.4.0`
- Windows target：`x64 portable`
- 執行檔：`release/Shuai-Gou-0.4.0-x64.exe`
- SHA-256：`AE01E7A1AA10461B8324E01292B07C16E8100431D7A3F8ED58149124C1B13F6D`
- Electron App ID：`com.kevin32456.shuaigou`
- 本機 packaged smoke：通過；內嵌 server `/health` 回傳 200、`ready: true`、`phase: lobby`
- 遠端 staging：[`https://test-vccb.onrender.com`](https://test-vccb.onrender.com)

## Steamworks 必須完成

- [ ] 完成 Steamworks partner onboarding、稅務與收款資料。
- [ ] 為這個產品支付 Steam Direct Fee；Valve 文件目前列為每個新產品 100 美元或等值金額，且費用不是 Steam Wallet 支付。
- [ ] 取得正式 Steam App ID；在取得前不要建立或提交假的 `steam_appid.txt`、VDF 或 depot 設定。
- [ ] 確定產品模式：目前遊戲的即時多人伺服器仍由 Render 提供，SteamPipe 只負責遊戲檔案配送；Steam lobby、邀請、Steam Networking、成就與 Steam Cloud 尚未接入。
- [ ] 在 Steamworks 建立 Windows 安裝設定、至少一個 Windows depot 與啟動選項。
- [ ] 使用 SteamPipe 上傳到 private beta branch，完成 Steam client 安裝、啟動、更新與回滾測試，再考慮 Default branch。
- [ ] 以獨立的 Steam build account 上傳；登入資料、token 與任何憑證不得進 Git。

參考：

- [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee?language=english)
- [Uploading to Steam / SteamPipe](https://partner.steamgames.com/doc/sdk/uploading?language=english)
- [Builds](https://partner.steamgames.com/doc/store/application/builds?l=english&language=english)

## Windows 發行品質缺口

- [ ] 決定 Steam 安裝形式。目前是 portable executable；Steam 可啟動它，但正式發行前仍要驗證安裝目錄、更新與卸載體驗。
- [ ] 配置正式遊戲圖示與 Windows metadata；目前使用 Electron 預設圖示。
- [ ] 使用正式 code-signing certificate 簽署執行檔，並加入 timestamp；目前 artifact 沒有可驗證的簽署者。
- [ ] 在乾淨 Windows 環境測試首次啟動、Windows Defender／SmartScreen、無網路、Render 不可用、更新後啟動與解除安裝。
- [ ] 決定正式伺服器方案：Render free instance 可能休眠，且不等同高可用多人服務。

## 商店頁與送審素材

- [ ] 遊戲名稱、短描述、完整描述與繁／英文 localization。
- [ ] Capsule、library assets、截圖與 trailer；素材需符合 Steamworks Store Presence checklist。
- [ ] 系統需求、輸入方式、控制器支援、網路需求、支援語言與隱私政策連結。
- [ ] 測試版／Coming Soon／正式發售日期與價格策略。
- [ ] 以可安裝的 Steam private branch build 通過基本 release QA，再按 Steam review 流程送審。

參考：[Store Page, Building and Editing](https://partner.steamgames.com/doc/store/page)、[Review Process](https://partner.steamgames.com/doc/store/Review_Process)

## 下一個最安全的執行順序

1. 使用者完成 Steamworks onboarding 並取得 App ID。
2. 補正式 icon、簽章與安裝形式決策。
3. 以真實 App ID 產生 SteamPipe app/depot 設定，先上傳 private beta branch。
4. 在乾淨 Windows 與至少兩種不同網路完成安裝、啟動、多人連線與更新測試。
5. 完成商店素材與 Valve review checklist；不要在 review 前把未驗證的 build 設為公開 Default branch。

目前不執行：代付費用、建立 Steam App、上傳 SteamPipe build、簽署執行檔或公開發售；這些都需要使用者的帳號、金鑰或商業決策。
