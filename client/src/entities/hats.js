import Phaser from 'phaser';
import { PLAYER } from '../config/gameplay.js';

// Hat textures are drawn at 2× and shown at half scale, so they stay crisp
// when characters are scaled up in the lobby and on the results screen.
const RES = 2;
// How far (px) a hat sits down into the top of the head.
const HEAD_SINK = 3;
// Not 'hat-propeller': that's the beanie's own texture key (`hat-${id}`).
const PROPELLER_KEY = 'hat-propeller-blades';

const DARK = 0x1d1b2f;
const GOLD = 0xffd166;
const WHITE = 0xffffff;

/**
 * Each hat: texture size in 1× px, and `anchorY`, the row that sits on top of
 * the head (anything below it, like beer-hat straws, hangs over the face).
 * `draw(g)` paints in 1× units; the texture is scaled by RES.
 * The ids match HATS in shared/src/protocol.js.
 */
const HAT_DEFS = {
  party: {
    width: 24, height: 30, anchorY: 28,
    draw(g) {
      g.fillStyle(0xff6b9d, 1);
      g.fillTriangle(2, 28, 22, 28, 12, 4);
      g.fillStyle(GOLD, 1);
      g.fillCircle(10, 21, 2);
      g.fillCircle(15, 16, 1.8);
      g.fillCircle(11, 12, 1.4);
      g.fillCircle(16, 24, 1.6);
      g.fillStyle(WHITE, 1);
      g.fillRect(2, 26, 20, 2.5);
      g.fillStyle(0x4cc9f0, 1);
      g.fillCircle(12, 4, 3.5);
    },
  },
  pirate: {
    width: 44, height: 22, anchorY: 20,
    draw(g) {
      g.fillStyle(0x2d2b3a, 1);
      g.fillPoints([
        { x: 1, y: 20 }, { x: 6, y: 10 }, { x: 14, y: 4 }, { x: 22, y: 2 },
        { x: 30, y: 4 }, { x: 38, y: 10 }, { x: 43, y: 20 },
      ], true);
      g.lineStyle(2, GOLD, 1);
      g.lineBetween(2, 19.5, 42, 19.5);
      // Skull and crossbones.
      g.lineStyle(1.6, WHITE, 1);
      g.lineBetween(17, 17, 27, 11);
      g.lineBetween(17, 11, 27, 17);
      g.fillStyle(WHITE, 1);
      g.fillCircle(22, 11, 4);
      g.fillStyle(0x2d2b3a, 1);
      g.fillCircle(20.6, 10.6, 1);
      g.fillCircle(23.4, 10.6, 1);
    },
  },
  propeller: {
    width: 34, height: 26, anchorY: 24,
    draw(g) {
      // Stem for the propeller (the blades are a separate, spinning image).
      g.fillStyle(0xc8d6e5, 1);
      g.fillRect(16, 5, 2, 7);
      // Four-colour dome.
      const colors = [0xff6b6b, GOLD, 0x4cc9f0, 0x7ee081];
      colors.forEach((color, i) => {
        g.fillStyle(color, 1);
        g.slice(17, 24, 13, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
        g.fillPath();
      });
      g.fillStyle(0x3a3760, 1);
      g.fillRect(3, 22, 28, 3);
    },
  },
  beer: {
    width: 46, height: 44, anchorY: 22,
    draw(g) {
      // Straws, drawn first so they tuck behind the cans. They hang down the
      // sides of the face and meet below the eyes, where a mouth would be.
      g.lineStyle(1.6, WHITE, 0.95);
      g.lineBetween(6, 20, 20, 42);
      g.lineBetween(40, 20, 26, 42);
      // Hard-hat dome (red, so it never blends into a yellow player) and brim.
      g.fillStyle(0xee5253, 1);
      g.slice(23, 22, 12, Math.PI, 0);
      g.fillPath();
      g.fillRect(9, 20, 28, 3);
      g.fillStyle(WHITE, 0.9);
      g.fillRect(21.5, 10, 3, 10);
      // Arms holding the cans.
      g.fillStyle(0xc8d6e5, 1);
      g.fillRect(9, 13, 4, 2);
      g.fillRect(33, 13, 4, 2);
      // Two cans with silver tops.
      for (const x of [1, 36]) {
        g.fillStyle(0xff9f43, 1);
        g.fillRoundedRect(x, 7, 9, 14, 2);
        g.fillStyle(0xc8d6e5, 1);
        g.fillRect(x, 7, 9, 2.5);
        g.fillStyle(WHITE, 0.7);
        g.fillRect(x + 2, 11, 1.5, 7);
      }
    },
  },
};

/** Height a hat adds above the head at scale 1 (0 for no hat). */
export function hatHeightAboveHead(hatId) {
  const def = HAT_DEFS[hatId];
  return def ? def.anchorY - HEAD_SINK : 0;
}

function ensureHatTextures(scene) {
  for (const [id, def] of Object.entries(HAT_DEFS)) {
    const key = `hat-${id}`;
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ add: false });
    g.scaleCanvas(RES, RES);
    def.draw(g);
    g.generateTexture(key, def.width * RES, def.height * RES);
    g.destroy();
  }
  if (!scene.textures.exists(PROPELLER_KEY)) {
    const g = scene.make.graphics({ add: false });
    g.scaleCanvas(RES, RES);
    // Two thin orange blades either side of a small hub.
    g.fillStyle(0xff9f43, 1);
    g.fillEllipse(7, 3, 13, 2.6);
    g.fillEllipse(21, 3, 13, 2.6);
    g.fillStyle(0xc8d6e5, 1);
    g.fillCircle(14, 3, 1.6);
    g.generateTexture(PROPELLER_KEY, 28 * RES, 6 * RES);
    g.destroy();
  }
}

/**
 * A hat that sits on a character. Use `follow(sprite)` each frame for moving
 * characters (it copies position, squash/stretch, visibility and alpha), or
 * place it once with `placeOnHead()` for static ones (lobby, results).
 * 'none' (or an unknown id) is an empty container, so callers needn't care.
 */
export class HatView extends Phaser.GameObjects.Container {
  /** @param scale  The character's scale (1 in-game). */
  constructor(scene, hatId, scale = 1) {
    super(scene, 0, 0);
    ensureHatTextures(scene);
    this.def = HAT_DEFS[hatId] ?? null;
    this.baseScale = scale;

    if (this.def) {
      const { width, height, anchorY } = this.def;
      this.add(scene.add.image(0, 0, `hat-${hatId}`)
        .setOrigin(0.5, anchorY / height).setScale(scale / RES));

      if (hatId === 'propeller') {
        const blade = scene.add.image(0, (5 - anchorY) * scale, PROPELLER_KEY).setScale(scale / RES);
        this.add(blade);
        // Flipping scaleX back and forth reads as a spinning propeller.
        scene.tweens.add({ targets: blade, scaleX: -scale / RES, duration: 140, yoyo: true, repeat: -1 });
      }
      this.width = width * scale;
    }
    scene.add.existing(this);
  }

  /** Height of the hat above the top of the head, in px. */
  get heightAboveHead() {
    return this.def ? (this.def.anchorY - HEAD_SINK) * this.baseScale : 0;
  }

  /**
   * Offset from the hat's anchor (head top) to the middle of its drawing,
   * for showing a hat on its own, e.g. centred in a button.
   */
  get visualCenterOffset() {
    return this.def ? (this.def.height / 2 - this.def.anchorY) * this.baseScale : 0;
  }

  /** For static characters: position relative to the character's feet. */
  placeOnHead(x, feetY) {
    return this.setPosition(x, feetY - (PLAYER.SIZE - HEAD_SINK) * this.baseScale);
  }

  /** For moving characters whose sprite has origin (0.5, 1). */
  follow(sprite) {
    this.setPosition(sprite.x, sprite.y - sprite.displayHeight + HEAD_SINK * sprite.scaleY);
    this.setScale(sprite.scaleX / this.baseScale, sprite.scaleY / this.baseScale);
    this.setVisible(sprite.visible).setAlpha(sprite.alpha);
  }
}
