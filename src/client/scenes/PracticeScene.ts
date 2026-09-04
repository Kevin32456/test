import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";
import { setMusicMode } from "../audio/AudioEngine";
import { CHARACTERS, getCharacter } from "@shared/characters";
import {
  GAME,
  arenaCenter,
  clampToArena,
  distance,
  slideCircleWall,
} from "@shared/constants";
import { pixelTextStyle, PIXEL_FONT_SIZES } from "@shared/fonts";
import { characterText, t } from "../i18n";

export interface PracticeSceneData {
  characterId?: string;
}

type PracticeStep = "move" | "blink" | "pass" | "complete";

interface Point {
  x: number;
  y: number;
}

/**
 * 單人教學房：只驗證輸入與回饋，不建立 Socket.IO 房間，也不影響正式多人規則。
 * 物理數值沿用 shared constants，避免玩家在教學學到另一套操作手感。
 */
export class PracticeScene extends Phaser.Scene {
  private characterId = CHARACTERS[0]!.id;
  private player: Point = { x: 0, y: 0 };
  private playerTarget: Point = { x: 0, y: 0 };
  private partner: Point = { x: 0, y: 0 };
  private dog: Point & { vx: number; vy: number; angle: number } = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
  };
  private ball = { x: 0, y: 0, targetX: 0, targetY: 0, inFlight: false };
  private ballHolder: "player" | "partner" | null = "player";
  private partnerHasBall = false;
  private blinkCooldownMs = 0;
  private holdTimeSec = 0;
  private practiceStep: PracticeStep = "move";
  private moveCommandIssued = false;
  private movementStart: Point = { x: 0, y: 0 };
  private playerSprite!: Phaser.GameObjects.Container;
  private partnerSprite!: Phaser.GameObjects.Container;
  private dogSprite!: Phaser.GameObjects.Container;
  private ballSprite!: Phaser.GameObjects.Arc;
  private ballGlow!: Phaser.GameObjects.Arc;
  private moveMarker!: Phaser.GameObjects.Arc;
  private partnerRing!: Phaser.GameObjects.Arc;
  private threatBar!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private stepPanel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private practiceComplete!: Phaser.GameObjects.Text;
  private replayAction!: Phaser.GameObjects.Text;
  private exitAction!: Phaser.GameObjects.Text;
  private pulseT = 0;

  constructor() {
    super("PracticeScene");
  }

  create(data: PracticeSceneData = {}) {
    const selected = getCharacter(data.characterId);
    this.characterId = selected?.id ?? CHARACTERS[0]!.id;

    const c = arenaCenter();
    this.player = { x: c.x, y: c.y + 230 };
    this.playerTarget = { ...this.player };
    this.movementStart = { ...this.player };
    this.partner = { x: c.x, y: c.y - 210 };
    this.dog = { x: c.x, y: c.y, vx: 0, vy: 0, angle: -Math.PI / 2 };
    this.ball = {
      x: this.player.x,
      y: this.player.y - GAME.BALL_HOVER_OFFSET,
      targetX: this.player.x,
      targetY: this.player.y - GAME.BALL_HOVER_OFFSET,
      inFlight: false,
    };
    this.ballHolder = "player";
    this.partnerHasBall = false;
    this.blinkCooldownMs = 0;
    this.holdTimeSec = 0;
    this.practiceStep = "move";
    this.moveCommandIssued = false;
    this.pulseT = 0;

    Sfx.unlock();
    setMusicMode("practice");
    this.drawArena();
    this.createActors();
    this.createUi();
    this.bindInput();
    this.renderProgress();
    document.querySelector("#app")?.setAttribute("data-active-scene", "practice");
  }

  shutdown() {
    setMusicMode("lobby");
    this.input.off("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.off("keydown-SPACE", this.handleSpace, this);
    this.input.keyboard?.off("keydown-ESC", this.handleEscape, this);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.pulseT += delta;
    this.blinkCooldownMs = Math.max(0, this.blinkCooldownMs - delta);

    this.updatePlayer(dt);
    this.updateBall(dt);
    this.updateDog(dt);
    this.updateHoldTime(dt);
    this.updateVisuals();

    if (
      this.practiceStep === "move" &&
      this.moveCommandIssued &&
      distance(this.player.x, this.player.y, this.movementStart.x, this.movementStart.y) >= 32
    ) {
      this.advanceTo("blink");
    }
  }

  private createActors() {
    this.playerSprite = this.createCharacterSprite(this.characterId, this.player, t("yourRole"));
    const partnerId = this.characterId === "coat" ? "hat" : "coat";
    this.partnerSprite = this.createCharacterSprite(
      partnerId,
      this.partner,
      `${characterText(partnerId, 0)} · ${t("practiceLobby")}`,
    );

    this.dogSprite = this.add.container(this.dog.x, this.dog.y).setDepth(30);
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

    this.partnerRing = this.add
      .circle(this.partner.x, this.partner.y, GAME.PLAYER_RADIUS + 18, 0x000000, 0)
      .setStrokeStyle(3, 0x80deea, 0.95)
      .setDepth(35)
      .setVisible(false);

    this.moveMarker = this.add
      .circle(0, 0, 10, 0xffffff, 0)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setDepth(5)
      .setVisible(false);
  }

  private createCharacterSprite(id: string, position: Point, labelText: string) {
    const container = this.add.container(position.x, position.y).setDepth(25);
    const avatar = this.add.image(0, 2, `char-${id}`);
    avatar.setDisplaySize(39, 52).setOrigin(0.5, 0.8);
    container.add(avatar);
    const label = this.add
      .text(0, -42, labelText, pixelTextStyle(PIXEL_FONT_SIZES.xs, { color: "#ffffff" }))
      .setOrigin(0.5);
    container.add(label);
    return container;
  }

  private createUi() {
    this.threatBar = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.hud = this.add
      .text(12, 12, "", pixelTextStyle(PIXEL_FONT_SIZES.xs, {
        color: "#e8eaed",
        backgroundColor: "rgba(10,12,16,0.78)",
        padding: { x: 10, y: 8 },
      }))
      .setScrollFactor(0)
      .setDepth(100);

    this.stepPanel = this.add
      .text(GAME.ARENA_WIDTH / 2, 38, "", pixelTextStyle(PIXEL_FONT_SIZES.md, {
        color: "#fff4cf",
        backgroundColor: "rgba(16,18,24,0.88)",
        padding: { x: 18, y: 10 },
        align: "center",
      }))
      .setOrigin(0.5, 0)
      .setDepth(102);

    this.statusText = this.add
      .text(GAME.ARENA_WIDTH / 2, GAME.ARENA_HEIGHT - 68, "", pixelTextStyle(PIXEL_FONT_SIZES.xs, {
        color: "#d5d7e5",
        backgroundColor: "rgba(16,18,24,0.82)",
        padding: { x: 12, y: 7 },
        align: "center",
      }))
      .setOrigin(0.5)
      .setDepth(102);

    this.practiceComplete = this.add
      .text(
        GAME.ARENA_WIDTH / 2,
        GAME.ARENA_HEIGHT / 2,
        t("practiceComplete"),
        pixelTextStyle(PIXEL_FONT_SIZES.lg, {
          color: "#ffffff",
          backgroundColor: "rgba(16,18,24,0.94)",
          padding: { x: 28, y: 22 },
          align: "center",
        }),
      )
      .setOrigin(0.5)
      .setDepth(200)
      .setVisible(false);

    this.replayAction = this.add
      .text(GAME.ARENA_WIDTH / 2 - 100, GAME.ARENA_HEIGHT / 2 + 92, t("practiceReplay"), this.actionTextStyle())
      .setOrigin(0.5)
      .setDepth(201)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
      .on("pointerdown", () => this.restartPractice());

    this.exitAction = this.add
      .text(GAME.ARENA_WIDTH / 2 + 100, GAME.ARENA_HEIGHT / 2 + 92, t("practiceLobby"), this.actionTextStyle())
      .setOrigin(0.5)
      .setDepth(201)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.exitToLobby());
  }

  private actionTextStyle() {
    return pixelTextStyle(PIXEL_FONT_SIZES.sm, {
      color: "#fff0c4",
      backgroundColor: "rgba(181,58,40,0.9)",
      padding: { x: 14, y: 8 },
    });
  }

  private bindInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.keyboard?.on("keydown-SPACE", this.handleSpace, this);
    this.input.keyboard?.on("keydown-ESC", this.handleEscape, this);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    Sfx.unlock();
    if (pointer.button !== 2 || this.practiceStep === "complete") return;

    const clickedPartner =
      this.practiceStep === "pass" &&
      !this.ball.inFlight &&
      this.ballHolder === "player" &&
      distance(pointer.worldX, pointer.worldY, this.partner.x, this.partner.y) <= GAME.PASS_PICK_RADIUS;

    if (clickedPartner) {
      this.startPass();
      return;
    }

    const target = clampToArena(pointer.worldX, pointer.worldY, GAME.PLAYER_RADIUS);
    this.playerTarget = target;
    this.showMoveMarker(target.x, target.y);
    if (this.practiceStep === "move" && !this.moveCommandIssued) {
      this.moveCommandIssued = true;
      this.movementStart = { ...this.player };
      this.statusText.setText(t("practiceMoveStarted"));
    }
  }

  private handleSpace(event: KeyboardEvent) {
    event.preventDefault();
    Sfx.unlock();
    if (this.practiceStep === "complete" || this.blinkCooldownMs > 0) return;

    const pointer = this.input.activePointer;
    let dx = pointer.worldX - this.player.x;
    let dy = pointer.worldY - this.player.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      dx = 0;
      dy = -1;
    }
    const safeLength = Math.hypot(dx, dy) || 1;
    const blinked = clampToArena(
      this.player.x + (dx / safeLength) * GAME.BLINK_DISTANCE,
      this.player.y + (dy / safeLength) * GAME.BLINK_DISTANCE,
      GAME.PLAYER_RADIUS,
    );
    const moved = distance(this.player.x, this.player.y, blinked.x, blinked.y);
    if (moved < 20) return;

    this.player.x = blinked.x;
    this.player.y = blinked.y;
    this.playerTarget = { ...blinked };
    this.blinkCooldownMs = GAME.BLINK_COOLDOWN_MS;
    Sfx.blink();
    this.showMoveMarker(blinked.x, blinked.y);
    if (this.practiceStep === "blink") {
      this.advanceTo("pass");
    } else {
      this.statusText.setText(t("practiceBlinkSuccess", {
        seconds: Math.ceil(this.blinkCooldownMs / 1000),
      }));
    }
  }

  private handleEscape() {
    this.exitToLobby();
  }

  private updatePlayer(dt: number) {
    const dx = this.playerTarget.x - this.player.x;
    const dy = this.playerTarget.y - this.player.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;
    const step = Math.min(length, GAME.PLAYER_SPEED * dt);
    const next = clampToArena(
      this.player.x + (dx / length) * step,
      this.player.y + (dy / length) * step,
      GAME.PLAYER_RADIUS,
    );
    this.player.x = next.x;
    this.player.y = next.y;
    if (this.ballHolder === "player" && !this.ball.inFlight) {
      this.ball.x = this.player.x;
      this.ball.y = this.player.y - GAME.BALL_HOVER_OFFSET;
    }
  }

  private updateBall(dt: number) {
    if (!this.ball.inFlight) return;
    const dx = this.ball.targetX - this.ball.x;
    const dy = this.ball.targetY - this.ball.y;
    const length = Math.hypot(dx, dy);
    if (length <= GAME.BALL_ARRIVE_DIST) {
      this.ball.inFlight = false;
      this.ballHolder = "partner";
      this.partnerHasBall = true;
      this.ball.x = this.partner.x;
      this.ball.y = this.partner.y - GAME.BALL_HOVER_OFFSET;
      Sfx.pass();
      this.advanceTo("complete");
      return;
    }
    const step = Math.min(length, GAME.BALL_FLIGHT_SPEED * dt);
    this.ball.x += (dx / length) * step;
    this.ball.y += (dy / length) * step;
  }

  private updateDog(dt: number) {
    const target = this.ballHolder === "partner" ? this.partner : this.player;
    const dx = target.x - this.dog.x;
    const dy = target.y - this.dog.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const speed = Math.min(GAME.DOG_BASE_SPEED * 0.72, 98);
    const desiredVx = (dx / length) * speed;
    const desiredVy = (dy / length) * speed;
    this.dog.vx += (desiredVx - this.dog.vx) * Math.min(1, dt * 4);
    this.dog.vy += (desiredVy - this.dog.vy) * Math.min(1, dt * 4);
    const next = slideCircleWall(
      this.dog.x + this.dog.vx * dt,
      this.dog.y + this.dog.vy * dt,
      this.dog.vx,
      this.dog.vy,
      GAME.DOG_RADIUS,
      GAME.DOG_WALL_SLIDE,
    );
    this.dog.x = next.x;
    this.dog.y = next.y;
    this.dog.vx = next.vx;
    this.dog.vy = next.vy;
    this.dog.angle = Math.atan2(this.dog.vy, this.dog.vx);
  }

  private updateHoldTime(dt: number) {
    if (this.ballHolder && !this.ball.inFlight) {
      this.holdTimeSec += dt;
    }
  }

  private updateVisuals() {
    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.partnerSprite.setPosition(this.partner.x, this.partner.y);
    this.dogSprite.setPosition(this.dog.x, this.dog.y).setRotation(this.dog.angle);

    const showBall = this.ballHolder !== null || this.ball.inFlight;
    this.ballSprite.setVisible(showBall).setPosition(this.ball.x, this.ball.y);
    this.ballGlow.setVisible(showBall).setPosition(this.ball.x, this.ball.y);

    const partnerTarget = this.practiceStep === "pass" && !this.ball.inFlight;
    this.partnerRing
      .setVisible(partnerTarget)
      .setPosition(this.partner.x, this.partner.y)
      .setScale(1 + 0.08 * Math.sin(this.pulseT * 0.012));

    const pressurePct = Math.round(
      Math.min(1, this.holdTimeSec / GAME.DOG_PRESSURE_BAR_SEC) * 100,
    );
    const cd = Math.ceil(this.blinkCooldownMs / 1000);
    const holderText = this.ballHolder === "player" ? t("practiceYouBall") : t("practicePartnerBall");
    this.hud.setText(
      [
        t("practiceHud"),
        `${holderText} · ${t("hudHold", { hold: this.holdTimeSec.toFixed(1), pressure: pressurePct })}`,
        `Blink CD ${cd}s · ${t("practiceEsc")}`,
      ].join("\n"),
    );

    this.threatBar.clear();
    const x = 12;
    const y = 92;
    const w = 160;
    const h = 8;
    this.threatBar.fillStyle(0x2a3140, 0.9).fillRoundedRect(x, y, w, h, 4);
    this.threatBar
      .fillStyle(pressurePct < 45 ? 0x66bb6a : pressurePct < 75 ? 0xffa726 : 0xef5350, 0.95)
      .fillRoundedRect(x, y, Math.max(4, (w * pressurePct) / 100), h, 4);
  }

  private renderProgress() {
    const text =
      this.practiceStep === "move"
        ? `${t("practiceMoveTitle")}\n${t("practiceMoveHint")}`
        : this.practiceStep === "blink"
          ? `${t("practiceBlinkTitle")}\n${t("practiceBlinkHint")}`
          : this.practiceStep === "pass"
            ? `${t("practicePassTitle")}\n${t("practicePassHint")}`
            : `${t("practiceCompleteTitle")}\n${t("practiceCompleteHint")}`;
    this.stepPanel.setText(text);

    if (this.practiceStep === "move") {
      this.statusText.setText(t("practiceMoveProgress"));
    } else if (this.practiceStep === "blink") {
      this.statusText.setText(t("practiceBlinkProgress"));
    } else if (this.practiceStep === "pass") {
      this.statusText.setText(t("practicePassTip"));
    } else {
      this.statusText.setText(t("guideSurvive"));
    }

    const complete = this.practiceStep === "complete";
    this.practiceComplete.setVisible(complete);
    this.replayAction.setVisible(complete);
    this.exitAction.setPosition(
      complete ? GAME.ARENA_WIDTH / 2 + 100 : 112,
      complete ? GAME.ARENA_HEIGHT / 2 + 92 : GAME.ARENA_HEIGHT - 30,
    );
    this.exitAction.setText(complete ? t("practiceLobby") : t("practiceEsc"));
  }

  private advanceTo(step: PracticeStep) {
    this.practiceStep = step;
    this.moveCommandIssued = false;
    if (step === "blink") {
      Sfx.countdown();
    } else if (step === "pass") {
      Sfx.countdown();
    } else if (step === "complete") {
      Sfx.win();
    }
    this.renderProgress();
  }

  private startPass() {
    this.ballHolder = null;
    this.partnerHasBall = false;
    this.ball.inFlight = true;
    this.ball.x = this.player.x;
    this.ball.y = this.player.y - GAME.BALL_HOVER_OFFSET;
    this.ball.targetX = this.partner.x;
    this.ball.targetY = this.partner.y - GAME.BALL_HOVER_OFFSET;
    this.partnerRing.setVisible(false);
    Sfx.pass();
    this.statusText.setText(t("practicePassFlight"));
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

  private restartPractice() {
    this.scene.restart({ characterId: this.characterId });
  }

  private exitToLobby() {
    this.game.events.emit("practice-exit");
  }

  private drawArena() {
    const g = this.add.graphics();
    const c = arenaCenter();
    const r = GAME.ARENA_RADIUS;

    g.fillStyle(0x0f1118, 1);
    g.fillRect(0, 0, GAME.ARENA_WIDTH, GAME.ARENA_HEIGHT);
    g.fillStyle(0x1b2430, 1);
    g.fillCircle(c.x, c.y, r);
    g.lineStyle(1, 0x253041, 0.35);
    for (let i = 1; i <= 3; i++) {
      g.strokeCircle(c.x, c.y, (r * i) / 3);
    }
    g.lineStyle(4, 0x3d4f68, 1);
    g.strokeCircle(c.x, c.y, r);
    g.lineStyle(2, 0xe0503a, 0.35);
    g.strokeCircle(c.x, c.y, r - 2);
  }
}
