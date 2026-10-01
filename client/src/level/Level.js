import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/display.js';
import { PLATFORM_THICKNESS } from '../config/gameplay.js';

const GROUND_COLOR = 0x5a5780;
const BACKGROUND_BOTTOM = 0x2b2950;
const BACKGROUND_TOP = 0x100f1f;
const STAR_COUNT = 140;

/**
 * Turns level data (see level1.js) into world geometry and Phaser objects.
 *
 * Level data uses "height above ground"; Phaser uses y-down world coordinates.
 * This class is the only place that converts between the two, which keeps
 * progress tracking and obstacle spawning simple.
 */
export class Level {
  constructor(data) {
    this.data = data;
    this.width = GAME_WIDTH;

    const goal = data.platforms.find((p) => p.goal);
    this.goalHeight = goal.height;
    this.worldHeight = data.groundThickness + goal.height + data.skyHeight;
    this.sectionColors = Object.fromEntries(data.sections.map((s) => [s.id, s.color]));
  }

  /** World y of a point `height` px above the ground surface. */
  toWorldY(height) {
    return this.worldHeight - this.data.groundThickness - height;
  }

  /** Inverse of toWorldY. */
  toHeight(worldY) {
    return this.worldHeight - this.data.groundThickness - worldY;
  }

  get groundY() {
    return this.toWorldY(0);
  }

  /** Where players spawn and respawn: standing on the ground. */
  get startPosition() {
    return { x: this.data.playerStartX, y: this.groundY };
  }

  drawBackground(scene) {
    const g = scene.add.graphics().setDepth(-10);
    g.fillGradientStyle(BACKGROUND_TOP, BACKGROUND_TOP, BACKGROUND_BOTTOM, BACKGROUND_BOTTOM, 1);
    g.fillRect(0, 0, this.width, this.worldHeight);

    // Fixed seed: decorative only, but there's no reason for it to differ per player.
    const rng = new Phaser.Math.RandomDataGenerator(['stand-up-climber']);
    for (let i = 0; i < STAR_COUNT; i++) {
      const y = rng.between(0, this.groundY);
      // Stars get denser and brighter towards the top.
      const alpha = 0.15 + 0.5 * (1 - y / this.worldHeight);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(rng.between(0, this.width), y, rng.pick([1, 1, 1.5, 2]));
    }
  }

  /**
   * Builds the ground and platforms as static Arcade bodies.
   * Platforms are one-way: you jump up through them and land on top.
   * Returns a static group to collide against.
   */
  createPlatforms(scene) {
    const group = scene.physics.add.staticGroup();

    this.addPlatform(scene, group, {
      x: this.width / 2,
      height: 0,
      width: this.width,
      thickness: this.data.groundThickness,
      color: GROUND_COLOR,
    });

    for (const p of this.data.platforms) {
      const platform = this.addPlatform(scene, group, {
        x: p.x,
        height: p.height,
        width: p.width,
        thickness: PLATFORM_THICKNESS,
        color: this.sectionColors[p.section],
      });
      platform.setData('goal', Boolean(p.goal));
      if (p.goal) this.drawGoalFlag(scene, p);
    }

    return group;
  }

  addPlatform(scene, group, { x, height, width, thickness, color }) {
    const key = platformTexture(scene, width, thickness);
    // Static bodies are positioned by centre; place the top surface at `height`.
    const platform = group.create(x, this.toWorldY(height) + thickness / 2, key);
    platform.setTint(color);
    platform.body.checkCollision.down = false;
    platform.body.checkCollision.left = false;
    platform.body.checkCollision.right = false;
    return platform;
  }

  drawGoalFlag(scene, goal) {
    const baseY = this.toWorldY(goal.height);
    const poleX = goal.x + goal.width / 2 - 22;
    const g = scene.add.graphics().setDepth(-1);
    g.fillStyle(0xffffff, 1);
    g.fillRect(poleX, baseY - 70, 4, 70);
    g.fillStyle(0xff6b6b, 1);
    g.fillTriangle(poleX + 4, baseY - 70, poleX + 4, baseY - 44, poleX + 40, baseY - 57);
  }
}

/** One texture per platform size: rounded, with a lighter top lip. Tinted per section. */
function platformTexture(scene, width, thickness) {
  const key = `platform-${width}x${thickness}`;
  if (scene.textures.exists(key)) return key;

  const radius = Math.min(8, thickness / 2);
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xbdbdbd, 1);
  g.fillRoundedRect(0, 0, width, thickness, radius);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, width, Math.min(8, thickness * 0.45), { tl: radius, tr: radius, bl: 0, br: 0 });
  g.generateTexture(key, width, thickness);
  g.destroy();
  return key;
}
