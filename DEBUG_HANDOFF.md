# DEBUG_HANDOFF

已結案的物理問題留作紀錄；目前沒有卡住的重複缺陷迴圈。

## 已結案：單人練習房初始空白／重複貼圖（2026-09-04）

**現象：** 公開 staging 從大廳進入單人練習房時，畫面可能停在空白 Phaser 畫布；console 出現多筆 `Texture key already in use: char-*`。

**根因：** `GameScene` 與 `PracticeScene` 同時在 Phaser 啟動時對全域 Texture Manager preload／建立相同的角色 key；練習按鈕又可能在初始 scene 的資源載入完成前切換 scene。

**作法：** 新增 `AssetScene` 作為唯一共享資源入口；`GameScene`／`PracticeScene` 不再自行 preload 或建立 fallback texture，`ensurePhaser()` 等待 GameScene ready marker／事件後才允許切換到 `PracticeScene`。新增 Electron smoke gate，實際進入 practice scene 並拒絕瀏覽器 warning／error。

**驗證：** `npm run typecheck`、`npm test`、`npm run test:content`、`npm run build` 與 `npm run test:layout` 均通過；公開 `e3219626c16779f75292f8e935cb229aea29d495` 以全新瀏覽器分頁完成 `練習 1/3 → 2/3 → 3/3 → 練習完成`，畫布正常渲染且該分頁無 warning／error。

## 已結案：朝向與速度耦合

**現象：** 掠過後狗衝很遠，狗頭永遠朝速度方向。

**根因：** `updateDogToward` 把 `dog.angle` 綁在速度向量上。

**作法：** 視覺朝向與速度分離；夾角 >90° 用 `DOG_REVERSE_GRIP` 反向牽引。不要再只靠同一組 TURN／GRIP／FRICTION 全域交換甩尾與黏球。

**現況：** 牽引 5.5；一般繞圈參數獨立。

## 已結案：高速甩尾無敵（2026-08-21）

**現象：** 玩家持續切角讓狗甩尾，即使狗速無上限也咬不到。

**根因：** 近身轉向速率幾乎不隨速度增加，轉彎半徑 ≈ 速度 ÷ 轉向，狗越快圈越大。

**作法：** `DOG_SPEED_AGILITY_GAIN` 0.9，狗速超過玩家 300 後放大轉向與折返。不准再把整隻狗改成高摩擦直線衝刺來修這個問題。

**待 playtest：** 是否仍可無限繞；過黏則降 gain，仍無敵則升到 1.1–1.3 或加連續掠過懲罰。

## 已結案：關瀏覽器再進場出現分身

**現象：** 舊角色留在原地不動，新角色才跟操作。

**根因：** 客戶端用 socket id 建精靈，離場不清圖。伺服器名單是對的。

**作法：** 快照比對後 `removePlayerVisuals`。

## 設計限制（不是 bug）

接到球不能立刻再傳：必須等球落地（`inFlight`）。畫面插值可能先看起來貼身，HUD 仍顯示飛行中。優化方向是事件即時廣播（已做）或飛行中預傳（未做），不是加接球硬直。

## 已結案：malformed 網路 payload 使 server 結束（2026-08-21）

**現象：** 非字串暱稱會在 `name.slice()` 拋出例外；`action = null` 也可能在讀取 `action.type` 時中斷事件處理。

**根因：** Socket.IO payload 只有 TypeScript compile-time 型別，沒有 runtime trust-boundary 驗證。

**作法：** 新增 `server/validation.ts`，在 join/action 邊界拒絕 malformed payload，`GameRoom` 再做防禦性檢查。

**驗證：** malformed join 回傳 `invalid_payload`；malformed action 後 `/health` 仍為 200。

## 已結案：倒數期間玩家離場（2026-08-21）

**現象：** 兩人開始倒數時其中一人離場，剩餘一人仍會進入對局，下一幀才因只剩一人結束。

**根因：** `removePlayer()` 只處理空房與 `playing`，沒有在 `countdown` 檢查最低開局人數。

**作法：** 倒數中人數低於 `MIN_PLAYERS_TO_START` 時重置大廳、停止 tick 並立即廣播。

**驗證：** focused test 確認倒數立即回到 `lobby`，不會啟動一人對局。
