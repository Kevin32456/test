# 甩狗正式服務運維手冊

## 目前部署邊界

- Render `test-vccb.onrender.com` 是 staging；`render.yaml` 目前保留 Free plan，允許休眠與冷啟動延遲。
- 正式多人服務必須使用不會休眠的常駐 Web Service，並先維持 **單一 instance**。目前房間、玩家、Socket.IO 狀態都在單一 Node process 記憶體內；在沒有 Redis adapter／外部房間服務前，不可直接水平擴展多 instance。
- SteamPipe 只配送 Windows 遊戲檔案；即時多人伺服器仍由獨立的常駐服務提供，不會由 Steam 自動代管。

## 健康檢查與監控

服務提供：

- `GET /health`：供 Render／容器 liveness 檢查；正常回傳 200 JSON。
- `GET /ready`：回報 `ready`、版本、啟動時間、uptime、房間、玩家與連線數；收到 SIGTERM 後會回 503，讓平台停止送入新流量。
- `GET /metrics`：Prometheus text format 的 process、房間、連線、加入拒絕、斷線與 invalid action counters。
- stdout：每行一筆 JSON log，包含 `server_started`、`join_accepted`、`join_rejected`、`action_rejected`、`connection_closed`、`process_error` 與停止事件。

最低監控告警：

1. `/ready` 非 200 超過 2 次或 60 秒。
2. `shuai_gou_active_connections` 突然歸零，但仍有玩家流量。
3. `shuai_gou_joins_total{result="rejected"}` 在短時間異常升高。
4. `process_error` 出現任何 `uncaught_exception` 或持續增加的 `unhandled_rejection`。
5. `shuai_gou_rooms`／`shuai_gou_players` 在所有客戶離開後未回到 0。

部署後先記錄：`STAGING_URL=https://test-vccb.onrender.com npm run test:staging`、`npm run test:staging:stress` 與 `npm run test:staging:replay`。

## 發佈閘門

每次要把 `main` 部署到 staging 或 production，順序固定為：

1. `npm run typecheck`
2. `npm test`
3. `npm run test:content`
4. `npm run build`
5. 本機 production `/ready`、`npm run test:staging`、`npm run test:staging:stress`
6. `git push origin main`
7. Render Deploy latest commit
8. 確認公開 `/ready` 的 `startedAt`／版本已變更，再重跑公開 smoke、stress、replay

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
