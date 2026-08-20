import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";
import { expLerp, expLerpAngle } from "../interpolation";
import { CHARACTERS, getCharacter } from "@shared/characters";
import { GAME } from "@shared/constants";
import type { GameSnapshot, PlayerState } from "@shared/types";
import {
  getLatestSnapshot,
  getPlayerId,
  sendAction,
  subscribeState,
} from "../network";

interface DisplayPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const DOG_MAX_PRESSURE_SEC =
  (GAME.DOG_MAX_SPEED - GAME.DOG_BASE_SPEED) / GAME.DOG_ACCEL_PER_SEC;

export class GameScene extends Phaser.Scene {
  private playerSprites = new Map<string, Phaser.GameObjects.Container>();
  private playerLabels = new Map<string, Phaser.GameObjects.Text>();
  private holderRings = new Map<string, Phaser.GameObjects.Arc>();
  private displayPlayers = new Map<string, DisplayPoint>();
  private displayDog: DisplayPoint & { angle: number; targetAngle: number } = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    angle: 0,
    targetAngle: 0,
  };
  private dogSprite!: Phaser.GameObjects.Container;
  private ballSprite!: Phaser.GameObjects.Arc;
  private ballGlow!: Phaser.GameObjects.Arc;
  private moveMarker!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private threatBar!: Phaser.GameObjects.Graphics;
  private countdownBanner: Phaser.GameObjects.Text | null = null;
  private endedBanner: Phaser.GameObjects.Text | null = null;
  private unsubState: (() => void) | null = null;
  private prevSnapshot: GameSnapshot | null = null;
  private lastMatchSeq = 0;
  private lastCountdownBeep = -1;
  private displayBall = { x: 0, y: 0, tx: 0, ty: 0 };
  private pulseT = 0;

  constructor() {
    super("GameScene");
  }

  preload() {
    for (const c of CHARACTERS) {
      this.load.image(`char-${c.id}`, c.asset);
    }
  }

  create() {
    Sfx.unlock();
    this.drawArena();

    this.dogSprite = this.add.container(0, 0);
    const dogBody = this.add.circle(0, 0, GAME.DOG_RADIUS, 0xe53935);
    const dogEar = this.add.triangle(0, -8, 0, -18, -10, 4, 10, 4, 0xff7043);
    const dogTail = this.add.rectangle(-16, 4, 14, 5, 0xffab91);
    dogTail.setAngle(-20);
    this.dogSprite.add([dogTail, dogBody, dogEar]);

    this.ballGlow = this.add
      .circle(0, 0, GAME.BALL_RADIUS + 6, 0xffeb3b, 0.22)
      .setDepth(40);
    this.ballSprite = this.add
      .circle(0, 0, GAME.BALL_RADIUS, 0xffeb3b)
      .setStrokeStyle(2, 0xf57f17)
      .setDepth(41);

    this.moveMarker = this.add
      .circle(0, 0, 10, 0xffffff, 0)
      .setStrokeStyle(2, 0xffffff, 0.55)
      .setDepth(5)
      .setVisible(false);

    this.threatBar = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.hud = this.add
      .text(12, 12, "", {
        fontFamily: "Segoe UI, Noto Sans TC, sans-serif",
        fontSize: "14px",
        color: "#e8eaed",
        backgroundColor: "rgba(10,12,16,0.72)",
        padding: { x: 10, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      Sfx.unlock();
      if (pointer.button !== 2) return;
      this.handleRightClick(pointer.worldX, pointer.worldY);
    });

    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault();
      Sfx.unlock();
      const me = this.getMe();
      if (!me || !me.alive || me.hasBall) return;
      const pointer = this.input.activePointer;
      sendAction({ type: "blink", x: pointer.worldX, y: pointer.worldY });
    });

    this.unsubState = subscribeState((snapshot) => {
      this.applySnapshot(snapshot);
    });

    const initial = getLatestSnapshot();
    if (initial) this.applySnapshot(initial);
  }

  shutdown() {
    this.unsubState?.();
    this.unsubState = null;
    this.prevSnapshot = null;
  }

  update(_time: number, delta: number) {
    this.pulseT += delta;
    const snapshot = getLatestSnapshot();
    if (!snapshot) return;

    const lerp = GAME.CLIENT_LERP;

    for (const [id, dp] of this.displayPlayers) {
      dp.x = expLerp(dp.x, dp.tx, delta, lerp);
      dp.y = expLerp(dp.y, dp.ty, delta, lerp);
      const container = this.playerSprites.get(id);
      const label = this.playerLabels.get(id);
      const ring = this.holderRings.get(id);
      if (container) container.setPosition(dp.x, dp.y);
      if (label) label.setPosition(dp.x, dp.y - 42);
      if (ring) {
        ring.setPosition(dp.x, dp.y);
        const holder = snapshot.players.find((p) => p.id === id);
        const isHolder = holder?.hasBall && !snapshot.ball.inFlight;
        ring.setVisible(!!isHolder);
        if (isHolder) {
          const pulse = 1 + 0.12 * Math.sin(this.pulseT * 0.012);
          ring.setScale(pulse);
        }
      }
    }

    if (snapshot.phase === "playing" || snapshot.phase === "countdown") {
      const d = this.displayDog;
      d.x = expLerp(d.x, d.tx, delta, GAME.CLIENT_DOG_LERP);
      d.y = expLerp(d.y, d.ty, delta, GAME.CLIENT_DOG_LERP);
      d.angle = expLerpAngle(d.angle, d.targetAngle, delta, GAME.CLIENT_DOG_LERP);
      this.dogSprite.setPosition(d.x, d.y);
      this.dogSprite.setRotation(d.angle);
    }

    if (snapshot.phase === "playing") {
      this.displayBall.x = expLerp(
        this.displayBall.x,
        this.displayBall.tx,
        delta,
        lerp + 4,
      );
      this.displayBall.y = expLerp(
        this.displayBall.y,
        this.displayBall.ty,
        delta,
        lerp + 4,
      );
      this.ballSprite.setPosition(this.displayBall.x, this.displayBall.y);
      this.ballGlow.setPosition(this.displayBall.x, this.displayBall.y);
    }

    this.drawThreatBar(snapshot);
  }

  private drawThreatBar(snapshot: GameSnapshot) {
    const g = this.threatBar;
    g.clear();
    if (snapshot.phase !== "playing") return;

    const ratio = clamp01(snapshot.dogPressureSec / DOG_MAX_PRESSURE_SEC);
    const x = 12;
    const y = 108;
    const w = 160;
    const h = 8;
    const fill =
      ratio < 0.45 ? 0x66bb6a : ratio < 0.75 ? 0xffa726 : 0xef5350;

    g.fillStyle(0x2a3140, 0.9);
    g.fillRoundedRect(x, y, w, h, 4);
    if (ratio > 0) {
      g.fillStyle(fill, 0.95);
      g.fillRoundedRect(x, y, Math.max(4, w * ratio), h, 4);
    }
  }

  private drawArena() {
    const g = this.add.graphics();
    g.fillStyle(0x1b2430, 1);
    g.fillRect(0, 0, GAME.ARENA_WIDTH, GAME.ARENA_HEIGHT);
    g.lineStyle(4, 0x3d4f68, 1);
    g.strokeRect(2, 2, GAME.ARENA_WIDTH - 4, GAME.ARENA_HEIGHT - 4);
    g.lineStyle(1, 0x253041, 0.45);
    for (let x = 0; x <= GAME.ARENA_WIDTH; x += 60) {
      g.lineBetween(x, 0, x, GAME.ARENA_HEIGHT);
    }
    for (let y = 0; y <= GAME.ARENA_HEIGHT; y += 60) {
      g.lineBetween(0, y, GAME.ARENA_WIDTH, y);
    }
  }

  private showMoveMarker(x: number, y: number) {
    this.moveMarker.setPosition(x, y).setVisible(true).setAlpha(0.75);
    this.tweens.killTweensOf(this.moveMarker);
    this.tweens.add({
      targets: this.moveMarker,
      alpha: 0,
      duration: 550,
      onComplete: () => this.moveMarker.setVisible(false),
    });
  }

  private handleRightClick(wx: number, wy: number) {
    const snapshot = getLatestSnapshot();
    if (!snapshot || snapshot.phase !== "playing") return;

    const me = this.getMe();
    if (!me || !me.alive) return;

    if (me.hasBall && !snapshot.ball.inFlight) {
      const target = this.findPlayerAt(wx, wy, snapshot.players);
      if (target && target.alive && target.id !== me.id) {
        sendAction({ type: "pass", targetId: target.id });
        return;
      }
    }

    sendAction({ type: "move", x: wx, y: wy });
    this.showMoveMarker(wx, wy);
  }

  private findPlayerAt(
    wx: number,
    wy: number,
    players: PlayerState[],
  ): PlayerState | null {
    let found: PlayerState | null = null;
    let best = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Phaser.Math.Distance.Between(wx, wy, p.x, p.y);
      if (d <= GAME.PLAYER_RADIUS + 10 && d < best) {
        best = d;
        found = p;
      }
    }
    return found;
  }

  private getMe() {
    return getLatestSnapshot()?.players.find((p) => p.id === getPlayerId());
  }

  private flashPlayer(id: string) {
    const container = this.playerSprites.get(id);
    if (!container) return;
    this.tweens.add({
      targets: container,
      alpha: 0.25,
      duration: 60,
      yoyo: true,
      repeat: 1,
    });
  }

  private playSnapshotSfx(snapshot: GameSnapshot) {
    const prev = this.prevSnapshot;
    if (!prev) return;

    if (snapshot.phase === "countdown" && snapshot.countdownSec !== null) {
      const sec = Math.ceil(snapshot.countdownSec);
      if (sec !== this.lastCountdownBeep && sec > 0) {
        this.lastCountdownBeep = sec;
        Sfx.countdown();
      }
    }

    if (prev.phase === "playing" && snapshot.phase === "playing") {
      if (!prev.ball.inFlight && snapshot.ball.inFlight) {
        Sfx.pass();
      }

      for (const p of snapshot.players) {
        const was = prev.players.find((x) => x.id === p.id);
        if (was?.alive && !p.alive) {
          Sfx.death();
        }
        if (
          p.id === getPlayerId() &&
          was &&
          was.blinkCooldownMs <= 0 &&
          p.blinkCooldownMs > 0
        ) {
          Sfx.blink();
          this.flashPlayer(p.id);
        }
      }
    }

    if (prev.phase === "playing" && snapshot.phase === "ended") {
      Sfx.win();
    }
  }

  private resetRoundVisuals() {
    if (this.endedBanner) {
      this.endedBanner.destroy();
      this.endedBanner = null;
    }
    this.lastCountdownBeep = -1;
  }

  private applySnapshot(snapshot: GameSnapshot) {
    this.playSnapshotSfx(snapshot);

    if (snapshot.matchSeq !== this.lastMatchSeq) {
      this.lastMatchSeq = snapshot.matchSeq;
      this.resetRoundVisuals();
      this.displayBall.x = snapshot.ball.x;
      this.displayBall.y = snapshot.ball.y;
      this.displayBall.tx = snapshot.ball.x;
      this.displayBall.ty = snapshot.ball.y;
    }

    if (snapshot.phase === "countdown") {
      const sec = Math.ceil(snapshot.countdownSec ?? 0);
      if (!this.countdownBanner) {
        this.countdownBanner = this.add
          .text(GAME.ARENA_WIDTH / 2, GAME.ARENA_HEIGHT / 2, "", {
            fontFamily: "Segoe UI, Noto Sans TC, sans-serif",
            fontSize: "72px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setDepth(300);
      }
      this.countdownBanner.setText(sec > 0 ? String(sec) : "開始！");
      this.countdownBanner.setVisible(true);
    } else if (this.countdownBanner) {
      this.countdownBanner.setVisible(false);
    }

    for (const p of snapshot.players) {
      let dp = this.displayPlayers.get(p.id);
      if (!dp) {
        dp = { x: p.x, y: p.y, tx: p.x, ty: p.y };
        this.displayPlayers.set(p.id, dp);
      }
      dp.tx = p.x;
      dp.ty = p.y;

      let container = this.playerSprites.get(p.id);
      if (!container) {
        container = this.add.container(p.x, p.y);
        const char = getCharacter(p.characterId);
        const textureKey = `char-${p.characterId}`;
        let avatar: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
        if (this.textures.exists(textureKey)) {
          avatar = this.add.image(0, 2, textureKey);
          avatar.setDisplaySize(44, 58);
          avatar.setOrigin(0.5, 0.85);
        } else {
          avatar = this.add.circle(
            0,
            0,
            GAME.PLAYER_RADIUS,
            Phaser.Display.Color.HexStringToColor(char?.color ?? p.color).color,
          );
        }
        container.add(avatar);
        container.setData("avatar", avatar);
        this.playerSprites.set(p.id, container);

        const ring = this.add
          .circle(0, 0, GAME.PLAYER_RADIUS + 14, 0x000000, 0)
          .setStrokeStyle(3, 0xffeb3b, 0.9)
          .setVisible(false);
        this.holderRings.set(p.id, ring);

        const label = this.add
          .text(0, -42, p.name, {
            fontFamily: "Segoe UI, Noto Sans TC, sans-serif",
            fontSize: "13px",
            color: "#ffffff",
          })
          .setOrigin(0.5);
        this.playerLabels.set(p.id, label);
      }

      container.setAlpha(p.alive ? 1 : 0.32);

      const label = this.playerLabels.get(p.id)!;
      label.setText(p.name + (p.id === getPlayerId() ? "（你）" : ""));
    }

    this.displayDog.tx = snapshot.dog.x;
    this.displayDog.ty = snapshot.dog.y;
    this.displayDog.targetAngle = snapshot.dog.angle;
    if (this.prevSnapshot?.matchSeq !== snapshot.matchSeq) {
      this.displayDog.x = snapshot.dog.x;
      this.displayDog.y = snapshot.dog.y;
      this.displayDog.angle = snapshot.dog.angle;
    }

    this.displayBall.tx = snapshot.ball.x;
    this.displayBall.ty = snapshot.ball.y;

    const showBall =
      snapshot.phase === "playing" &&
      (snapshot.ball.inFlight || snapshot.ballHolderId !== null);

    this.ballSprite.setVisible(showBall);
    this.ballGlow.setVisible(showBall);

    const me = this.getMe();
    const aliveCount = snapshot.players.filter((p) => p.alive).length;
    const cd = me ? Math.ceil(me.blinkCooldownMs / 1000) : 0;
    const pressurePct = Math.round(
      clamp01(snapshot.dogPressureSec / DOG_MAX_PRESSURE_SEC) * 100,
    );

    let ballHint = "";
    if (snapshot.ball.inFlight) {
      ballHint = "球飛行中 — 狗仍追球";
    } else if (me?.hasBall) {
      ballHint = "你持球：右鍵點人傳球";
    } else if (me?.alive) {
      ballHint = `Blink <Space> · CD ${cd}s`;
    } else {
      ballHint = "觀戰中";
    }

    this.hud.setText(
      [
        `存活 ${aliveCount}/${snapshot.players.length}`,
        `持球 ${snapshot.holdTimeSec.toFixed(1)}s · 狗壓 ${pressurePct}%`,
        ballHint,
        "右鍵移動／傳球",
      ].join("\n"),
    );

    if (snapshot.phase === "ended") {
      if (!this.endedBanner) {
        this.endedBanner = this.add
          .text(GAME.ARENA_WIDTH / 2, GAME.ARENA_HEIGHT / 2, "", {
            fontFamily: "Segoe UI, Noto Sans TC, sans-serif",
            fontSize: "28px",
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.65)",
            padding: { x: 24, y: 16 },
          })
          .setOrigin(0.5)
          .setDepth(200);
      }
      this.endedBanner.setText(
        snapshot.winnerName ? `${snapshot.winnerName} 獲勝！` : "平局",
      );
    } else if (this.endedBanner) {
      this.endedBanner.destroy();
      this.endedBanner = null;
    }

    this.prevSnapshot = snapshot;
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
