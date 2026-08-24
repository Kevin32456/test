import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";
import { expLerp, expLerpAngle } from "../interpolation";
import { CHARACTERS, getCharacter } from "@shared/characters";
import { GAME, arenaCenter } from "@shared/constants";
import {
  DEFAULT_ARENA_ID,
  getArena,
  getArenaStageDefinition,
  isValidArenaId,
  type ArenaId,
  type ArenaStage,
} from "@shared/arenas";
import { pixelTextStyle, PIXEL_FONT_SIZES } from "@shared/fonts";
import type { GameSnapshot, PlayerState } from "@shared/types";
import {
  getLatestSnapshot,
  getPlayerId,
  sendAction,
  subscribeState,
} from "../network";
import { characterCanvas, dogCanvas } from "../pixelArt";

interface DisplayPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
}


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
  private arenaLayer: Phaser.GameObjects.Graphics | null = null;
  private arenaId: ArenaId = DEFAULT_ARENA_ID;
  private arenaStage: ArenaStage = "teach";
  private arenaStageBanner: Phaser.GameObjects.Text | null = null;
  private hud!: Phaser.GameObjects.Text;
  private threatBar!: Phaser.GameObjects.Graphics;
  private countdownBanner: Phaser.GameObjects.Text | null = null;
  private countdownHint!: Phaser.GameObjects.Text;
  private deathPauseOverlay: Phaser.GameObjects.Rectangle | null = null;
  private deathPauseBanner: Phaser.GameObjects.Text | null = null;
  private endedBanner: Phaser.GameObjects.Text | null = null;
  private unsubState: (() => void) | null = null;
  private prevSnapshot: GameSnapshot | null = null;
  private lastMatchSeq = 0;
  private lastCountdownBeep = -1;
  private displayBall = { x: 0, y: 0, tx: 0, ty: 0 };
  private pulseT = 0;
  private passHoverRing!: Phaser.GameObjects.Arc;
  private passHoverHint!: Phaser.GameObjects.Text;
  private hoveredPassId: string | null = null;

  constructor() {
    super("GameScene");
  }

  preload() {
    // 角色 PNG 尚未隨專案提供；create() 會使用程式繪製的 canvas fallback。
    // 不預載不存在的檔案，避免瀏覽器 console 產生誤導性的 asset errors。
  }

  create() {
    Sfx.unlock();
    this.drawArena(DEFAULT_ARENA_ID, "teach");

    for (const c of CHARACTERS) {
      const key = `char-${c.id}`;
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, characterCanvas(c.id, 4));
      }
    }
    if (!this.textures.exists("dog-collie")) {
      this.textures.addCanvas("dog-collie", dogCanvas(4));
    }

    this.dogSprite = this.add.container(0, 0);
    const dogImage = this.add.image(0, 0, "dog-collie");
    dogImage.setDisplaySize(56, 32);
    this.dogSprite.add(dogImage);

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
      .text(12, 12, "", pixelTextStyle(PIXEL_FONT_SIZES.xs, {
        color: "#e8eaed",
        backgroundColor: "rgba(10,12,16,0.72)",
        padding: { x: 10, y: 8 },
      }))
      .setScrollFactor(0)
      .setDepth(100);

    this.countdownHint = this.add
      .text(
        GAME.ARENA_WIDTH / 2,
        GAME.ARENA_HEIGHT / 2 + 72,
        "目標：活到最後\n右鍵走位／持球點隊友傳球\nSpace：Blink",
        pixelTextStyle(PIXEL_FONT_SIZES.xs, {
          color: "#d5d7e5",
          backgroundColor: "rgba(16,18,24,0.82)",
          padding: { x: 12, y: 8 },
          align: "center",
        }),
      )
      .setOrigin(0.5)
      .setDepth(299)
      .setVisible(false);

    this.passHoverRing = this.add
      .circle(0, 0, GAME.PLAYER_RADIUS + 16, 0x000000, 0)
      .setStrokeStyle(3, 0x80deea, 0.95)
      .setDepth(35)
      .setVisible(false);
    this.passHoverHint = this.add
      .text(0, 0, "可傳球", pixelTextStyle(PIXEL_FONT_SIZES.xs, {
        color: "#b2ebf2",
        backgroundColor: "rgba(10,16,20,0.78)",
        padding: { x: 6, y: 3 },
      }))
      .setOrigin(0.5)
      .setDepth(36)
      .setVisible(false);

    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      Sfx.unlock();
      if (pointer.button !== 2) return;
      this.handleRightClick(pointer.worldX, pointer.worldY);
    });

    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault();
      Sfx.unlock();
      const snapshot = getLatestSnapshot();
      if (!snapshot || snapshot.deathPauseMs > 0) return;
      const me = this.getMe();
      if (!me || !me.alive) return;
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
    this.playerSprites.clear();
    this.playerLabels.clear();
    this.holderRings.clear();
    this.displayPlayers.clear();
    this.hoveredPassId = null;
    this.arenaLayer?.destroy();
    this.arenaLayer = null;
    this.arenaStageBanner?.destroy();
    this.arenaStageBanner = null;
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
    this.updatePassHover(snapshot);
  }

  private drawThreatBar(snapshot: GameSnapshot) {
    const g = this.threatBar;
    g.clear();
    if (snapshot.phase !== "playing") return;

    const ratio = clamp01(snapshot.dogPressureSec / GAME.DOG_PRESSURE_BAR_SEC);
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

  private drawArena(arenaId: ArenaId, stage: ArenaStage) {
    this.arenaLayer?.destroy();
    this.arenaId = arenaId;
    this.arenaStage = stage;

    const arena = getArena(arenaId);
    const palette = arena.palette;
    const g = this.add.graphics().setDepth(-10);
    this.arenaLayer = g;
    const c = arenaCenter();
    const r = GAME.ARENA_RADIUS;

    g.fillStyle(palette.background, 1);
    g.fillRect(0, 0, GAME.ARENA_WIDTH, GAME.ARENA_HEIGHT);

    g.fillStyle(palette.floor, 1);
    g.fillCircle(c.x, c.y, r);

    g.lineStyle(4, palette.border, 1);
    g.strokeCircle(c.x, c.y, r);

    if (arena.style === "vermilion-court") {
      g.lineStyle(1, palette.grid, 0.35);
      for (let i = 1; i <= 3; i++) {
        g.strokeCircle(c.x, c.y, (r * i) / 3);
      }
      g.lineStyle(2, palette.accent, 0.35);
      g.strokeCircle(c.x, c.y, r - 2);
      return;
    }

    // 月影庭以路標與斜切動線改變讀圖；路標是純視覺，不加入碰撞。
    g.lineStyle(2, palette.grid, 0.42);
    g.strokeCircle(c.x, c.y, r * 0.52);
    g.lineStyle(2, palette.accent, 0.2);
    g.strokeCircle(c.x, c.y, r * 0.78);

    const routePoints = [
      { x: c.x, y: c.y - r * 0.55 },
      { x: c.x + r * 0.55, y: c.y },
      { x: c.x, y: c.y + r * 0.55 },
      { x: c.x - r * 0.55, y: c.y },
    ];
    const drawPath = (points: { x: number; y: number }[], alpha: number) => {
      if (points.length < 2) return;
      g.lineStyle(3, palette.accent, alpha);
      g.beginPath();
      g.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) {
        g.lineTo(point.x, point.y);
      }
      g.strokePath();
    };

    if (stage === "teach") {
      drawPath([routePoints[2]!, { x: c.x, y: c.y }, routePoints[0]!], 0.55);
    } else if (stage === "test") {
      drawPath([...routePoints, routePoints[0]!], 0.28);
    } else if (stage === "twist") {
      drawPath([routePoints[0]!, routePoints[2]!], 0.5);
      drawPath([routePoints[1]!, routePoints[3]!], 0.5);
    } else {
      drawPath([...routePoints, routePoints[0]!], 0.22);
      drawPath([routePoints[0]!, routePoints[2]!], 0.18);
      drawPath([routePoints[1]!, routePoints[3]!], 0.18);
    }

    const activePoints =
      stage === "teach" ? new Set([0, 2]) : new Set([0, 1, 2, 3]);

    for (const [index, point] of routePoints.entries()) {
      const active = activePoints.has(index);
      g.fillStyle(palette.landmark, active ? 0.2 : 0.08);
      g.fillCircle(point.x, point.y, 34);
      g.lineStyle(2, palette.landmark, active ? 0.7 : 0.24);
      g.strokeCircle(point.x, point.y, 24);
      g.lineStyle(2, palette.accent, active ? 0.24 : 0.1);
      g.strokeCircle(point.x, point.y, 34);
    }

    g.fillStyle(palette.accent, 0.14);
    g.fillCircle(c.x, c.y, 34);
    g.lineStyle(2, palette.accent, 0.55);
    g.strokeCircle(c.x, c.y, 22);
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
    if (
      !snapshot ||
      snapshot.phase !== "playing" ||
      snapshot.deathPauseMs > 0
    ) {
      return;
    }

    const me = this.getMe();
    if (!me || !me.alive) return;

    if (me.hasBall && !snapshot.ball.inFlight) {
      const target = this.findPlayerAt(wx, wy, snapshot.players, me.id);
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
    exceptId?: string,
  ): PlayerState | null {
    let found: PlayerState | null = null;
    let best = Infinity;
    for (const p of players) {
      if (!p.alive || p.id === exceptId) continue;
      const dp = this.displayPlayers.get(p.id);
      const x = dp?.x ?? p.x;
      const y = dp?.y ?? p.y;
      const d = Phaser.Math.Distance.Between(wx, wy, x, y);
      if (d <= GAME.PASS_PICK_RADIUS && d < best) {
        best = d;
        found = p;
      }
    }
    return found;
  }

  private updatePassHover(snapshot: GameSnapshot) {
    const me = this.getMe();
    const pointer = this.input.activePointer;
    const canPass =
      snapshot.phase === "playing" &&
      snapshot.deathPauseMs <= 0 &&
      !!me?.alive &&
      me.hasBall &&
      !snapshot.ball.inFlight;

    const target = canPass
      ? this.findPlayerAt(pointer.worldX, pointer.worldY, snapshot.players, me.id)
      : null;

    if (this.hoveredPassId && this.hoveredPassId !== target?.id) {
      this.playerSprites.get(this.hoveredPassId)?.setScale(1);
    }
    this.hoveredPassId = target?.id ?? null;

    if (!target) {
      this.passHoverRing.setVisible(false);
      this.passHoverHint.setVisible(false);
      this.input.setDefaultCursor("default");
      return;
    }

    const dp = this.displayPlayers.get(target.id);
    const x = dp?.x ?? target.x;
    const y = dp?.y ?? target.y;
    const pulse = 1 + 0.07 * Math.sin(this.pulseT * 0.014);
    this.playerSprites.get(target.id)?.setScale(1.08);
    this.passHoverRing.setPosition(x, y).setScale(pulse).setVisible(true);
    this.passHoverHint.setPosition(x, y - 64).setVisible(true);
    this.input.setDefaultCursor("pointer");
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

  private removePlayerVisuals(id: string) {
    const container = this.playerSprites.get(id);
    if (container) {
      this.tweens.killTweensOf(container);
      container.destroy(true);
    }
    this.playerLabels.get(id)?.destroy();
    this.holderRings.get(id)?.destroy();
    this.playerSprites.delete(id);
    this.playerLabels.delete(id);
    this.holderRings.delete(id);
    this.displayPlayers.delete(id);
    if (this.hoveredPassId === id) this.hoveredPassId = null;
  }

  private resetRoundVisuals() {
    if (this.endedBanner) {
      this.endedBanner.destroy();
      this.endedBanner = null;
    }
    if (this.arenaStageBanner) {
      this.tweens.killTweensOf(this.arenaStageBanner);
      this.arenaStageBanner.destroy();
      this.arenaStageBanner = null;
    }
    this.lastCountdownBeep = -1;
  }

  private showArenaStageBanner(stage: ArenaStage) {
    const definition = getArenaStageDefinition(stage);
    if (!this.arenaStageBanner) {
      this.arenaStageBanner = this.add
        .text(GAME.ARENA_WIDTH / 2, 132, "", pixelTextStyle(PIXEL_FONT_SIZES.xs, {
          color: "#fff4cf",
          backgroundColor: "rgba(16,18,24,0.88)",
          padding: { x: 14, y: 8 },
          align: "center",
        }))
        .setOrigin(0.5)
        .setDepth(105);
    }

    this.tweens.killTweensOf(this.arenaStageBanner);
    this.arenaStageBanner
      .setText(`${getArena(this.arenaId).name} · ${definition.title}\n${definition.prompt}`)
      .setAlpha(1)
      .setVisible(true);
    this.tweens.add({
      targets: this.arenaStageBanner,
      delay: 1800,
      duration: 700,
      alpha: 0,
      onComplete: () => this.arenaStageBanner?.setVisible(false),
    });
  }

  private applySnapshot(snapshot: GameSnapshot) {
    const nextStage = snapshot.arenaStage ?? "teach";
    const nextArenaId = isValidArenaId(snapshot.arenaId)
      ? snapshot.arenaId
      : DEFAULT_ARENA_ID;
    const arenaChanged = nextArenaId !== this.arenaId;
    const stageChanged = nextStage !== this.arenaStage;
    if (arenaChanged || stageChanged) {
      this.drawArena(nextArenaId, nextStage);
    }
    if (
      stageChanged ||
      (snapshot.phase === "countdown" && this.prevSnapshot?.phase !== "countdown")
    ) {
      this.showArenaStageBanner(nextStage);
      Sfx.arenaStage(nextStage);
    }

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
      this.countdownHint.setText(
        `場地：${getArena(this.arenaId).name}\n${getArenaStageDefinition(this.arenaStage).title}\n目標：活到最後\n右鍵走位／持球點隊友傳球\nSpace：Blink`,
      );
      if (!this.countdownBanner) {
        this.countdownBanner = this.add
          .text(GAME.ARENA_WIDTH / 2, GAME.ARENA_HEIGHT / 2, "", pixelTextStyle(PIXEL_FONT_SIZES.countdown, {
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 6,
          }))
          .setOrigin(0.5)
          .setDepth(300);
      }
      this.countdownBanner.setText(sec > 0 ? String(sec) : "開始！");
      this.countdownBanner.setVisible(true);
      this.countdownHint.setVisible(true);
    } else if (this.countdownBanner) {
      this.countdownBanner.setVisible(false);
      this.countdownHint.setVisible(false);
    }

    if (snapshot.deathPauseMs > 0) {
      if (!this.deathPauseOverlay) {
        this.deathPauseOverlay = this.add
          .rectangle(
            GAME.ARENA_WIDTH / 2,
            GAME.ARENA_HEIGHT / 2,
            GAME.ARENA_WIDTH,
            GAME.ARENA_HEIGHT,
            0x000000,
            0.42,
          )
          .setDepth(180);
      }
      if (!this.deathPauseBanner) {
        this.deathPauseBanner = this.add
          .text(
            GAME.ARENA_WIDTH / 2,
            GAME.ARENA_HEIGHT / 2,
            "",
            pixelTextStyle(PIXEL_FONT_SIZES.md, {
              color: "#ffffff",
              backgroundColor: "rgba(16,18,24,0.9)",
              padding: { x: 28, y: 20 },
              align: "center",
            }),
          )
          .setOrigin(0.5)
          .setDepth(181);
      }

      const sec = Math.max(1, Math.ceil(snapshot.deathPauseMs / 1000));
      this.deathPauseOverlay.setVisible(true);
      this.deathPauseBanner
        .setText(
          `${snapshot.eliminatedPlayerName ?? "玩家"} 出局！\n${sec} 秒後重新傳球`,
        )
        .setVisible(true);
    } else {
      this.deathPauseOverlay?.setVisible(false);
      this.deathPauseBanner?.setVisible(false);
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
          avatar.setDisplaySize(39, 52);
          avatar.setOrigin(0.5, 0.8);
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
          .text(0, -42, p.name, pixelTextStyle(PIXEL_FONT_SIZES.xs, {
            color: "#ffffff",
          }))
          .setOrigin(0.5);
        this.playerLabels.set(p.id, label);
      }

      container.setAlpha(p.alive ? 1 : 0.32);

      const label = this.playerLabels.get(p.id)!;
      label.setText(p.name + (p.id === getPlayerId() ? "（你）" : ""));
    }

    const liveIds = new Set(snapshot.players.map((p) => p.id));
    for (const id of [...this.displayPlayers.keys()]) {
      if (liveIds.has(id)) continue;
      this.removePlayerVisuals(id);
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
      (snapshot.ball.inFlight ||
        snapshot.ballHolderId !== null ||
        snapshot.deathPauseMs > 0);

    this.ballSprite.setVisible(showBall);
    this.ballGlow.setVisible(showBall);

    const me = this.getMe();
    const aliveCount = snapshot.players.filter((p) => p.alive).length;
    const cd = me ? Math.ceil(me.blinkCooldownMs / 1000) : 0;
    const pressurePct = Math.round(
      (snapshot.dogPressureSec / GAME.DOG_PRESSURE_BAR_SEC) * 100,
    );

    let ballHint = "";
    if (snapshot.deathPauseMs > 0) {
      ballHint = "死亡停頓 — 全場暫停";
    } else if (snapshot.ball.inFlight) {
      ballHint = "球飛行中 — 狗仍追球";
    } else if (me?.hasBall) {
      ballHint = `你持球：右鍵點人傳球 · Blink CD ${cd}s`;
    } else if (me?.alive) {
      ballHint = `Blink <Space> · CD ${cd}s`;
    } else {
      ballHint = "觀戰中";
    }

    const controlHint = "右鍵移動／傳球 · Space Blink";

    this.hud.setText(
      [
        `存活 ${aliveCount}/${snapshot.players.length}`,
        `持球 ${snapshot.holdTimeSec.toFixed(1)}s · 狗壓 ${pressurePct}%`,
        ballHint,
        controlHint,
      ].join("\n"),
    );

    if (snapshot.phase === "ended") {
      if (!this.endedBanner) {
        this.endedBanner = this.add
          .text(GAME.ARENA_WIDTH / 2, GAME.ARENA_HEIGHT / 2, "", pixelTextStyle(PIXEL_FONT_SIZES.md, {
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.65)",
            padding: { x: 24, y: 16 },
          }))
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
