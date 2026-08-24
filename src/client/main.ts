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
import {
  arenaText,
  characterText,
  getLocale,
  setLocale,
  subscribeLocale,
  t,
  type Locale,
} from "./i18n";

let phaserGame: Phaser.Game | null = null;
let phaserLoadPromise: Promise<void> | null = null;
let selectedCharacterId = CHARACTERS[0]!.id;
let selectedArenaId: ArenaId = DEFAULT_ARENA_ID;
let hasJoined = false;
let isJoining = false;
let isInPractice = false;
let pendingRoomCode = DEFAULT_ROOM_CODE;
let activeRoomCode = DEFAULT_ROOM_CODE;
let hasCompletedRound = false;

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
    <p id="lobby-desc" class="lobby-desc"></p>
    <details id="guide-details" class="guide-panel" open>
      <summary>
        <span id="guide-title"></span>
        <span id="guide-note" class="guide-summary-note"></span>
      </summary>
      <div class="guide-content">
        <ol class="guide-steps">
          <li id="guide-move"></li>
          <li id="guide-pass"></li>
          <li id="guide-blink"></li>
          <li id="guide-survive"></li>
        </ol>
        <p id="guide-tip" class="guide-tip"></p>
      </div>
    </details>
    <div class="connection-settings">
      <div class="connection-field">
        <label class="field-label" for="locale-input">語言 / Language</label>
        <select id="locale-input">
          <option value="zh-Hant">繁中</option>
          <option value="en">English</option>
        </select>
      </div>
      <div class="connection-field">
        <label id="connection-mode-label" class="field-label" for="connection-mode"></label>
        <select id="connection-mode">
          <option id="local-server-option" value="local"></option>
          <option id="remote-server-option" value="remote"></option>
        </select>
      </div>
      <div id="remote-url-field" class="connection-field" hidden>
        <label id="remote-url-label" class="field-label" for="server-url-input"></label>
        <input id="server-url-input" type="url" placeholder="https://你的-tunnel.trycloudflare.com" />
      </div>
    </div>
    <label id="arena-label" class="field-label" for="arena-input"></label>
    <select id="arena-input" aria-describedby="arena-description"></select>
    <p id="arena-description" class="arena-description"></p>
    <label id="room-label" class="field-label" for="room-input"></label>
    <input id="room-input" maxlength="12" autocapitalize="characters" spellcheck="false" value="MAIN" />
    <label id="name-label" class="field-label" for="name-input"></label>
    <input id="name-input" maxlength="16" value="玩家" />
    <p class="section-label"><span id="characters-label"></span></p>
    <div id="character-grid" class="character-grid"></div>
    <ul id="player-list" class="player-list"></ul>
    <p id="lobby-status" aria-live="polite">連線中…</p>
    <section id="result-panel" class="result-panel" aria-live="polite" hidden>
      <p id="result-kicker" class="result-kicker"></p>
      <h2 id="result-title"></h2>
      <p id="result-outcome"></p>
      <p id="result-reason"></p>
      <p id="result-next" class="result-next"></p>
    </section>
    <button id="join-btn" disabled></button>
    <button id="start-btn" style="margin-top:8px;display:none" disabled></button>
    <button id="practice-btn" class="secondary-button" style="margin-top:8px"></button>
  </div>
`;
document.getElementById("app")!.appendChild(overlay);

const nameInput = overlay.querySelector("#name-input") as HTMLInputElement;
const connectionMode = overlay.querySelector("#connection-mode") as HTMLSelectElement;
const localeInput = overlay.querySelector("#locale-input") as HTMLSelectElement;
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
const resultPanel = overlay.querySelector("#result-panel") as HTMLElement;
const resultKicker = overlay.querySelector("#result-kicker") as HTMLParagraphElement;
const resultTitle = overlay.querySelector("#result-title") as HTMLHeadingElement;
const resultOutcome = overlay.querySelector("#result-outcome") as HTMLParagraphElement;
const resultReason = overlay.querySelector("#result-reason") as HTMLParagraphElement;
const resultNext = overlay.querySelector("#result-next") as HTMLParagraphElement;

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

const savedLocale = readStoredValue("shuai-gou.locale");
if (savedLocale === "en") setLocale("en");
localeInput.value = getLocale();

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
  arenaDescription.textContent = `${arenaText(arena.id, 1)} ${arenaText(arena.id, 2)}`;
}

function buildArenaSelect() {
  arenaSelect.replaceChildren();
  for (const arena of ARENAS) {
    const option = document.createElement("option");
    option.value = arena.id;
    option.textContent = arenaText(arena.id, 0);
    arenaSelect.append(option);
  }
  renderArenaChoice();
}

function applyLocale() {
  const locale = getLocale();
  document.documentElement.lang = locale;
  document.title = locale === "en" ? "Shuai Gou" : "甩狗 Shuai Gou";
  localeInput.value = locale;
  overlay.querySelector("#lobby-desc")!.textContent = t("lobbyDesc");
  overlay.querySelector("#guide-title")!.textContent = t("guideTitle");
  overlay.querySelector("#guide-note")!.textContent = t("guideNote");
  overlay.querySelector("#guide-move")!.textContent = t("guideMove");
  overlay.querySelector("#guide-pass")!.textContent = t("guidePass");
  overlay.querySelector("#guide-blink")!.textContent = t("guideBlink");
  overlay.querySelector("#guide-survive")!.textContent = t("guideSurvive");
  overlay.querySelector("#guide-tip")!.textContent = t("guideTip");
  overlay.querySelector("#connection-mode-label")!.textContent = t("connectionMode");
  overlay.querySelector("#local-server-option")!.textContent = t("localServer");
  overlay.querySelector("#remote-server-option")!.textContent = t("remoteServer");
  overlay.querySelector("#remote-url-label")!.textContent = t("remoteUrl");
  overlay.querySelector("#arena-label")!.textContent = t("arenaLabel");
  overlay.querySelector("#room-label")!.textContent = t("roomLabel");
  overlay.querySelector("#name-label")!.textContent = t("nameLabel");
  overlay.querySelector("#characters-label")!.textContent = t("charactersLabel");
  roomInput.placeholder = t("roomPlaceholder");
  nameInput.placeholder = t("namePlaceholder");
  playerList.ariaLabel = t("playersAria");
  joinBtn.textContent = t("join");
  startBtn.textContent = t("start");
  practiceBtn.textContent = t("practice");
  buildArenaSelect();
  buildCharacterGrid();
  renderCharacterGrid(latestSnapshot);
  if (!hasJoined && !isJoining) lobbyStatus.textContent = t("connectedSet");
  if (latestSnapshot) renderLobby(latestSnapshot);
}

buildArenaSelect();
applyLocale();

localeInput.addEventListener("change", () => {
  const next: Locale = localeInput.value === "en" ? "en" : "zh-Hant";
  setLocale(next);
  storeValue("shuai-gou.locale", next);
});

subscribeLocale(() => applyLocale());

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
      ? t("remotePrompt")
      : t("localPrompt");
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
    <button type="button" class="char-card" data-id="${c.id}" aria-label="${characterText(c.id, 0)}">
      <span class="char-check">✓</span>
      <img src="${c.asset}" alt="${characterText(c.id, 0)}" />
      <span class="char-name">${characterText(c.id, 0)}</span>
      <span class="char-tagline">${characterText(c.id, 1)}</span>
      <span class="char-description">${characterText(c.id, 2)}</span>
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
      status.textContent = getLocale() === "en" ? `${owner} selected` : `${owner} 已選`;
    } else if (isMine) {
      status.textContent = t("yourRole");
    } else {
      status.textContent = t("available");
    }
  });
}

function showOverlay() {
  overlay.style.display = "flex";
}

function hideOverlay() {
  overlay.style.display = "none";
}

function renderRoundResult(snapshot: GameSnapshot) {
  if (snapshot.phase !== "ended") {
    resultPanel.hidden = true;
    return;
  }

  const me = snapshot.players.find((p) => p.id === playerId);
  resultPanel.hidden = false;
  hasCompletedRound = true;
  resultKicker.textContent = t("resultKicker");
  resultTitle.textContent = snapshot.winnerName
    ? t("resultWinner", { winner: snapshot.winnerName })
    : t("resultDraw");
  resultOutcome.textContent = me
    ? me.alive
      ? t("resultSurvived")
      : t("resultEliminated")
    : "";
  resultReason.textContent = me?.alive ? "" : me ? t("resultReason") : "";
  resultNext.textContent = t("resultNext");
}

function renderLobby(snapshot: GameSnapshot) {
  if (isValidArenaId(snapshot.arenaId)) {
    selectedArenaId = snapshot.arenaId;
    renderArenaChoice();
  }
  pickFirstAvailable(snapshot);
  renderCharacterGrid(snapshot);
  renderRoundResult(snapshot);

  playerList.replaceChildren();
  for (const p of snapshot.players) {
    const char = CHARACTERS.find((c) => c.id === p.characterId);
    const item = document.createElement("li");
    const icon = document.createElement("img");
    icon.className = "player-char-icon";
    icon.src = char?.asset ?? "/assets/characters/char-hat.svg";
    icon.alt = "";
    item.append(
      icon,
      document.createTextNode(
        ` ${p.name} · ${char ? characterText(char.id, 0) : ""}${p.id === playerId ? (getLocale() === "en" ? " (you)" : "（你）") : ""}`,
      ),
    );
    playerList.append(item);
  }

  if (snapshot.phase === "lobby") {
    lobbyStatus.textContent = t("roomStatus", {
      room: activeRoomCode,
      arena: arenaText(selectedArenaId, 0),
      count: snapshot.roomCount,
      max: GAME.MAX_PLAYERS,
    });
    startBtn.style.display = hasJoined ? "block" : "none";
    startBtn.disabled = snapshot.roomCount < GAME.MIN_PLAYERS_TO_START;
    startBtn.textContent = hasCompletedRound ? t("replay") : t("start");
    joinBtn.textContent = hasJoined ? t("joined") : t("join");
    joinBtn.disabled = hasJoined || !selectedCharacterId;
    practiceBtn.style.display = hasJoined ? "none" : "block";
    practiceBtn.textContent = t("practice");
    practiceBtn.disabled = hasJoined || isJoining;
  } else if (snapshot.phase === "countdown") {
    lobbyStatus.textContent = t("countdownStatus", {
      arena: arenaText(selectedArenaId, 0),
      countdown: Math.ceil(snapshot.countdownSec ?? 0),
    });
    startBtn.style.display = "none";
    practiceBtn.style.display = "none";
    joinBtn.textContent = t("joined");
  } else if (snapshot.phase === "ended") {
    lobbyStatus.textContent = snapshot.winnerName
      ? t("endedStatus", { winner: snapshot.winnerName })
      : t("endedDrawStatus");
    startBtn.style.display = hasJoined ? "block" : "none";
    startBtn.disabled = true;
    startBtn.textContent = t("replayWaiting");
    practiceBtn.style.display = "none";
    joinBtn.textContent = t("joined");
    joinBtn.disabled = true;
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
  lobbyStatus.textContent = t("practiceExit");
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
      ? t("connectedJoining", { room: pendingRoomCode })
      : t("connectedSet");
    joinBtn.disabled = hasJoined || !selectedCharacterId;
    renderCharacterGrid(latestSnapshot);
  },
  onDisconnect: () => {
    if (isInPractice) return;
    lobbyStatus.textContent = t("disconnected");
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
    lobbyStatus.textContent = t("invalidRoom");
    return;
  }

  const serverUrl = connectionMode.value === "remote" ? serverUrlInput.value : "";
  if (connectionMode.value === "remote" && !serverUrl.trim()) {
    lobbyStatus.textContent = t("remoteRequired");
    return;
  }
  const configured = configureServerUrl(serverUrl);
  if (!configured.ok) {
    lobbyStatus.textContent = t("remoteInvalid");
    return;
  }

  pendingRoomCode = roomCode;
  roomInput.value = roomCode;
  isJoining = true;
  joinBtn.disabled = true;
  updateConnectionFields();
  lobbyStatus.textContent = t("connectedJoining", { room: roomCode });
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
            ? t("roomFull")
            : reason === "invalid_room_code"
              ? t("invalidRoom")
              : reason === "already_joined"
                ? t("alreadyJoined")
                : t("joinFailed");
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
      lobbyStatus.textContent = t("practiceLoadFail");
      return;
    }
    phaserGame.scene.stop("GameScene");
    phaserGame.scene.start("PracticeScene", { characterId: selectedCharacterId });
  });
});

export { latestSnapshot as getLatestSnapshot, playerId as getPlayerId };
export { sendAction } from "./network";
