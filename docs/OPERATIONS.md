# 甩狗正式服務運維手冊

## 目前部署邊界

- Render `test-vccb.onrender.com` 是 staging；`render.yaml` 目前保留 Free plan，允許休眠與冷啟動延遲。
- 正式多人服務必須使用不會休眠的常駐 Web Service，並先維持 **單一 instance**。目前房間、玩家、Socket.IO 狀態都在單一 Node process 記憶體內；在沒有 Redis adapter／外部房間服務前，不可直接水平擴展多 instance。
- SteamPipe 只配送 Windows 遊戲檔案；即時多人伺服器仍由獨立的常駐服務提供，不會由 Steam 自動代管。

## v1 正式方案決策

- 正式環境使用與 staging 分離的 Render Web Service，選擇不休眠的付費方案；`render.yaml` 的 Free 設定只代表 staging，不可直接當正式多人服務。
- v1 固定單一 instance，讓同一個 Node process 持有所有房間與 Socket.IO 狀態；先以穩定性與可回滾為優先，不在沒有 Redis／房間狀態同步前擴成多 instance。
- 正式服務建立獨立 URL 與環境變數；Windows／Steam 客戶端只連正式 URL，staging URL 僅供測試。正式 URL 尚未建立前，不把 staging 當作 Steam 發行端點。
- 上線前需在正式 URL 完成同一組 typecheck、內容、smoke、8 人與 replay gate；Free staging 的冷啟動結果不作為正式 SLA。

## 健康檢查與監控

服務提供：

- `GET /health`：供 Render／容器 liveness 檢查；正常回傳 200 JSON。
- `GET /ready`：回報 `ready`、版本、啟動時間、uptime、房間、玩家與連線數；收到 SIGTERM 後會回 503，讓平台停止送入新流量。
- `GET /metrics`：Prometheus text format 的 process、房間、連線、加入拒絕、斷線與 invalid action counters。
- stdout：每行一筆 JSON log，包含 `server_started`、`join_accepted`、`join_rejected`、`action_rejected`、`connection_closed`、`process_error` 與停止事件。
- `npm run ops:check`：一次檢查 `/health`、`/ready` 與 `/metrics`；GitHub Actions 的 `Service health gate` 可手動帶入正式 URL 重跑同一檢查。

最低監控告警：

1. `/ready` 非 200 超過 2 次或 60 秒。
2. `shuai_gou_active_connections` 突然歸零，但仍有玩家流量。
3. `shuai_gou_joins_total{result="rejected"}` 在短時間異常升高。
4. `process_error` 出現任何 `uncaught_exception` 或持續增加的 `unhandled_rejection`。
5. `shuai_gou_rooms`／`shuai_gou_players` 在所有客戶離開後未回到 0。

正式環境設定最低外部監控：

- HTTP monitor 每 30–60 秒檢查 `/ready`，連續兩次非 200 或 `ready:false` 即告警。
- 以平台 log drain 或集中式 log viewer 保留 stdout JSON；搜尋 `process_error`、`join_rejected`、`action_rejected`、`connection_closed`。
- 以 Prometheus-compatible collector 抓取 `/metrics`；至少保存 active connections、rooms、players、joins、disconnects 與 invalid actions 的時間序列。
- 告警目的地、log drain 與正式 URL 需在 Render／監控服務帳號中配置；本 repo 只提供可被監控的 endpoint 與結構化訊號，不假裝已替使用者建立外部帳號。

部署後先記錄：`SERVICE_URL=https://test-vccb.onrender.com npm run ops:check`，再執行 `npm run test:staging`、`npm run test:staging:stress`、`npm run test:staging:stages`、`npm run test:staging:network` 與 `npm run test:staging:replay`。

## 發佈閘門

每次要把 `main` 部署到 staging 或 production，順序固定為：

1. `npm run typecheck`
2. `npm test`
3. `npm run test:content`
4. `npm run build`、`npm run test:layout`
5. 本機 production `/ready`、`npm run test:staging`、`npm run test:staging:stages`、`npm run test:staging:network`、`npm run test:staging:stress`
6. `git push origin main`
7. Render Deploy latest commit
8. 確認公開 `/ready` 的 `startedAt`／版本已變更，再重跑公開 smoke、stages、network、stress、replay

不要只看 Render deploy 顯示成功；若公開 bundle 沒有最新功能字串或 `/ready` 啟動時間未更新，視為尚未部署。

## 回滾

### Render dashboard

1. 開啟服務的 **Deploys**。
2. 找到上一個已通過 smoke 的 deploy，使用 Render 提供的 rollback／redeploy previous deploy 操作。
3. 等待 `/ready` 回到 200，再執行 `npm run test:staging`。
4. 將回滾原因、deploy ID、`/ready` JSON 與測試結果記入交接文件。

### Git 回退提交

若 dashboard 沒有可用的上一版 deploy，先找最後一個已驗證 commit，再用 `git revert <bad-commit>` 建立反向提交並 `git push origin main`。

不要使用 `git reset --hard` 改寫共享的 `main`。修正版本通過本機 gate 後，再重新部署。

## 事故處理

- Render Free 冷啟動：先確認是否只是休眠；若正式服務仍使用 Free，升級為常駐方案，不用程式碼 workaround 掩蓋延遲。
- 服務重啟：房間記憶體會消失，玩家需重新加入；這是目前單 process 架構的已知限制。
- `/ready` 正常但多人無法加入：先看 JSON log 的 `join_rejected`／`connection_closed`，再比對公開 bundle 與 commit。
- 多 instance：在接入 Redis adapter、房間狀態儲存與跨 instance sticky／訊息同步前，維持單 instance；否則同房玩家可能分散到不同記憶體房間。
