import type { ArenaStage } from "@shared/arenas";
import type { CharacterId } from "@shared/characters";

export type Locale = "zh-Hant" | "en";

type TranslationKey =
  | "lobbyDesc"
  | "guideTitle"
  | "guideNote"
  | "guideMove"
  | "guidePass"
  | "guideBlink"
  | "guideSurvive"
  | "guideTip"
  | "connectionMode"
  | "localServer"
  | "remoteServer"
  | "remoteUrl"
  | "audioOn"
  | "audioOff"
  | "arenaLabel"
  | "roomLabel"
  | "roomPlaceholder"
  | "nameLabel"
  | "namePlaceholder"
  | "charactersLabel"
  | "playersAria"
  | "join"
  | "joined"
  | "start"
  | "practice"
  | "connectedJoining"
  | "connectedSet"
  | "disconnected"
  | "remotePrompt"
  | "localPrompt"
  | "roomStatus"
  | "countdownStatus"
  | "endedStatus"
  | "endedDrawStatus"
  | "yourRole"
  | "available"
  | "practiceExit"
  | "practiceLoadFail"
  | "invalidRoom"
  | "remoteRequired"
  | "remoteInvalid"
  | "joinFailed"
  | "roomFull"
  | "alreadyJoined"
  | "resultKicker"
  | "resultWinner"
  | "resultDraw"
  | "resultSurvived"
  | "resultEliminated"
  | "resultReason"
  | "resultNext"
  | "replayWaiting"
  | "replay"
  | "arenaNoCollision"
  | "passHint"
  | "playerFallback"
  | "hudAlive"
  | "hudHold"
  | "hudDeathPause"
  | "hudBallFlight"
  | "hudYouHaveBall"
  | "hudBlink"
  | "hudSpectating"
  | "hudControls"
  | "countdownObjective"
  | "countdownStart"
  | "deathPause"
  | "stageArena"
  | "practiceHud"
  | "practicePartnerBall"
  | "practiceYouBall"
  | "practiceEsc"
  | "practiceComplete"
  | "practiceReplay"
  | "practiceLobby"
  | "practiceMoveTitle"
  | "practiceBlinkTitle"
  | "practicePassTitle"
  | "practiceCompleteTitle"
  | "practiceMoveHint"
  | "practiceBlinkHint"
  | "practicePassHint"
  | "practiceCompleteHint"
  | "practiceMoveProgress"
  | "practiceBlinkProgress"
  | "practiceMoveStarted"
  | "practiceBlinkSuccess"
  | "practicePassTip"
  | "practicePassFlight";

const translations: Record<Locale, Record<TranslationKey, string>> = {
  "zh-Hant": {
    lobbyDesc: "選擇角色與房間後加入，每位角色僅限一人。角色是外觀與風格提示，不改變戰鬥數值。",
    guideTitle: "第一次玩？先看這裡",
    guideNote: "一分鐘懂規則",
    guideMove: "先走位：右鍵點地移動，狗只會擊殺持球者。",
    guidePass: "球燙手：持球時右鍵點隊友傳球；球飛行落地後才會換手。",
    guideBlink: "留一手：Space 使用 Blink，持球或無球都能逃生。",
    guideSurvive: "活到最後：被狗咬到會出局，最後存活者獲勝。",
    guideTip: "小訣竅：別等狗貼臉才傳球；先走位，再把球送到安全的隊友手上。",
    connectionMode: "連線模式",
    localServer: "目前伺服器（本機／此頁面）",
    remoteServer: "遠端伺服器",
    remoteUrl: "遠端伺服器 URL",
    audioOn: "聲音：開",
    audioOff: "聲音：關",
    arenaLabel: "競技場",
    roomLabel: "房間碼",
    roomPlaceholder: "4–12 碼英數字",
    nameLabel: "暱稱",
    namePlaceholder: "輸入暱稱",
    charactersLabel: "選擇角色",
    playersAria: "房間玩家",
    join: "加入房間",
    joined: "已加入房間",
    start: "提前開始（至少 2 人）",
    practice: "進入練習房（單人）",
    connectedJoining: "已連線，正在加入房間 {room}…",
    connectedSet: "已連線，設定房間後加入。",
    disconnected: "連線中斷，請重新整理頁面。",
    remotePrompt: "請輸入遠端伺服器 URL，再按加入房間。",
    localPrompt: "將使用目前頁面的伺服器。",
    roomStatus: "房間 {room} · {arena} · 等待玩家 {count}/{max} · 右鍵移動／傳球",
    countdownStatus: "{arena} · 即將開始… {countdown}",
    endedStatus: "本局結果：{winner} 獲勝！下一局準備中…",
    endedDrawStatus: "本局結束；下一局準備中…",
    yourRole: "你的角色",
    available: "可選",
    practiceExit: "已離開練習房；準備好後可以加入多人房間。",
    practiceLoadFail: "練習房載入失敗，請重新整理頁面。",
    invalidRoom: "房間碼需為 4–12 碼英數字。",
    remoteRequired: "請輸入遠端伺服器 URL。",
    remoteInvalid: "遠端伺服器 URL 無效，請確認以 http:// 或 https:// 開頭。",
    joinFailed: "無法加入，請確認伺服器與房間碼後再試。",
    roomFull: "房間已滿或角色已被選走，請換一個。",
    alreadyJoined: "你已經加入房間。",
    resultKicker: "本局結束",
    resultWinner: "{winner} 獲勝！",
    resultDraw: "平局",
    resultSurvived: "你是最後存活者。",
    resultEliminated: "你已出局。",
    resultReason: "出局原因：被狗咬中持球者。",
    resultNext: "下一步：先傳球再走位，把 Blink 留給狗轉向的瞬間。",
    replayWaiting: "下一局準備中…",
    replay: "再玩一局",
    arenaNoCollision: "目前沒有障礙物碰撞",
    passHint: "可傳球",
    playerFallback: "玩家",
    hudAlive: "存活 {alive}/{total}",
    hudHold: "持球 {hold}s · 狗壓 {pressure}%",
    hudDeathPause: "死亡停頓 — 全場暫停",
    hudBallFlight: "球飛行中 — 狗仍追球",
    hudYouHaveBall: "你持球：右鍵點人傳球 · Blink CD {cd}s",
    hudBlink: "Blink <Space> · CD {cd}s",
    hudSpectating: "觀戰中",
    hudControls: "右鍵移動／傳球 · Space Blink",
    countdownObjective: "目標：活到最後\n右鍵走位／持球點隊友傳球\nSpace：Blink",
    countdownStart: "開始！",
    deathPause: "{player} 出局！\n{seconds} 秒後重新傳球",
    stageArena: "{arena} · {title}\n{prompt}",
    practiceHud: "練習房｜不會出局",
    practicePartnerBall: "搭檔持球",
    practiceYouBall: "你持球",
    practiceEsc: "Esc 回大廳",
    practiceComplete: "練習完成！\n你已經會走位、Blink 與傳球。",
    practiceReplay: "重新練習",
    practiceLobby: "回到大廳",
    practiceMoveTitle: "練習 1 / 3",
    practiceBlinkTitle: "練習 2 / 3",
    practicePassTitle: "練習 3 / 3",
    practiceCompleteTitle: "練習完成！",
    practiceMoveHint: "右鍵點地，讓角色走一小段",
    practiceBlinkHint: "把滑鼠指向想去的方向，按 Space Blink",
    practicePassHint: "持球時右鍵點擊上方的練習搭檔",
    practiceCompleteHint: "你已經會走位、Blink 與傳球。",
    practiceMoveProgress: "右鍵點地移動；先走位，再做下一個動作。\n",
    practiceBlinkProgress: "Space 會向滑鼠方向瞬移 160px；持球與無球都能用。\n",
    practicePassTip: "球很燙！右鍵點上方搭檔，把球傳出去。\n",
    practicePassFlight: "傳球中…等球落地，這才算完成接球。\n",
    practiceMoveStarted: "走位中…讓角色移動一小段，狗會跟著球靠近。\n練習房不會出局。\n",
    practiceBlinkSuccess: "Blink 成功！冷卻 {seconds} 秒；練習中仍可繼續走位。",
  },
  en: {
    lobbyDesc: "Choose a character and room. Each character can be picked once; roles are visual styles and do not change combat stats.",
    guideTitle: "New here? Start here",
    guideNote: "Rules in one minute",
    guideMove: "Move first: right-click the arena. The dog can only eliminate the ball holder.",
    guidePass: "Hot potato: right-click a teammate while holding the ball. It changes hands after flight.",
    guideBlink: "Keep one escape: press Space to Blink, with or without the ball.",
    guideSurvive: "Survive: the dog eliminates its target; the last player alive wins.",
    guideTip: "Tip: pass before the dog reaches you. Move first, then send the ball to a safe teammate.",
    connectionMode: "Connection",
    localServer: "Current server (this page)",
    remoteServer: "Remote server",
    remoteUrl: "Remote server URL",
    audioOn: "Sound: On",
    audioOff: "Sound: Off",
    arenaLabel: "Arena",
    roomLabel: "Room code",
    roomPlaceholder: "4–12 letters or numbers",
    nameLabel: "Name",
    namePlaceholder: "Enter a name",
    charactersLabel: "Choose a character",
    playersAria: "Players in room",
    join: "Join room",
    joined: "Joined room",
    start: "Start early (2+ players)",
    practice: "Practice room (solo)",
    connectedJoining: "Connected; joining room {room}…",
    connectedSet: "Connected. Set a room, then join.",
    disconnected: "Connection lost. Refresh the page to try again.",
    remotePrompt: "Enter a remote server URL, then join the room.",
    localPrompt: "Using the server on this page.",
    roomStatus: "Room {room} · {arena} · Waiting {count}/{max} · Right-click to move/pass",
    countdownStatus: "{arena} · Starting… {countdown}",
    endedStatus: "Result: {winner} wins! Next round is preparing…",
    endedDrawStatus: "Round over; next round is preparing…",
    yourRole: "You",
    available: "Available",
    practiceExit: "Practice room closed; join a multiplayer room when ready.",
    practiceLoadFail: "Practice room failed to load. Refresh the page and try again.",
    invalidRoom: "Room code must be 4–12 letters or numbers.",
    remoteRequired: "Enter a remote server URL.",
    remoteInvalid: "Invalid remote server URL. It must start with http:// or https://.",
    joinFailed: "Could not join. Check the server and room code, then try again.",
    roomFull: "The room is full or that character is taken. Choose another.",
    alreadyJoined: "You already joined this room.",
    resultKicker: "Round over",
    resultWinner: "{winner} wins!",
    resultDraw: "Draw",
    resultSurvived: "You were the last player alive.",
    resultEliminated: "You were eliminated.",
    resultReason: "Elimination reason: the dog caught the ball holder.",
    resultNext: "Next: pass before turning, and save Blink for the dog's turn.",
    replayWaiting: "Preparing the next round…",
    replay: "Play again",
    arenaNoCollision: "No obstacle collision yet",
    passHint: "Pass",
    playerFallback: "Player",
    hudAlive: "Alive {alive}/{total}",
    hudHold: "Ball {hold}s · Dog pressure {pressure}%",
    hudDeathPause: "Elimination pause — everyone frozen",
    hudBallFlight: "Ball in flight — dog is still chasing",
    hudYouHaveBall: "You have the ball: right-click a player · Blink CD {cd}s",
    hudBlink: "Blink <Space> · CD {cd}s",
    hudSpectating: "Spectating",
    hudControls: "Right-click move/pass · Space Blink",
    countdownObjective: "Goal: survive to the end\nRight-click to move/pass\nSpace: Blink",
    countdownStart: "Go!",
    deathPause: "{player} eliminated!\nPassing again in {seconds}s",
    stageArena: "{arena} · {title}\n{prompt}",
    practiceHud: "Practice room | no elimination",
    practicePartnerBall: "Partner has the ball",
    practiceYouBall: "You have the ball",
    practiceEsc: "Esc: lobby",
    practiceComplete: "Practice complete!\nYou can move, Blink, and pass.",
    practiceReplay: "Practice again",
    practiceLobby: "Back to lobby",
    practiceMoveTitle: "Practice 1 / 3",
    practiceBlinkTitle: "Practice 2 / 3",
    practicePassTitle: "Practice 3 / 3",
    practiceCompleteTitle: "Practice complete!",
    practiceMoveHint: "Right-click the arena to move a short distance",
    practiceBlinkHint: "Point the mouse where you want to go, then press Space",
    practicePassHint: "While holding the ball, right-click the practice partner above",
    practiceCompleteHint: "You can move, Blink, and pass.",
    practiceMoveProgress: "Right-click to move; learn positioning before the next action.\n",
    practiceBlinkProgress: "Space Blinks 160px toward the mouse; it works with or without the ball.\n",
    practicePassTip: "The ball is hot! Right-click the partner above to pass.\n",
    practicePassFlight: "Passing… wait for the ball to land; then the catch is complete.\n",
    practiceMoveStarted: "Moving… let the character travel a short distance; the dog follows the ball.\nYou cannot be eliminated here.\n",
    practiceBlinkSuccess: "Blink success! Cooldown {seconds}s; you can keep moving in practice.",
  },
};

const characterTranslations: Record<Locale, Record<CharacterId, [string, string, string]>> = {
  "zh-Hant": {
    hat: ["紳士", "冷靜周旋", "讀狗的路線，讓每次轉身都有餘裕。"],
    gauntlet: ["拳手", "正面挑釁", "在危險邊緣帶狗繞圈，再把球甩出去。"],
    spike: ["少年", "高速誘餌", "用短線走位拉開空間，替隊友製造接球角度。"],
    coat: ["旅人", "穩健走位", "先活下來，再把球傳到下一個安全位置。"],
    ninja: ["忍者", "瞬間脫身", "把 Blink 留給最後一刻，從狗的路線中消失。"],
    miko: ["巫女", "安全傳球", "先看隊友位置，再把燙手的球送到遠處。"],
    mechanic: ["機工師", "節奏控球", "控制持球時間，在狗加速前做出決定。"],
    captain: ["船長", "帶隊決策", "讓整隊保持可接球的距離，掌握傳球節奏。"],
  },
  en: {
    hat: ["Gentleman", "Calm orbit", "Read the dog’s line and leave room for every turn."],
    gauntlet: ["Brawler", "Front-foot bait", "Draw the dog wide, then send the ball away."],
    spike: ["Rookie", "Fast decoy", "Use short routes to open a clean receiving angle."],
    coat: ["Wanderer", "Steady routes", "Stay alive first, then pass to the safest position."],
    ninja: ["Ninja", "Instant escape", "Save Blink for the last moment and vanish from the line."],
    miko: ["Miko", "Safe passing", "Read the team before sending the hot ball away."],
    mechanic: ["Mechanic", "Tempo control", "Choose before the dog accelerates."],
    captain: ["Captain", "Team calls", "Keep the team in passing range and set the tempo."],
  },
};

const arenaTranslations: Record<Locale, Record<string, [string, string, string]>> = {
  "zh-Hant": {
    "vermilion-court": ["朱印圓場", "開闊的標準場，適合先熟悉狗的甩尾與傳球節奏。", "三層內圈是視覺路標；目前沒有障礙物碰撞。"],
    "moon-garden": ["月影庭", "冷色月庭用四個路標拉出外圈與斜切路線，讓走位更容易讀。", "四個月燈只是視覺路標；目前沒有障礙物碰撞。"],
  },
  en: {
    "vermilion-court": ["Vermilion Court", "An open standard arena for learning the dog’s drift and passing rhythm.", "Three inner rings are visual landmarks; no obstacle collision yet."],
    "moon-garden": ["Moon Garden", "A cool moonlit arena with four landmarks and diagonal routes for clearer positioning.", "The four moon lamps are visual landmarks; no obstacle collision yet."],
  },
};

const stageTranslations: Record<Locale, Record<ArenaStage, [string, string]>> = {
  "zh-Hant": {
    teach: ["教學 · 先看一條路", "沿著亮起的月燈走位；規則不變，先熟悉方向。"],
    test: ["測試 · 拉開距離", "四個月燈都能通過，保持隊友在可傳球距離。"],
    twist: ["轉折 · 斜線換位", "狗仍只追持球者；斜切路線改變你的傳球角度。"],
    mastery: ["熟練 · 掌握全場", "讀狗、讀隊友，把 Blink 留到真正危險的時刻。"],
  },
  en: {
    teach: ["Teach · Read one route", "Follow the lit moon lamps; learn the direction before the pressure rises."],
    test: ["Test · Make space", "All four lamps are open; keep teammates within passing range."],
    twist: ["Twist · Cross the line", "The dog still chases the ball holder; diagonal routes change your passing angle."],
    mastery: ["Mastery · Own the arena", "Read the dog and team; save Blink for the real danger."],
  },
};

let currentLocale: Locale = "zh-Hant";
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  if (locale === currentLocale) return;
  currentLocale = locale;
  for (const listener of listeners) listener(currentLocale);
}

export function subscribeLocale(listener: (locale: Locale) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}) {
  let result = translations[currentLocale][key];
  for (const [name, value] of Object.entries(values)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}

export function characterText(id: CharacterId | string, field: 0 | 1 | 2) {
  return characterTranslations[currentLocale][id as CharacterId]?.[field] ?? id;
}

export function arenaText(id: string, field: 0 | 1 | 2) {
  return arenaTranslations[currentLocale][id]?.[field] ?? id;
}

export function stageText(stage: ArenaStage, field: 0 | 1) {
  return stageTranslations[currentLocale][stage][field];
}

export function localeLabel(locale: Locale) {
  return locale === "en" ? "English" : "繁中";
}
