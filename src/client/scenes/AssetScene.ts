import Phaser from "phaser";
import { CHARACTERS } from "@shared/characters";
import { characterCanvas, dogCanvas } from "../pixelArt";

/**
 * The only scene that loads shared textures. Both playable scenes use the
 * global Texture Manager, so loading them here avoids races between scene
 * preload hooks and keeps the procedural fallback deterministic.
 */
export class AssetScene extends Phaser.Scene {
  constructor() {
    super("AssetScene");
  }

  preload() {
    for (const character of CHARACTERS) {
      this.load.image(`char-${character.id}`, character.asset);
    }
  }

  create() {
    for (const character of CHARACTERS) {
      const key = `char-${character.id}`;
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, characterCanvas(character.id, 4));
      }
    }
    if (!this.textures.exists("dog-collie")) {
      this.textures.addCanvas("dog-collie", dogCanvas(4));
    }

    this.registry.set("shuai-gou.assets-ready", true);
    this.scene.start("GameScene");
  }
}
