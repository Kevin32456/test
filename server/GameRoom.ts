import { GAME, clamp, distance, normalizeAngle } from "../src/shared/constants.js";
import type {
  ClientAction,
  DogState,
  GamePhase,
  GameSnapshot,
  PlayerState,
} from "../src/shared/types.js";

interface InternalPlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  alive: boolean;
  hasBall: boolean;
  blinkCooldownMs: number;
}

export class GameRoom {
  private players = new Map<string, InternalPlayer>();
  private phase: GamePhase = "lobby";
  private ballHolderId: string | null = null;
  private holdTimeSec = 0;
  private countdownSec: number | null = null;
  private winnerId: string | null = null;
  private winnerName: string | null = null;
  private dog: DogState = {
    x: GAME.ARENA_WIDTH / 2,
    y: GAME.ARENA_HEIGHT / 2,
    angle: 0,
    speed: GAME.DOG_BASE_SPEED,
  };
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private endResetTimer: ReturnType<typeof setTimeout> | null = null;
  private onBroadcast: () => void;

  constructor(onBroadcast: () => void) {
    this.onBroadcast = onBroadcast;
  }

  addPlayer(id: string, name: string): boolean {
    if (this.players.size >= GAME.MAX_PLAYERS) return false;
    if (this.phase !== "lobby" && this.phase !== "ended") return false;

    const index = this.players.size;
    const spawn = this.spawnPoint(index);
    this.players.set(id, {
      id,
      name: name.slice(0, 16) || `玩家${index + 1}`,
      color: GAME.COLORS[index % GAME.COLORS.length],
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      alive: true,
      hasBall: false,
      blinkCooldownMs: 0,
    });

    if (this.phase === "ended") {
      this.resetLobby();
    }

    if (
      this.phase === "lobby" &&
      this.players.size >= GAME.MAX_PLAYERS
    ) {
      this.beginCountdown();
    }

    return true;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    if (this.ballHolderId === id) {
      this.ballHolderId = null;
      this.transferBallToRandomAlive();
    }
    if (this.players.size === 0) {
      this.stopTick();
      this.resetLobby();
    } else if (this.phase === "playing") {
      this.checkWin();
    }
  }

  handleAction(id: string, action: ClientAction) {
    const player = this.players.get(id);
    if (!player) return;

    if (action.type === "start") {
      if (
        this.phase === "lobby" &&
        this.players.size >= GAME.MIN_PLAYERS_TO_START
      ) {
        this.beginCountdown();
      }
      return;
    }

    if (this.phase !== "playing" || !player.alive) return;

    switch (action.type) {
      case "move":
        player.targetX = clamp(action.x, GAME.PLAYER_RADIUS, GAME.ARENA_WIDTH - GAME.PLAYER_RADIUS);
        player.targetY = clamp(action.y, GAME.PLAYER_RADIUS, GAME.ARENA_HEIGHT - GAME.PLAYER_RADIUS);
        break;
      case "pass": {
        if (!player.hasBall) return;
        const target = this.players.get(action.targetId);
        if (!target || !target.alive || target.id === id) return;
        player.hasBall = false;
        target.hasBall = true;
        this.ballHolderId = target.id;
        this.holdTimeSec = 0;
        break;
      }
      case "blink": {
        if (player.hasBall || player.blinkCooldownMs > 0) return;
        const dx = action.x - player.x;
        const dy = action.y - player.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;
        const nx = dx / len;
        const ny = dy / len;
        player.x = clamp(
          player.x + nx * GAME.BLINK_DISTANCE,
          GAME.PLAYER_RADIUS,
          GAME.ARENA_WIDTH - GAME.PLAYER_RADIUS,
        );
        player.y = clamp(
          player.y + ny * GAME.BLINK_DISTANCE,
          GAME.PLAYER_RADIUS,
          GAME.ARENA_HEIGHT - GAME.PLAYER_RADIUS,
        );
        player.targetX = player.x;
        player.targetY = player.y;
        player.blinkCooldownMs = GAME.BLINK_COOLDOWN_MS;
        break;
      }
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({ ...p })),
      dog: { ...this.dog },
      ballHolderId: this.ballHolderId,
      holdTimeSec: this.holdTimeSec,
      countdownSec: this.countdownSec,
      winnerId: this.winnerId,
      winnerName: this.winnerName,
      roomCount: this.players.size,
    };
  }

  private resetLobby() {
    this.phase = "lobby";
    this.ballHolderId = null;
    this.holdTimeSec = 0;
    this.countdownSec = null;
    this.winnerId = null;
    this.winnerName = null;
    for (const p of this.players.values()) {
      p.alive = true;
      p.hasBall = false;
      p.blinkCooldownMs = 0;
      const spawn = this.spawnPoint(
        [...this.players.keys()].indexOf(p.id),
      );
      p.x = spawn.x;
      p.y = spawn.y;
      p.targetX = spawn.x;
      p.targetY = spawn.y;
    }
    this.dog = {
      x: GAME.ARENA_WIDTH / 2,
      y: GAME.ARENA_HEIGHT / 2,
      angle: 0,
      speed: GAME.DOG_BASE_SPEED,
    };
  }

  private beginCountdown() {
    if (this.phase !== "lobby") return;
    this.phase = "countdown";
    this.countdownSec = GAME.COUNTDOWN_SECONDS;
    this.startTick();
  }

  private startGame() {
    this.phase = "playing";
    this.countdownSec = null;
    this.winnerId = null;
    this.winnerName = null;

    for (const p of this.players.values()) {
      p.alive = true;
      p.hasBall = false;
      p.blinkCooldownMs = 0;
    }

    const ids = [...this.players.keys()];
    const starter = ids[Math.floor(Math.random() * ids.length)];
    const starterPlayer = this.players.get(starter)!;
    starterPlayer.hasBall = true;
    this.ballHolderId = starter;
    this.holdTimeSec = 0;

    this.dog.x = GAME.ARENA_WIDTH / 2;
    this.dog.y = GAME.ARENA_HEIGHT / 2;
    this.dog.angle = Math.atan2(
      starterPlayer.y - this.dog.y,
      starterPlayer.x - this.dog.x,
    );
    this.dog.speed = GAME.DOG_BASE_SPEED;
  }

  private startTick() {
    if (this.tickTimer) return;
    const dt = 1000 / GAME.TICK_HZ;
    this.tickTimer = setInterval(() => this.tick(dt / 1000), dt);
  }

  private stopTick() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick(dt: number) {
    if (this.phase === "countdown") {
      if (this.countdownSec !== null) {
        this.countdownSec -= dt;
        if (this.countdownSec <= 0) {
          this.startGame();
        }
      }
      this.onBroadcast();
      return;
    }

    if (this.phase !== "playing") {
      this.onBroadcast();
      return;
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.blinkCooldownMs > 0) {
        p.blinkCooldownMs = Math.max(0, p.blinkCooldownMs - dt * 1000);
      }
      this.movePlayer(p, dt);
    }

    if (this.ballHolderId) {
      this.holdTimeSec += dt;
      this.updateDog(dt);
      this.checkDogKill();
    }

    this.checkWin();
    this.onBroadcast();
  }

  private movePlayer(p: InternalPlayer, dt: number) {
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const step = GAME.PLAYER_SPEED * dt;
    if (dist <= step) {
      p.x = p.targetX;
      p.y = p.targetY;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }

  private updateDog(dt: number) {
    const holder = this.ballHolderId
      ? this.players.get(this.ballHolderId)
      : null;
    if (!holder || !holder.alive || !holder.hasBall) return;

    const targetSpeed = clamp(
      GAME.DOG_BASE_SPEED + this.holdTimeSec * GAME.DOG_ACCEL_PER_SEC,
      GAME.DOG_BASE_SPEED,
      GAME.DOG_MAX_SPEED,
    );

    const dx = holder.x - this.dog.x;
    const dy = holder.y - this.dog.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    const desiredAngle = Math.atan2(dy, dx);
    let angleDiff = normalizeAngle(desiredAngle - this.dog.angle);
    const maxTurn = GAME.DOG_MAX_TURN_RATE * dt;
    angleDiff = clamp(angleDiff, -maxTurn, maxTurn);
    this.dog.angle += angleDiff;
    this.dog.speed = targetSpeed;
    this.dog.x += Math.cos(this.dog.angle) * targetSpeed * dt;
    this.dog.y += Math.sin(this.dog.angle) * targetSpeed * dt;

    this.dog.x = clamp(
      this.dog.x,
      GAME.DOG_RADIUS,
      GAME.ARENA_WIDTH - GAME.DOG_RADIUS,
    );
    this.dog.y = clamp(
      this.dog.y,
      GAME.DOG_RADIUS,
      GAME.ARENA_HEIGHT - GAME.DOG_RADIUS,
    );
  }

  private checkDogKill() {
    const holder = this.ballHolderId
      ? this.players.get(this.ballHolderId)
      : null;
    if (!holder || !holder.alive || !holder.hasBall) return;

    const hit =
      distance(this.dog.x, this.dog.y, holder.x, holder.y) <
      GAME.DOG_RADIUS + GAME.PLAYER_RADIUS - 4;

    if (!hit) return;

    holder.alive = false;
    holder.hasBall = false;
    this.ballHolderId = null;
    this.holdTimeSec = 0;
    this.transferBallToRandomAlive();
  }

  private transferBallToRandomAlive() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length === 0) return;
    const next = alive[Math.floor(Math.random() * alive.length)];
    next.hasBall = true;
    this.ballHolderId = next.id;
    this.holdTimeSec = 0;
  }

  private checkWin() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (this.phase !== "playing") return;
    if (alive.length === 1) {
      this.phase = "ended";
      this.winnerId = alive[0].id;
      this.winnerName = alive[0].name;
      this.ballHolderId = null;
      for (const p of this.players.values()) p.hasBall = false;
      this.scheduleLobbyReset();
    } else if (alive.length === 0) {
      this.phase = "ended";
      this.winnerId = null;
      this.winnerName = null;
      this.scheduleLobbyReset();
    }
  }

  private scheduleLobbyReset() {
    if (this.endResetTimer) clearTimeout(this.endResetTimer);
    this.endResetTimer = setTimeout(() => {
      this.resetLobby();
      this.onBroadcast();
    }, 5000);
  }

  private spawnPoint(index: number) {
    const margin = 80;
    const points = [
      { x: margin, y: margin },
      { x: GAME.ARENA_WIDTH - margin, y: margin },
      { x: margin, y: GAME.ARENA_HEIGHT - margin },
      {
        x: GAME.ARENA_WIDTH - margin,
        y: GAME.ARENA_HEIGHT - margin,
      },
    ];
    return points[index % points.length];
  }
}
