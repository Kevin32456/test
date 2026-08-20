import {
  GAME,
  arenaCenter,
  clamp,
  clampToArena,
  distance,
  normalizeAngle,
  slideCircleWall,
} from "../src/shared/constants.js";
import {
  getCharacter,
  isValidCharacterId,
} from "../src/shared/characters.js";
import type {
  BallState,
  ClientAction,
  DogState,
  GamePhase,
  GameSnapshot,
} from "../src/shared/types.js";

interface InternalPlayer {
  id: string;
  name: string;
  characterId: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  inputX: number;
  inputY: number;
  alive: boolean;
  hasBall: boolean;
  blinkCooldownMs: number;
}

export class GameRoom {
  private players = new Map<string, InternalPlayer>();
  private phase: GamePhase = "lobby";
  private matchSeq = 0;
  private ballHolderId: string | null = null;
  private holdTimeSec = 0;
  private flightPressureSec = 0;
  private countdownSec: number | null = null;
  private winnerId: string | null = null;
  private winnerName: string | null = null;
  private ball: BallState = this.idleBall();
  private dog: DogState = {
    x: arenaCenter().x,
    y: arenaCenter().y,
    angle: 0,
    speed: 0,
    vx: 0,
    vy: 0,
  };
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private endResetTimer: ReturnType<typeof setTimeout> | null = null;
  private onBroadcast: () => void;

  constructor(onBroadcast: () => void) {
    this.onBroadcast = onBroadcast;
  }

  addPlayer(id: string, name: string, characterId: string): boolean {
    if (this.players.size >= GAME.MAX_PLAYERS) return false;
    if (this.phase !== "lobby" && this.phase !== "ended") return false;
    if (!isValidCharacterId(characterId)) return false;
    if (!this.isCharacterAvailable(characterId)) return false;

    const index = this.players.size;
    const spawn = this.spawnPoint(index);
    const char = getCharacter(characterId)!;
    this.players.set(id, {
      id,
      name: name.slice(0, 16) || `玩家${index + 1}`,
      characterId,
      color: char.color,
      x: spawn.x,
      y: spawn.y,
      targetX: spawn.x,
      targetY: spawn.y,
      inputX: 0,
      inputY: 0,
      alive: true,
      hasBall: false,
      blinkCooldownMs: 0,
    });

    if (this.phase === "ended") {
      this.resetLobby();
    }

    if (this.phase === "lobby" && this.players.size >= GAME.MAX_PLAYERS) {
      this.beginCountdown();
    }

    return true;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    if (this.ballHolderId === id || this.ball.targetPlayerId === id) {
      this.ballHolderId = null;
      if (this.phase === "playing" && this.ball.inFlight) {
        this.retargetBallFlight();
      } else if (this.phase === "playing") {
        this.transferBallToRandomAlive();
      }
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

    if (action.type === "selectCharacter") {
      if (this.phase !== "lobby" && this.phase !== "ended") return;
      if (!isValidCharacterId(action.characterId)) return;
      if (!this.isCharacterAvailable(action.characterId, id)) return;
      const char = getCharacter(action.characterId)!;
      player.characterId = action.characterId;
      player.color = char.color;
      this.onBroadcast();
      return;
    }

    if (this.phase !== "playing" || !player.alive) return;

    switch (action.type) {
      case "move":
        player.inputX = 0;
        player.inputY = 0;
        {
          const clamped = clampToArena(action.x, action.y, GAME.PLAYER_RADIUS);
          player.targetX = clamped.x;
          player.targetY = clamped.y;
        }
        break;
      case "moveInput": {
        player.inputX = clamp(action.x, -1, 1);
        player.inputY = clamp(action.y, -1, 1);
        if (Math.hypot(player.inputX, player.inputY) > 0.01) {
          player.targetX = player.x;
          player.targetY = player.y;
        }
        break;
      }
      case "pass": {
        if (!player.hasBall || this.ball.inFlight) return;
        const target = this.players.get(action.targetId);
        if (!target || !target.alive || target.id === id) return;
        player.hasBall = false;
        this.startBallFlight(
          player.x,
          player.y - GAME.BALL_HOVER_OFFSET,
          target.id,
        );
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
        const blinked = clampToArena(
          player.x + nx * GAME.BLINK_DISTANCE,
          player.y + ny * GAME.BLINK_DISTANCE,
          GAME.PLAYER_RADIUS,
        );
        player.x = blinked.x;
        player.y = blinked.y;
        player.targetX = player.x;
        player.targetY = player.y;
        player.inputX = 0;
        player.inputY = 0;
        player.blinkCooldownMs = GAME.BLINK_COOLDOWN_MS;
        break;
      }
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      matchSeq: this.matchSeq,
      players: [...this.players.values()].map((p) => ({ ...p })),
      dog: { ...this.dog },
      ball: { ...this.ball },
      ballHolderId: this.ballHolderId,
      holdTimeSec: this.holdTimeSec,
      dogPressureSec: this.getDogPressureSec(),
      countdownSec: this.countdownSec,
      winnerId: this.winnerId,
      winnerName: this.winnerName,
      roomCount: this.players.size,
    };
  }

  private idleBall(): BallState {
    const c = arenaCenter();
    return {
      x: c.x,
      y: c.y,
      inFlight: false,
      targetPlayerId: null,
    };
  }

  private resetLobby() {
    this.phase = "lobby";
    this.ballHolderId = null;
    this.holdTimeSec = 0;
    this.flightPressureSec = 0;
    this.countdownSec = null;
    this.winnerId = null;
    this.winnerName = null;
    this.ball = this.idleBall();
    for (const p of this.players.values()) {
      p.alive = true;
      p.hasBall = false;
      p.blinkCooldownMs = 0;
      const spawn = this.spawnPoint([...this.players.keys()].indexOf(p.id));
      p.x = spawn.x;
      p.y = spawn.y;
      p.targetX = spawn.x;
      p.targetY = spawn.y;
    }
    const c = arenaCenter();
    this.dog = {
      x: c.x,
      y: c.y,
      angle: 0,
      speed: 0,
      vx: 0,
      vy: 0,
    };
  }

  private beginCountdown() {
    if (this.phase !== "lobby") return;
    this.phase = "countdown";
    this.countdownSec = GAME.COUNTDOWN_SECONDS;
    this.startTick();
  }

  private startGame() {
    this.matchSeq += 1;
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
    const starter = ids[Math.floor(Math.random() * ids.length)]!;
    const c = arenaCenter();
    this.dog.x = c.x;
    this.dog.y = c.y;
    this.dog.speed = 0;
    this.dog.vx = 0;
    this.dog.vy = 0;
    this.dog.angle = 0;

    this.startBallFlight(c.x, c.y, starter);
  }

  private startBallFlight(fromX: number, fromY: number, targetPlayerId: string) {
    for (const p of this.players.values()) {
      p.hasBall = false;
    }
    this.ballHolderId = null;
    this.flightPressureSec = this.holdTimeSec;
    this.holdTimeSec = 0;
    this.ball = {
      x: fromX,
      y: fromY,
      inFlight: true,
      targetPlayerId,
    };
  }

  private retargetBallFlight() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length === 0) {
      this.ball.inFlight = false;
      this.ball.targetPlayerId = null;
      return;
    }
    const next = alive[Math.floor(Math.random() * alive.length)]!;
    this.ball.targetPlayerId = next.id;
  }

  private landBallOn(targetId: string) {
    const target = this.players.get(targetId);
    if (!target || !target.alive) {
      this.transferBallToRandomAlive();
      return;
    }
    target.hasBall = true;
    this.ballHolderId = target.id;
    /** 傳球落地：保留 80% 狗壓 */
    this.holdTimeSec = this.flightPressureSec * GAME.DOG_PRESSURE_PASS_RETAIN;
    this.flightPressureSec = 0;
    this.ball.inFlight = false;
    this.ball.targetPlayerId = null;
    this.ball.x = target.x;
    this.ball.y = target.y - GAME.BALL_HOVER_OFFSET;
    // 保留狗當前滑動動量，不在接球瞬間減速
  }

  private updateBallFlight(dt: number) {
    if (!this.ball.inFlight || !this.ball.targetPlayerId) return;

    const target = this.players.get(this.ball.targetPlayerId);
    if (!target || !target.alive) {
      this.retargetBallFlight();
      return;
    }

    const tx = target.x;
    const ty = target.y - GAME.BALL_HOVER_OFFSET;
    const dx = tx - this.ball.x;
    const dy = ty - this.ball.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= GAME.BALL_ARRIVE_DIST) {
      this.landBallOn(target.id);
      return;
    }

    const step = GAME.BALL_FLIGHT_SPEED * dt;
    const move = Math.min(step, dist);
    this.ball.x += (dx / dist) * move;
    this.ball.y += (dy / dist) * move;
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

    if (this.ball.inFlight) {
      this.updateBallFlight(dt);
      this.updateDogToward(dt, this.ball.x, this.ball.y);
    } else if (this.ballHolderId) {
      const holder = this.players.get(this.ballHolderId);
      if (holder?.alive && holder.hasBall) {
        this.ball.x = holder.x;
        this.ball.y = holder.y - GAME.BALL_HOVER_OFFSET;
        this.holdTimeSec += dt;
        const chase = this.getHolderChasePoint(holder);
        this.updateDogToward(dt, chase.x, chase.y);
        this.checkDogKill();
      }
    }

    this.checkWin();
    this.onBroadcast();
  }

  private movePlayer(p: InternalPlayer, dt: number) {
    if (Math.hypot(p.inputX, p.inputY) > 0.01) {
      const len = Math.hypot(p.inputX, p.inputY);
      const nx = p.inputX / len;
      const ny = p.inputY / len;
      const step = GAME.PLAYER_SPEED * dt;
      const moved = clampToArena(
        p.x + nx * step,
        p.y + ny * step,
        GAME.PLAYER_RADIUS,
      );
      p.x = moved.x;
      p.y = moved.y;
      p.targetX = p.x;
      p.targetY = p.y;
      return;
    }

    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    const step = GAME.PLAYER_SPEED * dt;
    if (dist <= step) {
      const moved = clampToArena(p.targetX, p.targetY, GAME.PLAYER_RADIUS);
      p.x = moved.x;
      p.y = moved.y;
    } else {
      const moved = clampToArena(
        p.x + (dx / dist) * step,
        p.y + (dy / dist) * step,
        GAME.PLAYER_RADIUS,
      );
      p.x = moved.x;
      p.y = moved.y;
    }
  }

  private getHolderChasePoint(holder: InternalPlayer): { x: number; y: number } {
    const moveDx = holder.targetX - holder.x;
    const moveDy = holder.targetY - holder.y;
    const moveLen = Math.hypot(moveDx, moveDy);

    let dirX: number;
    let dirY: number;

    if (moveLen > 6) {
      dirX = moveDx / moveLen;
      dirY = moveDy / moveLen;
    } else {
      const towardHolderDx = holder.x - this.dog.x;
      const towardHolderDy = holder.y - this.dog.y;
      const towardHolderLen = Math.hypot(towardHolderDx, towardHolderDy);
      if (towardHolderLen > 1) {
        dirX = towardHolderDx / towardHolderLen;
        dirY = towardHolderDy / towardHolderLen;
      } else {
        return { x: holder.x, y: holder.y };
      }
    }

    return {
      x: holder.x + dirX * GAME.DOG_CHASE_FRONT_OFFSET,
      y: holder.y + dirY * GAME.DOG_CHASE_FRONT_OFFSET,
    };
  }

  private getDogPressureSec(): number {
    return this.ball.inFlight ? this.flightPressureSec : this.holdTimeSec;
  }

  private updateDogToward(dt: number, chaseX: number, chaseY: number) {
    const pressure = this.getDogPressureSec();
    const targetSpeed = clamp(
      GAME.DOG_BASE_SPEED + pressure * GAME.DOG_ACCEL_PER_SEC,
      GAME.DOG_BASE_SPEED,
      GAME.DOG_MAX_SPEED,
    );

    const dx = chaseX - this.dog.x;
    const dy = chaseY - this.dog.y;
    const dist = Math.hypot(dx, dy);

    let vx = this.dog.vx;
    let vy = this.dog.vy;

    if (dist >= 1) {
      const desiredAngle = Math.atan2(dy, dx);
      const speed = Math.hypot(vx, vy);

      if (speed > 20) {
        const currentAngle = Math.atan2(vy, vx);
        const angleDiff = normalizeAngle(desiredAngle - currentAngle);
        const sharpTurn = Math.abs(angleDiff) > Math.PI / 2;

        const turnScale = sharpTurn ? GAME.DOG_SHARP_TURN_SCALE : 1;
        const maxTurn = GAME.DOG_TURN_RATE * turnScale * dt;
        const turn = clamp(angleDiff, -maxTurn, maxTurn);
        const newAngle = currentAngle + turn;

        const gripScale = sharpTurn ? GAME.DOG_SHARP_TURN_GRIP_SCALE : 1;
        const newSpeed =
          speed + (targetSpeed - speed) * GAME.DOG_FORWARD_GRIP * gripScale * dt;

        const speedCap = targetSpeed * 1.15;
        const clampedSpeed = clamp(newSpeed, 0, speedCap);

        vx = Math.cos(newAngle) * clampedSpeed;
        vy = Math.sin(newAngle) * clampedSpeed;

        // 大角度轉向時保留橫向慣性（相對新追擊方向的側滑）
        const headingX = dx / dist;
        const headingY = dy / dist;
        const rightX = -headingY;
        const rightY = headingX;
        const vForward = vx * headingX + vy * headingY;
        const vLateral = vx * rightX + vy * rightY;
        const lateralDamp = Math.exp(-GAME.DOG_LATERAL_FRICTION * dt);
        vx = vForward * headingX + vLateral * lateralDamp * rightX;
        vy = vForward * headingY + vLateral * lateralDamp * rightY;
      } else {
        const headingX = dx / dist;
        const headingY = dy / dist;
        const vForward = vx * headingX + vy * headingY;
        const forwardImpulse =
          (targetSpeed - vForward) * GAME.DOG_FORWARD_GRIP * dt;
        vx += headingX * forwardImpulse;
        vy += headingY * forwardImpulse;
      }
    }

    let speed = Math.hypot(vx, vy);
    const speedCap = targetSpeed * 1.15;
    if (speed > speedCap) {
      const scale = speedCap / speed;
      vx *= scale;
      vy *= scale;
      speed = speedCap;
    }

    const nextX = this.dog.x + vx * dt;
    const nextY = this.dog.y + vy * dt;
    const wall = slideCircleWall(
      nextX,
      nextY,
      vx,
      vy,
      GAME.DOG_RADIUS,
      GAME.DOG_WALL_SLIDE,
    );

    this.dog.vx = wall.vx;
    this.dog.vy = wall.vy;
    this.dog.x = wall.x;
    this.dog.y = wall.y;
    this.dog.speed = Math.hypot(vx, vy);

    if (this.dog.speed > 10) {
      this.dog.angle = Math.atan2(vy, vx);
    } else if (dist >= 1) {
      this.dog.angle = Math.atan2(dy, dx);
    }
  }

  private checkDogKill() {
    const holder = this.ballHolderId
      ? this.players.get(this.ballHolderId)
      : null;
    if (!holder || !holder.alive || !holder.hasBall || this.ball.inFlight) {
      return;
    }

    const hit =
      distance(this.dog.x, this.dog.y, holder.x, holder.y) <
      GAME.DOG_RADIUS + GAME.PLAYER_RADIUS - 4;

    if (!hit) return;

    const fromX = holder.x;
    const fromY = holder.y - GAME.BALL_HOVER_OFFSET;
    holder.alive = false;
    holder.hasBall = false;
    this.ballHolderId = null;
    this.holdTimeSec = 0;

    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length === 0) return;

    const next = alive[Math.floor(Math.random() * alive.length)]!;
    this.startBallFlight(fromX, fromY, next.id);
  }

  private transferBallToRandomAlive() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length === 0) return;
    const next = alive[Math.floor(Math.random() * alive.length)]!;
    const c = arenaCenter();
    this.startBallFlight(c.x, c.y, next.id);
  }

  private checkWin() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (this.phase !== "playing") return;
    if (alive.length === 1) {
      this.phase = "ended";
      this.winnerId = alive[0].id;
      this.winnerName = alive[0].name;
      this.ballHolderId = null;
      this.ball.inFlight = false;
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
      this.endResetTimer = null;
      this.resetLobby();
      this.onBroadcast();
    }, GAME.LOBBY_RESET_MS);
  }

  private isCharacterAvailable(characterId: string, exceptId?: string): boolean {
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue;
      if (p.characterId === characterId) return false;
    }
    return true;
  }

  private spawnPoint(index: number) {
    const c = arenaCenter();
    const r = GAME.ARENA_RADIUS * 0.62;
    const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];
    const a = angles[index % angles.length]!;
    return {
      x: c.x + Math.cos(a) * r,
      y: c.y + Math.sin(a) * r,
    };
  }
}
