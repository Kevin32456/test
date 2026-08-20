import Phaser from "phaser";
import { GAME } from "@shared/constants";
import type { GameSnapshot, PlayerState } from "@shared/types";
import { getLatestSnapshot, getPlayerId, getSocket, sendAction } from "../network";

export class GameScene extends Phaser.Scene {
  private playerSprites = new Map<string, Phaser.GameObjects.Container>();
  private playerLabels = new Map<string, Phaser.GameObjects.Text>();
  private dogSprite!: Phaser.GameObjects.Container;
  private ballSprite!: Phaser.GameObjects.Arc;
  private hud!: Phaser.GameObjects.Text;
  private endedBanner: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("GameScene");
  }

  create() {
    this.drawArena();
    this.dogSprite = this.add.container(0, 0);
    const dogBody = this.add.circle(0, 0, GAME.DOG_RADIUS, 0xe53935);
    const dogEar = this.add.triangle(0, -8, 0, -18, -10, 4, 10, 4, 0xff7043);
    const dogTail = this.add.rectangle(-16, 4, 14, 5, 0xffab91);
    dogTail.setAngle(-20);
    this.dogSprite.add([dogTail, dogBody, dogEar]);

    this.ballSprite = this.add.circle(0, 0, 8, 0xffeb3b).setStrokeStyle(2, 0xf57f17);

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
      if (pointer.button !== 2) return;
      this.handleRightClick(pointer.worldX, pointer.worldY);
    });

    this.input.keyboard?.on("keydown-SPACE", (event: KeyboardEvent) => {
      event.preventDefault();
      const me = this.getMe();
      if (!me || !me.alive || me.hasBall) return;
      const pointer = this.input.activePointer;
      sendAction({ type: "blink", x: pointer.worldX, y: pointer.worldY });
    });

    getSocket().on("state", (snapshot: GameSnapshot) => {
      this.applySnapshot(snapshot);
    });

    const initial = getLatestSnapshot();
    if (initial) this.applySnapshot(initial);
  }

  private drawArena() {
    const g = this.add.graphics();
    g.fillStyle(0x1b2430, 1);
    g.fillRect(0, 0, GAME.ARENA_WIDTH, GAME.ARENA_HEIGHT);
    g.lineStyle(4, 0x3d4f68, 1);
    g.strokeRect(2, 2, GAME.ARENA_WIDTH - 4, GAME.ARENA_HEIGHT - 4);

    g.lineStyle(1, 0x253041, 0.5);
    for (let x = 0; x <= GAME.ARENA_WIDTH; x += 60) {
      g.lineBetween(x, 0, x, GAME.ARENA_HEIGHT);
    }
    for (let y = 0; y <= GAME.ARENA_HEIGHT; y += 60) {
      g.lineBetween(0, y, GAME.ARENA_WIDTH, y);
    }
  }

  private handleRightClick(wx: number, wy: number) {
    const me = this.getMe();
    if (!me || !me.alive) return;

    if (me.hasBall) {
      const target = this.findPlayerAt(wx, wy, getLatestSnapshot()?.players ?? []);
      if (target && target.alive && target.id !== me.id) {
        sendAction({ type: "pass", targetId: target.id });
        return;
      }
    }

    sendAction({ type: "move", x: wx, y: wy });
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
      if (d <= GAME.PLAYER_RADIUS + 8 && d < best) {
        best = d;
        found = p;
      }
    }
    return found;
  }

  private getMe() {
    return getLatestSnapshot()?.players.find((p) => p.id === getPlayerId());
  }

  private applySnapshot(snapshot: GameSnapshot) {
    for (const p of snapshot.players) {
      let container = this.playerSprites.get(p.id);
      if (!container) {
        container = this.add.container(p.x, p.y);
        const body = this.add.circle(
          0,
          0,
          GAME.PLAYER_RADIUS,
          Phaser.Display.Color.HexStringToColor(p.color).color,
        );
        body.setStrokeStyle(2, 0xffffff, 0.35);
        container.add(body);
        container.setData("body", body);
        this.playerSprites.set(p.id, container);

        const label = this.add
          .text(0, -34, p.name, {
            fontFamily: "Segoe UI, Noto Sans TC, sans-serif",
            fontSize: "13px",
            color: "#ffffff",
          })
          .setOrigin(0.5);
        this.playerLabels.set(p.id, label);
      }

      container.setPosition(p.x, p.y);
      container.setAlpha(p.alive ? 1 : 0.35);
      const body = container.getData("body") as Phaser.GameObjects.Arc;
      body.setFillStyle(
        Phaser.Display.Color.HexStringToColor(p.color).color,
        p.alive ? 1 : 0.3,
      );

      const label = this.playerLabels.get(p.id)!;
      label.setPosition(p.x, p.y - 34);
      label.setText(p.name + (p.id === getPlayerId() ? "（你）" : ""));
    }

    this.dogSprite.setPosition(snapshot.dog.x, snapshot.dog.y);
    this.dogSprite.setRotation(snapshot.dog.angle);

    const holder = snapshot.players.find((p) => p.hasBall && p.alive);
    if (holder) {
      this.ballSprite.setVisible(true);
      this.ballSprite.setPosition(holder.x, holder.y - 28);
    } else {
      this.ballSprite.setVisible(false);
    }

    const me = this.getMe();
    const aliveCount = snapshot.players.filter((p) => p.alive).length;
    const cd = me ? Math.ceil(me.blinkCooldownMs / 1000) : 0;

    this.hud.setText(
      [
        `存活 ${aliveCount}/${snapshot.players.length}`,
        `持球時間 ${snapshot.holdTimeSec.toFixed(1)}s`,
        me?.hasBall
          ? "你持球：右鍵點人傳球"
          : me?.alive
            ? `Blink <Space> 朝向滑鼠 · CD ${cd}s`
            : "你已出局（觀戰）",
        "右鍵點地移動",
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
  }
}
