import Phaser from "phaser";
import { GAME } from "@shared/constants";
import type { GameSnapshot } from "@shared/types";
import { CHARACTERS } from "@shared/characters";
import { GameScene } from "./scenes/GameScene";
import {
  bindNetworkHandlers,
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
let selectedCharacterId = CHARACTERS[0]!.id;
let hasJoined = false;

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
        <p class="lobby-subtitle">SHUAI GOU — 熱土豆 × 鬼抓人</p>
      </div>
    </header>
    <p class="lobby-desc">選擇角色後加入房間，每位角色僅限一人。</p>
    <label class="field-label" for="name-input">暱稱</label>
    <input id="name-input" maxlength="16" placeholder="輸入暱稱" value="玩家" />
    <p class="section-label"><span>選擇角色</span></p>
    <div id="character-grid" class="character-grid"></div>
    <ul id="player-list" class="player-list"></ul>
    <p id="lobby-status">連線中…</p>
    <button id="join-btn" disabled>加入房間</button>
    <button id="start-btn" style="margin-top:8px;display:none" disabled>提前開始（至少 2 人）</button>
  </div>
`;
document.getElementById("app")!.appendChild(overlay);

const nameInput = overlay.querySelector("#name-input") as HTMLInputElement;
const characterGrid = overlay.querySelector("#character-grid") as HTMLDivElement;
const playerList = overlay.querySelector("#player-list") as HTMLUListElement;
const lobbyStatus = overlay.querySelector("#lobby-status") as HTMLParagraphElement;
const joinBtn = overlay.querySelector("#join-btn") as HTMLButtonElement;
const startBtn = overlay.querySelector("#start-btn") as HTMLButtonElement;

function buildCharacterGrid() {
  characterGrid.innerHTML = CHARACTERS.map(
    (c) => `
    <button type="button" class="char-card" data-id="${c.id}" aria-label="${c.name}">
      <span class="char-check">✓</span>
      <img src="${characterDataURL(c.id)}" alt="${c.name}" />
      <span class="char-name">${c.name}</span>
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
    const char = CHARACTERS.find((c) => c.id === id)!;
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
      status.textContent = char.name;
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
  pickFirstAvailable(snapshot);
  renderCharacterGrid(snapshot);

  playerList.innerHTML = snapshot.players
    .map((p) => {
      const char = CHARACTERS.find((c) => c.id === p.characterId);
      return `<li><img class="player-char-icon" src="${characterDataURL(p.characterId, 3)}" alt="" /> ${p.name} · ${char?.name ?? ""}${p.id === playerId ? "（你）" : ""}</li>`;
    })
    .join("");

  if (snapshot.phase === "lobby") {
    lobbyStatus.textContent = `等待玩家 ${snapshot.roomCount}/${GAME.MAX_PLAYERS}（滿 4 人自動開始）`;
    startBtn.style.display = hasJoined ? "block" : "none";
    startBtn.disabled = snapshot.roomCount < GAME.MIN_PLAYERS_TO_START;
    joinBtn.textContent = hasJoined ? "已加入房間" : "加入房間";
    joinBtn.disabled = hasJoined || !selectedCharacterId;
  } else if (snapshot.phase === "countdown") {
    lobbyStatus.textContent = `即將開始… ${Math.ceil(snapshot.countdownSec ?? 0)}`;
    startBtn.style.display = "none";
  } else if (snapshot.phase === "ended") {
    lobbyStatus.textContent = snapshot.winnerName
      ? `${snapshot.winnerName} 獲勝！${Math.ceil(GAME.LOBBY_RESET_MS / 1000)} 秒後回到大廳…`
      : `本局結束，${Math.ceil(GAME.LOBBY_RESET_MS / 1000)} 秒後回到大廳…`;
    startBtn.style.display = "none";
  }
}

function ensurePhaser() {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene("GameScene");
    if (!scene || !scene.sys.isActive()) {
      phaserGame.scene.start("GameScene");
    }
    return;
  }

  void loadPixelFont().then(() => {
    if (phaserGame) return;

    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "app",
      width: GAME.ARENA_WIDTH,
      height: GAME.ARENA_HEIGHT,
      backgroundColor: "#171a26",
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [GameScene],
    });
  });
}

function handlePhase(snapshot: GameSnapshot) {
  if (snapshot.phase === "lobby" || snapshot.phase === "ended") {
    showOverlay();
    renderLobby(snapshot);
    return;
  }

  if (snapshot.phase === "countdown" || snapshot.phase === "playing") {
    hideOverlay();
    ensurePhaser();
  }
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
    lobbyStatus.textContent = "已連線，選擇角色後加入。";
    joinBtn.disabled = !selectedCharacterId;
    renderCharacterGrid(latestSnapshot);
  },
  onDisconnect: () => {
    lobbyStatus.textContent = "連線中斷，請重新整理頁面。";
    hasJoined = false;
  },
  onJoined: (payload) => {
    hasJoined = true;
    selectedCharacterId =
      payload.snapshot.players.find((p) => p.id === playerId)?.characterId ??
      selectedCharacterId;
    renderLobby(payload.snapshot);
    startBtn.style.display = "block";
    handlePhase(payload.snapshot);
  },
});

subscribeState((snapshot) => {
  handlePhase(snapshot);
});

joinBtn.addEventListener("click", () => {
  if (hasJoined) return;
  joinBtn.disabled = true;
  joinRoom(nameInput.value.trim() || "玩家", selectedCharacterId, (ok, reason) => {
    if (!ok) {
      lobbyStatus.textContent =
        reason === "room_full_or_character_taken"
          ? "房間已滿或角色已被選走，請換一個。"
          : "無法加入，請稍後再試。";
      joinBtn.disabled = false;
      pickFirstAvailable(latestSnapshot);
      renderCharacterGrid(latestSnapshot);
    }
  });
});

startBtn.addEventListener("click", () => {
  sendAction({ type: "start" });
});

export { latestSnapshot as getLatestSnapshot, playerId as getPlayerId };
export { sendAction } from "./network";
