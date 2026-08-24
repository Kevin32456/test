import type Phaser from "phaser";
import { DEFAULT_ROOM_CODE, GAME, normalizeRoomCode } from "@shared/constants";
import {
  ARENAS,
  DEFAULT_ARENA_ID,
  getArena,
  isValidArenaId,
  type ArenaId,
} from "@shared/arenas";
import type { GameSnapshot } from "@shared/types";
import { CHARACTERS } from "@shared/characters";
import {
  bindNetworkHandlers,
  configureServerUrl,
  joinRoom,
  latestSnapshot,
  playerId,
  sendAction,
  subscribeState,
} from "./network";
import "./fonts.css";
import "./style.css";
import { loadPixelFont } from "./loadPixelFont";
import { characterDataURL } from "./pixelArt";

let phaserGame: Phaser.Game | null = null;
let phaserLoadPromise: Promise<void> | null = null;
let selectedCharacterId = CHARACTERS[0]!.id;
let selectedArenaId: ArenaId = DEFAULT_ARENA_ID;
let hasJoined = false;
let isJoining = false;
let isInPractice = false;
let pendingRoomCode = DEFAULT_ROOM_CODE;
let activeRoomCode = DEFAULT_ROOM_CODE;

const overlay = document.createElement("div");
overlay.className = "overlay-panel";
overlay.innerHTML = `
  <div class="petals" aria-hidden="true">
    <span></span><span></span><span></span><span></span><span></span><span></span>
  </div>
  <div class="lobby-card lobby-card-wide">
    <header class="lobby-header">
      <span class="lobby-seal">犬</span>
      <div class="lobby-title">
        <h1>甩狗</h1>
        <p class="lobby-subtitle">SHUAI GOU</p>
      </div>
    </header>
    <p class="lobby-desc">選擇角色與房間後加入，每位角色僅限一人。角色是外觀與風格提示，不改變戰鬥數值。</p>
    <details id="guide-details" class="guide-panel" open>
      <summary>
        <span>第一次玩？先看這裡</span>
        <span class="guide-summary-note">一分鐘懂規則</span>
      </summary>
      <div class="guide-content">
        <ol class="guide-steps">
          <li><strong>先走位：</strong>右鍵點地移動，狗只會擊殺持球者。</li>
          <li><strong>球燙手：</strong>持球時右鍵點隊友傳球；球飛行落地後才會換手。</li>
          <li><strong>留一手：</strong>Space 使用 Blink，持球或無球都能逃生。</li>
          <li><strong>活到最後：</strong>被狗咬到會出局，最後存活者獲勝。</li>
        </ol>
        <p class="guide-tip">小訣竅：別等狗貼臉才傳球；先走位，再把球送到安全的隊友手上。</p>
      </div>
    </details>
    <div class="connection-settings">
      <div class="connection-field">
        <label class="field-label" for="connection-mode">連線模式</label>
        <select id="connection-mode">
          <option value="local">目前伺服器（本機／此頁面）</option>
          <option value="remote">遠端伺服器</option>
        </select>
      </div>
      <div id="remote-url-field" class="connection-field" hidden>
        <label class="field-label" for="server-url-input">遠端伺服器 URL</label>
        <input id="server-url-input" type="url" placeholder="https://你的-tunnel.trycloudflare.com" />
      </div>
    </div>
    <label class="field-label" for="arena-input">競技場</label>
    <select id="arena-input" aria-describedby="arena-description"></select>
    <p id="arena-description" class="arena-description"></p>
    <label class="field-label" for="room-input">房間碼</label>
    <input id="room-input" maxlength="12" autocapitalize="characters" spellcheck="false" value="MAIN" placeholder="4–12 碼英數字" />
    <label class="field-label" for="name-input">暱稱</label>
    <input id="name-input" maxlength="16" placeholder="輸入暱稱" value="玩家" />
    <p class="section-label"><span>選擇角色</span></p>
    <div id="character-grid" class="character-grid"></div>
    <ul id="player-list" class="player-list" aria-label="房間玩家"></ul>
    <p id="lobby-status" aria-live="polite">連線中…</p>
    <button id="join-btn" disabled>加入房間</button>
    <button id="start-btn" style="margin-top:8px;display:none" disabled>提前開始（至少 2 人）</button>
    <button id="practice-btn" class="secondary-button" style="margin-top:8px">進入練習房（單人）</button>
  </div>
`;
document.getElementById("app")!.appendChild(overlay);

const nameInput = overlay.querySelector("#name-input") as HTMLInputElement;
const connectionMode = overlay.querySelector("#connection-mode") as HTMLSelectElement;
const remoteUrlField = overlay.querySelector("#remote-url-field") as HTMLDivElement;
const serverUrlInput = overlay.querySelector("#server-url-input") as HTMLInputElement;
const arenaSelect = overlay.querySelector("#arena-input") as HTMLSelectElement;
const arenaDescription = overlay.querySelector("#arena-description") as HTMLParagraphElement;
const roomInput = overlay.querySelector("#room-input") as HTMLInputElement;
const characterGrid = overlay.querySelector("#character-grid") as HTMLDivElement;
const playerList = overlay.querySelector("#player-list") as HTMLUListElement;
const lobbyStatus = overlay.querySelector("#lobby-status") as HTMLParagraphElement;
const joinBtn = overlay.querySelector("#join-btn") as HTMLButtonElement;
const startBtn = overlay.querySelector("#start-btn") as HTMLButtonElement;
const practiceBtn = overlay.querySelector("#practice-btn") as HTMLButtonElement;
const guideDetails = overlay.querySelector("#guide-details") as HTMLDetailsElement;

function readStoredValue(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function storeValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 私密瀏覽或桌面環境拒絕儲存時，仍可正常遊玩。
  }
}

guideDetails.open = readStoredValue("shuai-gou.guide-state") !== "closed";
guideDetails.addEventListener("toggle", () => {
  storeValue("shuai-gou.guide-state", guideDetails.open ? "open" : "closed");
});

const savedConnectionMode = readStoredValue("shuai-gou.connection-mode");
if (savedConnectionMode === "remote") connectionMode.value = "remote";
serverUrlInput.value = readStoredValue("shuai-gou.server-url");
const savedRoomCode = normalizeRoomCode(readStoredValue("shuai-gou.room-code"));
roomInput.value = savedRoomCode ?? DEFAULT_ROOM_CODE;
activeRoomCode = roomInput.value;
const savedArenaId = readStoredValue("shuai-gou.arena-id");
if (isValidArenaId(savedArenaId)) selectedArenaId = savedArenaId;

function renderArenaChoice() {
  const arena = getArena(selectedArenaId);
  arenaSelect.value = arena.id;
  arenaDescription.textContent = `${arena.description} ${arena.routeHint}`;
}

function buildArenaSelect() {
  arenaSelect.replaceChildren();
  for (const arena of ARENAS) {
    const option = document.createElement("option");
    option.value = arena.id;
    option.textContent = arena.name;
    arenaSelect.append(option);
  }
  renderArenaChoice();
}

buildArenaSelect();

function updateConnectionFields() {
  const isRemote = connectionMode.value === "remote";
  remoteUrlField.hidden = !isRemote;
  serverUrlInput.disabled = !isRemote || hasJoined || isJoining;
  connectionMode.disabled = hasJoined || isJoining;
  arenaSelect.disabled = isJoining || (hasJoined && latestSnapshot?.phase !== "lobby");
  roomInput.disabled = hasJoined || isJoining;
}

function saveConnectionSettings(roomCode: string) {
  storeValue("shuai-gou.connection-mode", connectionMode.value);
  storeValue("shuai-gou.server-url", serverUrlInput.value.trim());
  storeValue("shuai-gou.room-code", roomCode);
  storeValue("shuai-gou.arena-id", selectedArenaId);
}

updateConnectionFields();

connectionMode.addEventListener("change", () => {
  updateConnectionFields();
  lobbyStatus.textContent =
    connectionMode.value === "remote"
      ? "請輸入遠端伺服器 URL，再按加入房間。"
      : "將使用目前頁面的伺服器。";
});

roomInput.addEventListener("input", () => {
  roomInput.value = roomInput.value
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 12);
});

arenaSelect.addEventListener("change", () => {
  selectedArenaId = isValidArenaId(arenaSelect.value)
    ? arenaSelect.value
    : DEFAULT_ARENA_ID;
  renderArenaChoice();
  storeValue("shuai-gou.arena-id", selectedArenaId);

  if (hasJoined && latestSnapshot?.phase === "lobby") {
    sendAction({ type: "selectArena", arenaId: selectedArenaId });
  }
});

function buildCharacterGrid() {
  characterGrid.innerHTML = CHARACTERS.map(
    (c) => `
    <button type="button" class="char-card" data-id="${c.id}" aria-label="${c.name}">
      <span class="char-check">✓</span>
      <img src="${characterDataURL(c.id)}" alt="${c.name}" />
      <span class="char-name">${c.name}</span>
      <span class="char-tagline">${c.tagline}</span>
      <span class="char-description">${c.description}</span>
      <span class="char-status"></span>
    </button>`,
  ).join("");
}

function getTakenMap(snapshot: GameSnapshot | null) {
  const map = new Map<string, string>();
  if (!snapshot) return map;
  for (const p of snapshot.players) {
    map.set(p.characterId, p.name);
  }
  return map;
}

function pickFirstAvailable(snapshot: GameSnapshot | null) {
  const me = snapshot?.players.find((p) => p.id === playerId);
  if (me) {
    selectedCharacterId = me.characterId;
    return;
  }
  const taken = getTakenMap(snapshot);
  if (!taken.has(selectedCharacterId)) return;
  for (const c of CHARACTERS) {
    if (!taken.has(c.id)) {
      selectedCharacterId = c.id;
      return;
    }
  }
}

function isCharacterSelectable(id: string, snapshot: GameSnapshot | null) {
  const taken = getTakenMap(snapshot);
  if (!taken.has(id)) return true;
  const me = snapshot?.players.find((p) => p.id === playerId);
  return me?.characterId === id;
}

function renderCharacterGrid(snapshot: GameSnapshot | null) {
  const taken = getTakenMap(snapshot);
  characterGrid.querySelectorAll<HTMLButtonElement>(".char-card").forEach((btn) => {
    const id = btn.dataset.id!;
    const owner = taken.get(id);
    const isMine = snapshot?.players.find((p) => p.id === playerId)?.characterId === id;
    const takenByOther = owner && !isMine;
    const selected = selectedCharacterId === id;

    btn.classList.toggle("selected", selected);
    btn.classList.toggle("taken", !!takenByOther);
    btn.disabled = !!takenByOther;

    const status = btn.querySelector(".char-status")!;
    if (takenByOther) {
      status.textContent = `${owner} 已選`;
    } else if (isMine) {
      status.textContent = "你的角色";
    } else {
      status.textContent = "可選";
    }
  });
}

function showOverlay() {
  overlay.style.display = "flex";
}

function hideOverlay() {
  overlay.style.display = "none";
}

function renderLobby(snapshot: GameSnapshot) {
  if (isValidArenaId(snapshot.arenaId)) {
    selectedArenaId = snapshot.arenaId;
    renderArenaChoice();
  }
  pickFirstAvailable(snapshot);
  renderCharacterGrid(snapshot);

  playerList.replaceChildren();
  for (const p of snapshot.players) {
    const char = CHARACTERS.find((c) => c.id === p.characterId);
    const item = document.createElement("li");
    const icon = document.createElement("img");
    icon.className = "player-char-icon";
    icon.src = characterDataURL(p.characterId, 3);
    icon.alt = "";
    item.append(
      icon,
      document.createTextNode(
        ` ${p.name} · ${char?.name ?? ""}${p.id === playerId ? "（你）" : ""}`,
      ),
    );
    playerList.append(item);
  }

  if (snapshot.phase === "lobby") {
    lobbyStatus.textContent = `房間 ${activeRoomCode} · ${getArena(selectedArenaId).name} · 等待玩家 ${snapshot.roomCount}/${GAME.MAX_PLAYERS} · 右鍵移動／傳球`;
    startBtn.style.display = hasJoined ? "block" : "none";
    startBtn.disabled = snapshot.roomCount < GAME.MIN_PLAYERS_TO_START;
    joinBtn.textContent = hasJoined ? "已加入房間" : "加入房間";
    joinBtn.disabled = hasJoined || !selectedCharacterId;
    practiceBtn.style.display = hasJoined ? "none" : "block";
    practiceBtn.disabled = hasJoined || isJoining;
  } else if (snapshot.phase === "countdown") {
    lobbyStatus.textContent = `${getArena(selectedArenaId).name} · 即將開始… ${Math.ceil(snapshot.countdownSec ?? 0)}`;
    startBtn.style.display = "none";
    practiceBtn.style.display = "none";
  } else if (snapshot.phase === "ended") {
    lobbyStatus.textContent = snapshot.winnerName
      ? `本局結果：${snapshot.winnerName} 獲勝！${Math.ceil(GAME.LOBBY_RESET_MS / 1000)} 秒後開始下一局…`
      : `本局結束；${Math.ceil(GAME.LOBBY_RESET_MS / 1000)} 秒後開始下一局…`;
    startBtn.style.display = "none";
    practiceBtn.style.display = "none";
  }
  updateConnectionFields();
}

function ensurePhaser(startGameScene = true): Promise<void> {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene("GameScene");
    if (startGameScene && (!scene || !scene.sys.isActive())) {
      phaserGame.scene.start("GameScene");
    }
    return Promise.resolve();
  }

  if (phaserLoadPromise) return phaserLoadPromise;

  phaserLoadPromise = loadPixelFont()
    .then(async () => {
      const [{ default: PhaserRuntime }, { GameScene }, { PracticeScene }] = await Promise.all([
        import("phaser"),
        import("./scenes/GameScene"),
        import("./scenes/PracticeScene"),
      ]);

      if (phaserGame) return;

      phaserGame = new PhaserRuntime.Game({
        type: PhaserRuntime.AUTO,
        parent: "app",
        width: GAME.ARENA_WIDTH,
        height: GAME.ARENA_HEIGHT,
        backgroundColor: "#171a26",
        pixelArt: true,
        scale: {
          mode: PhaserRuntime.Scale.FIT,
          autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
        },
        scene: [GameScene, PracticeScene],
      });
      phaserGame.events.on("practice-exit", handlePracticeExit);
    })
    .catch((error: unknown) => {
      phaserLoadPromise = null;
      console.error("Failed to load the game client", error);
    });
  return phaserLoadPromise;
}

function handlePhase(snapshot: GameSnapshot) {
  if (isInPractice) return;

  if (snapshot.phase === "lobby" || snapshot.phase === "ended") {
    showOverlay();
    renderLobby(snapshot);
    return;
  }

  if (snapshot.phase === "countdown" || snapshot.phase === "playing") {
    hideOverlay();
    void ensurePhaser(true);
  }
}

function handlePracticeExit() {
  isInPractice = false;
  phaserGame?.scene.stop("PracticeScene");
  showOverlay();
  practiceBtn.disabled = hasJoined || isJoining;
  lobbyStatus.textContent = "已離開練習房；準備好後可以加入多人房間。";
  renderCharacterGrid(latestSnapshot);
}

buildCharacterGrid();

void loadPixelFont().then(() => {
  renderCharacterGrid(latestSnapshot);
});

characterGrid.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".char-card");
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id!;
  selectedCharacterId = id;

  if (hasJoined) {
    sendAction({ type: "selectCharacter", characterId: id });
  } else {
    renderCharacterGrid(latestSnapshot);
  }
});

bindNetworkHandlers({
  onConnect: () => {
    if (isInPractice) return;
    lobbyStatus.textContent = isJoining
      ? `已連線，正在加入房間 ${pendingRoomCode}…`
      : "已連線，設定房間後加入。";
    joinBtn.disabled = hasJoined || !selectedCharacterId;
    renderCharacterGrid(latestSnapshot);
  },
  onDisconnect: () => {
    if (isInPractice) return;
    lobbyStatus.textContent = "連線中斷，請重新整理頁面。";
    hasJoined = false;
    isJoining = false;
    joinBtn.disabled = false;
    startBtn.style.display = "none";
    practiceBtn.style.display = "block";
    practiceBtn.disabled = false;
    showOverlay();
    updateConnectionFields();
  },
  onJoined: (payload) => {
    isJoining = false;
    hasJoined = true;
    activeRoomCode = pendingRoomCode;
    if (isValidArenaId(payload.snapshot.arenaId)) {
      selectedArenaId = payload.snapshot.arenaId;
    }
    saveConnectionSettings(activeRoomCode);
    updateConnectionFields();
    selectedCharacterId =
      payload.snapshot.players.find((p) => p.id === playerId)?.characterId ??
      selectedCharacterId;
    renderLobby(payload.snapshot);
    startBtn.style.display = "block";
    practiceBtn.style.display = "none";
    handlePhase(payload.snapshot);
  },
});

subscribeState((snapshot) => {
  handlePhase(snapshot);
});

joinBtn.addEventListener("click", () => {
  if (hasJoined || isJoining) return;

  const roomCode = normalizeRoomCode(roomInput.value);
  if (!roomCode) {
    lobbyStatus.textContent = "房間碼需為 4–12 碼英數字。";
    return;
  }

  const serverUrl = connectionMode.value === "remote" ? serverUrlInput.value : "";
  if (connectionMode.value === "remote" && !serverUrl.trim()) {
    lobbyStatus.textContent = "請輸入遠端伺服器 URL。";
    return;
  }
  const configured = configureServerUrl(serverUrl);
  if (!configured.ok) {
    lobbyStatus.textContent = "遠端伺服器 URL 無效，請確認以 http:// 或 https:// 開頭。";
    return;
  }

  pendingRoomCode = roomCode;
  roomInput.value = roomCode;
  isJoining = true;
  joinBtn.disabled = true;
  updateConnectionFields();
  lobbyStatus.textContent = `正在加入房間 ${roomCode}…`;
  joinRoom(
    nameInput.value.trim() || "玩家",
    selectedCharacterId,
    roomCode,
    selectedArenaId,
    (ok, reason) => {
      if (!ok) {
        isJoining = false;
        updateConnectionFields();
        lobbyStatus.textContent =
          reason === "room_full_or_character_taken"
            ? "房間已滿或角色已被選走，請換一個。"
            : reason === "invalid_room_code"
              ? "房間碼無效，請使用 4–12 碼英數字。"
              : reason === "already_joined"
                ? "你已經加入房間。"
                : "無法加入，請確認伺服器與房間碼後再試。";
        joinBtn.disabled = false;
        pickFirstAvailable(latestSnapshot);
        renderCharacterGrid(latestSnapshot);
      }
    },
  );
});

startBtn.addEventListener("click", () => {
  sendAction({ type: "start" });
});

practiceBtn.addEventListener("click", () => {
  if (hasJoined || isJoining || isInPractice) return;
  isInPractice = true;
  hideOverlay();
  void ensurePhaser(false).then(() => {
    if (!phaserGame) {
      isInPractice = false;
      showOverlay();
      lobbyStatus.textContent = "練習房載入失敗，請重新整理頁面。";
      return;
    }
    phaserGame.scene.stop("GameScene");
    phaserGame.scene.start("PracticeScene", { characterId: selectedCharacterId });
  });
});

export { latestSnapshot as getLatestSnapshot, playerId as getPlayerId };
export { sendAction } from "./network";
