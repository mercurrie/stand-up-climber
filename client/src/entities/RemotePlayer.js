import { FONT_FAMILY } from '../config/display.js';
import { PLAYER_TEXTURE, ensurePlayerTexture } from './playerTexture.js';
import { HatView } from './hats.js';

// How quickly the sprite catches up with the latest network position (per
// second). Updates arrive ~10/s; this smooths the gaps without much lag.
const SMOOTHING = 14;
// Further than this between updates means a respawn: jump, don't glide.
const SNAP_DISTANCE = 250;
const ALPHA = 0.6;

/**
 * Another player, as seen by this browser. No physics and no collisions:
 * just a sprite (plus hat and name) that eases towards the positions the
 * server relays.
 */
export class RemotePlayer {
  constructor(scene, { name, color, hat }) {
    ensurePlayerTexture(scene);
    this.color = color;
    this.sprite = scene.add.image(0, 0, PLAYER_TEXTURE)
      .setOrigin(0.5, 1).setTint(color).setAlpha(ALPHA).setDepth(4).setVisible(false);
    this.hat = new HatView(scene, hat).setDepth(4);
    this.label = scene.add.text(0, 0, name, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#1d1b2f',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setAlpha(0.85).setDepth(4).setVisible(false);
    this.target = null;
  }

  /** Latest state from a snapshot: { x, y, flip, hidden }. x is centre, y is feet. */
  setTarget({ x, y, flip, hidden }) {
    const first = !this.target;
    const jumped = !first && Math.hypot(x - this.target.x, y - this.target.y) > SNAP_DISTANCE;
    this.target = { x, y };
    if (first || jumped) this.sprite.setPosition(x, y);

    this.sprite.setFlipX(flip);
    // Hidden = mid-respawn after a hit. Also hide until we know where they are.
    const visible = !hidden && !(x === 0 && y === 0);
    this.sprite.setVisible(visible);
    this.label.setVisible(visible);
  }

  update(delta) {
    if (!this.target) return;
    const t = 1 - Math.exp((-SMOOTHING * delta) / 1000);
    this.sprite.x += (this.target.x - this.sprite.x) * t;
    this.sprite.y += (this.target.y - this.sprite.y) * t;
    this.hat.follow(this.sprite);
    const headTop = this.sprite.y - this.sprite.displayHeight - this.hat.heightAboveHead;
    this.label.setPosition(this.sprite.x, headTop - 4);
  }

  destroy() {
    this.sprite.destroy();
    this.hat.destroy();
    this.label.destroy();
  }
}
