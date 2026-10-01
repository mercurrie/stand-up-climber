import Phaser from 'phaser';
import { Level } from '../level/Level.js';
import { LEVEL_1 } from '../level/level1.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { ObstacleField } from '../entities/ObstacleField.js';
import { createObstacleSchedule } from '../level/obstacleSchedule.js';
import { Effects } from '../effects/Effects.js';
import { CAMERA } from '../config/gameplay.js';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from '../config/display.js';

// Arcade only reports the frame *after* overlap, so allow a little slack when
// deciding whether the player was above a platform last frame.
const LANDING_TOLERANCE = 2;

const HIT_WORDS = ['BONK!', 'OOF!', 'OUCH!', 'NOPE!', 'BACK TO\nTHE START!'];

/**
 * Single-player climb with falling obstacles.
 * Timer/progress/results (Phase 4) and remote players (Phase 5) will be
 * added here.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  /**
   * @param {{ seed?: number }} data  Obstacle seed. In multiplayer the server
   *   provides it so everyone gets the same obstacles; solo play picks one.
   */
  init(data) {
    this.seed = data?.seed ?? Phaser.Math.Between(1, 1e9);
  }

  create() {
    this.level = new Level(LEVEL_1);
    const { width, worldHeight } = this.level;

    this.physics.world.setBounds(0, 0, width, worldHeight);
    this.level.drawBackground(this);
    this.platforms = this.level.createPlatforms(this);
    this.effects = new Effects(this);
    this.obstacles = new ObstacleField(this, createObstacleSchedule(this.seed, this.level), this.effects);

    const start = this.level.startPosition;
    this.player = new LocalPlayer(this, start.x, start.y, PLAYER_COLORS[0]);
    this.hits = 0;

    // One-way platforms: the process callback rejects collisions unless the
    // player is falling onto the top surface. The collide callback is the
    // automatic jump.
    this.physics.add.collider(
      this.player.hitbox,
      this.platforms,
      (_hitbox, platform) => this.handleLanding(platform),
      (_hitbox, platform) => this.canLand(platform),
    );

    const camera = this.cameras.main;
    camera.setBounds(0, 0, width, worldHeight);
    camera.startFollow(this.player.hitbox, true, 1, CAMERA.LERP_Y);
    camera.setFollowOffset(0, GAME_HEIGHT * CAMERA.FOLLOW_OFFSET_Y);

    this.startedAt = Date.now();
    this.reachedTop = false;
    this.createHud();

    // Restart with a fresh seed (new obstacle pattern).
    this.input.keyboard.on('keydown-R', () => this.scene.restart({}));
  }

  update(_time, delta) {
    this.player.update(delta);
    this.obstacles.update(Date.now() - this.startedAt);

    // Each client only checks hits against its own player. Remote players
    // (Phase 5) report their own hits via their progress updates.
    if (!this.reachedTop && this.player.canBeHit && this.obstacles.findHit(this.player.bounds)) {
      this.onPlayerHit();
    }
  }

  onPlayerHit() {
    this.hits++;
    const { x, y } = this.player.body.center;
    this.effects.burst(x, y, this.player.color, 24);
    this.effects.floatingText(x, y - 20, Phaser.Utils.Array.GetRandom(HIT_WORDS), COLORS.bad);
    this.cameras.main.shake(180, 0.01);

    const start = this.level.startPosition;
    this.player.hit(start.x, start.y);
  }

  canLand(platform) {
    const body = this.player.body;
    const wasAbove = body.prev.y + body.height <= platform.body.top + LANDING_TOLERANCE;
    return body.velocity.y >= 0 && wasAbove;
  }

  handleLanding(platform) {
    this.player.bounce();
    if (platform.getData('goal') && !this.reachedTop) this.onReachedTop();
  }

  // Placeholder until Phase 4 adds the real finish flow.
  onReachedTop() {
    this.reachedTop = true;
    this.tweens.killTweensOf(this.hint);
    const seconds = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    const bonks = this.hits === 1 ? '1 bonk' : `${this.hits} bonks`;
    this.hint.setText(`Top in ${seconds}s (${bonks})!\nPress R to climb again`).setAlpha(1);
    this.hint.setColor(COLORS.accent);
  }

  createHud() {
    this.hint = this.add.text(GAME_WIDTH / 2, 70, '← → or A D to move\nYou bounce automatically!', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      fontStyle: 'bold',
      color: COLORS.text,
      align: 'center',
      stroke: '#1d1b2f',
      strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    this.tweens.add({ targets: this.hint, alpha: 0, delay: 3500, duration: 600 });
  }
}
