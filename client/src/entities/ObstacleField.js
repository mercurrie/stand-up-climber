import Phaser from 'phaser';

const TEXTURE_KEY = 'obstacle';
const TEXTURE_RADIUS = 20;
const OBSTACLE_COLOR = 0xff6b6b;
// If an obstacle should have landed longer ago than this (e.g. the tab was in
// the background), remove it silently instead of playing the landing puff.
const STALE_LANDING_MS = 250;

/**
 * Renders the round's obstacle schedule and answers "is the player hit?".
 *
 * Positions are computed from elapsed round time, not simulated:
 *   y = top of world + speed · (elapsed − spawnAt)
 * So every client that agrees on the round start time sees each obstacle in
 * the same place, and a client that lags or hitches catches up immediately.
 */
export class ObstacleField {
  constructor(scene, schedule, effects) {
    this.scene = scene;
    this.schedule = schedule;
    this.effects = effects;
    this.nextIndex = 0;
    this.active = [];
    this.hitCircle = new Phaser.Geom.Circle();
    ensureObstacleTexture(scene);
  }

  update(elapsedMs) {
    while (this.nextIndex < this.schedule.length && this.schedule[this.nextIndex].spawnAtMs <= elapsedMs) {
      this.spawn(this.schedule[this.nextIndex++]);
    }

    this.active = this.active.filter((obstacle) => {
      const { entry, sprite } = obstacle;
      const y = this.positionAt(entry, elapsedMs);
      if (y >= entry.endY) {
        const overdueMs = ((y - entry.endY) / entry.speed) * 1000;
        if (overdueMs < STALE_LANDING_MS) this.land(entry);
        sprite.destroy();
        return false;
      }
      sprite.y = y;
      // A gentle wobble so they feel alive. Deterministic, like everything else.
      sprite.rotation = Math.sin((elapsedMs - entry.spawnAtMs) / 180 + entry.id) * 0.25;
      return true;
    });
  }

  positionAt(entry, elapsedMs) {
    return -entry.radius + (entry.speed * (elapsedMs - entry.spawnAtMs)) / 1000;
  }

  spawn(entry) {
    const sprite = this.scene.add.image(entry.x, -entry.radius, TEXTURE_KEY)
      .setScale(entry.radius / TEXTURE_RADIUS)
      .setTint(OBSTACLE_COLOR)
      .setDepth(10);
    this.active.push({ entry, sprite });
  }

  land(entry) {
    const view = this.scene.cameras.main.worldView;
    if (view.contains(entry.x, entry.endY)) {
      this.effects.burst(entry.x, entry.endY, OBSTACLE_COLOR, 10);
    }
  }

  /** Returns the first obstacle overlapping `rect` (a Phaser.Geom.Rectangle), or null. */
  findHit(rect) {
    for (const { entry, sprite } of this.active) {
      // Slightly smaller than drawn, so grazes don't count.
      this.hitCircle.setTo(sprite.x, sprite.y, entry.radius * 0.85);
      if (Phaser.Geom.Intersects.CircleToRectangle(this.hitCircle, rect)) return entry;
    }
    return null;
  }
}

/** A grumpy little ball. Tinted at runtime; the face stays dark. */
function ensureObstacleTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const r = TEXTURE_RADIUS;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(0x1d1b2f, 1);
  g.fillCircle(r - 6, r + 1, 2.6);
  g.fillCircle(r + 6, r + 1, 2.6);
  // Angry eyebrows.
  g.lineStyle(2.5, 0x1d1b2f, 1);
  g.lineBetween(r - 10, r - 7, r - 3, r - 4);
  g.lineBetween(r + 10, r - 7, r + 3, r - 4);
  g.generateTexture(TEXTURE_KEY, r * 2, r * 2);
  g.destroy();
}
