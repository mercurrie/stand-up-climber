import Phaser from 'phaser';
import { HIT, PLAYER } from '../config/gameplay.js';

const TEXTURE_KEY = 'player';
const FRAME_MS = 1000 / 60;

/**
 * The player controlled by this browser.
 *
 * Split into two objects on purpose:
 *  - `hitbox`: an invisible Arcade physics body. Movement and collision only.
 *  - `sprite`: what you see. Follows the hitbox and can squash/stretch freely
 *    without changing the physics body's size.
 *
 * Remote players (Phase 5) will reuse the same look via the 'player' texture,
 * but without a hitbox: they're just interpolated sprites.
 */
export class LocalPlayer {
  constructor(scene, x, y, color) {
    this.scene = scene;
    ensurePlayerTexture(scene);

    // Spawn with feet at (x, y).
    this.hitbox = scene.physics.add.image(x, y - PLAYER.HITBOX_HEIGHT / 2, TEXTURE_KEY);
    this.hitbox.setVisible(false);
    this.hitbox.body.setSize(PLAYER.HITBOX_WIDTH, PLAYER.HITBOX_HEIGHT);
    this.hitbox.body.setMaxVelocityY(PLAYER.MAX_FALL_SPEED);
    this.hitbox.setCollideWorldBounds(true);

    this.color = color;
    this.sprite = scene.add.image(x, y, TEXTURE_KEY).setOrigin(0.5, 1).setTint(color).setDepth(5);
    this.boundsRect = new Phaser.Geom.Rectangle();
    this.invulnerableUntil = 0;
    this.frozen = false;

    const kb = scene.input.keyboard;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Sync the sprite after physics has stepped (Arcade runs in 'update',
    // before POST_UPDATE), so it never lags a frame behind the hitbox.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get body() {
    return this.hitbox.body;
  }

  /** Feet position, in world coordinates. */
  get footY() {
    return this.body.bottom;
  }

  /**
   * Frozen players don't move or respond to input (countdown, round over).
   * Separate from body.enable, which hit()/respawn uses.
   */
  setFrozen(frozen) {
    this.frozen = frozen;
    this.body.moves = !frozen;
    if (frozen) this.body.setVelocity(0, 0);
  }

  update(delta) {
    if (this.frozen) return;
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const direction = (right ? 1 : 0) - (left ? 1 : 0);

    // Ease towards target speed. Framerate-independent so it feels the same
    // on 60 Hz and 120 Hz displays.
    const target = direction * PLAYER.MOVE_SPEED;
    const t = 1 - Math.pow(1 - PLAYER.ACCELERATION, delta / FRAME_MS);
    this.body.setVelocityX(Phaser.Math.Linear(this.body.velocity.x, target, t));

    if (direction !== 0) this.sprite.setFlipX(direction < 0);
  }

  /** True when an obstacle can hit us: not mid-respawn and not invulnerable. */
  get canBeHit() {
    return !this.frozen && this.body.enable && this.scene.time.now >= this.invulnerableUntil;
  }

  /** Hitbox as a Phaser.Geom.Rectangle, for overlap tests. */
  get bounds() {
    return this.boundsRect.setTo(this.body.x, this.body.y, this.body.width, this.body.height);
  }

  /** Called when landing on a platform: the automatic jump. */
  bounce() {
    this.body.setVelocityY(-PLAYER.JUMP_VELOCITY);

    // Quick squash on take-off, then spring back.
    this.squashTween?.stop();
    this.sprite.setScale(1.3, 0.7);
    this.squashTween = this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Knocked by an obstacle: vanish briefly, then reappear at (x, y) — the
   * bottom of the course — blinking and temporarily invulnerable.
   */
  hit(x, y) {
    this.body.enable = false;
    this.sprite.setVisible(false);

    this.scene.time.delayedCall(HIT.RESPAWN_DELAY_MS, () => {
      this.resetTo(x, y);
      this.body.enable = true;
      this.sprite.setVisible(true);
      this.invulnerableUntil = this.scene.time.now + HIT.INVULNERABLE_MS;

      this.blinkTween?.stop();
      this.blinkTween = this.scene.tweens.add({
        targets: this.sprite,
        alpha: { from: 0.25, to: 1 },
        duration: 150,
        yoyo: true,
        repeat: Math.floor(HIT.INVULNERABLE_MS / 300) - 1,
        onComplete: () => this.sprite.setAlpha(1),
      });
    });
  }

  /** Teleport feet to (x, y) and stop. */
  resetTo(x, y) {
    this.body.reset(x, y - PLAYER.HITBOX_HEIGHT / 2);
    this.syncSprite();
  }

  syncSprite() {
    // Stretch slightly while moving fast vertically. Skipped mid-squash.
    if (!this.squashTween?.isPlaying()) {
      const stretch = Phaser.Math.Clamp(Math.abs(this.body.velocity.y) / PLAYER.JUMP_VELOCITY, 0, 1) * 0.12;
      this.sprite.setScale(1 - stretch / 2, 1 + stretch);
    }
    this.sprite.setPosition(this.body.center.x, this.body.bottom);
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this);
    this.hitbox.destroy();
    this.sprite.destroy();
  }
}

/** A rounded white square with two little eyes. Tinted per player. */
function ensurePlayerTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const s = PLAYER.SIZE;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, s, s, 9);
  // Pupils sit right of centre so the character "looks" where it's going
  // (the sprite is flipped when moving left).
  g.fillStyle(0x1d1b2f, 1);
  g.fillCircle(s * 0.56, s * 0.4, 3.2);
  g.fillCircle(s * 0.8, s * 0.4, 3.2);
  g.generateTexture(TEXTURE_KEY, s, s);
  g.destroy();
}
