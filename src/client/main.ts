import Phaser from "phaser";
import { GAME } from "@shared/constants";
import type { GameSnapshot } from "@shared/types";
import { GameScene } from "./scenes/GameScene";
import {
  bindNetworkHandlers,
  joinRoom,
  latestSnapshot,
  playerId,
  sendAction,
  subscribeState,
} from "./network";
import "./style.css";

let phaserGame: Phaser.Game | null = null;

const overlay = document.createElement("div");
overlay.className = "overlay-panel";
overlay.innerHTML = `
  <div class="lobby-card">
    <h1>甩狗 Shuai Gou</h1>
    <p>4 人連線派對：狗追持球者，持球不能 Blink，只能右鍵傳球。最後存活者獲勝。</p>
    <input id="name-input" maxlength="16" placeholder="輸入暱稱" value="玩家" />
    <ul id="player-list" class="player-list"></ul>
    <p id="lobby-status">連線中…</p>
    <button id="join-btn" disabled>加入房間</button>
    <button id="start-btn" style="margin-top:8px;display:none" disabled>提前開始（至少 2 人）</button>
  </div>
`;
document.getElementById("app")!.appendChild(overlay);

const nameInput = overlay.querySelector("#name-input") as HTMLInputElement;
const playerList = overlay.querySelector("#player-list") as HTMLUListElement;
const lobbyStatus = overlay.querySelector("#lobby-status") as HTMLParagraphElement;
const joinBtn = overlay.querySelector("#join-btn") as HTMLButtonElement;
const startBtn = overlay.querySelector("#start-btn") as HTMLButtonElement;

function showOverlay() {
  overlay.style.display = "flex";
}

function hideOverlay() {
  overlay.style.display = "none";
}

function renderLobby(snapshot: GameSnapshot) {
  playerList.innerHTML = snapshot.players
    .map(
      (p) =>
        `<li><span style="color:${p.color}">●</span> ${p.name}${p.id === playerId ? "（你）" : ""}</li>`,
    )
    .join("");

  if (snapshot.phase === "lobby") {
    lobbyStatus.textContent = `等待玩家 ${snapshot.roomCount}/${GAME.MAX_PLAYERS}（滿 4 人自動開始）`;
    startBtn.style.display = playerId ? "block" : "none";
    startBtn.disabled = snapshot.roomCount < GAME.MIN_PLAYERS_TO_START;
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

  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: GAME.ARENA_WIDTH,
    height: GAME.ARENA_HEIGHT,
    backgroundColor: "#141922",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
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

bindNetworkHandlers({
  onConnect: () => {
    lobbyStatus.textContent = "已連線，輸入暱稱後加入。";
    joinBtn.disabled = false;
  },
  onDisconnect: () => {
    lobbyStatus.textContent = "連線中斷，請重新整理頁面。";
  },
  onJoined: (payload) => {
    renderLobby(payload.snapshot);
    startBtn.style.display = "block";
    handlePhase(payload.snapshot);
  },
});

subscribeState((snapshot) => {
  handlePhase(snapshot);
});

joinBtn.addEventListener("click", () => {
  joinBtn.disabled = true;
  joinRoom(nameInput.value.trim() || "玩家", (ok) => {
    if (!ok) {
      lobbyStatus.textContent = "房間已滿或無法加入，請稍後再試。";
      joinBtn.disabled = false;
    }
  });
});

startBtn.addEventListener("click", () => {
  sendAction({ type: "start" });
});

export { latestSnapshot as getLatestSnapshot, playerId as getPlayerId };
export { sendAction } from "./network";
