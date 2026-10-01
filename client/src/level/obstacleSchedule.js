import Phaser from 'phaser';
import { OBSTACLES } from '../config/gameplay.js';

/**
 * Builds the full list of obstacles for a round from a seed.
 *
 * Multiplayer note: this is how every player gets the same obstacles without
 * the server streaming them. The server picks a seed and a start time; each
 * client generates the identical schedule here, and positions every obstacle
 * purely from "ms since round start" (see ObstacleField). No obstacle state is
 * ever sent over the network.
 *
 * Returns entries sorted by spawn time:
 *   { id, spawnAtMs, x, radius, speed, endY }
 * where endY is the world y at which the obstacle lands on the ground.
 */
export function createObstacleSchedule(seed, level) {
  const rng = new Phaser.Math.RandomDataGenerator([String(seed)]);
  const schedule = [];
  const between = (range) => rng.realInRange(range.min, range.max);

  const safeStartY = level.toWorldY(OBSTACLES.START_SAFE_HEIGHT);

  // Negative spawn times are fine: those obstacles are already partway down
  // the tower when the round starts.
  let t = -OBSTACLES.PREWARM_MS;
  let id = 0;
  while (t < OBSTACLES.SCHEDULE_DURATION_MS) {
    const radius = Math.round(between(OBSTACLES.RADIUS));
    const margin = OBSTACLES.EDGE_MARGIN + radius;

    const entry = {
      id: id++,
      spawnAtMs: Math.round(t),
      x: Math.round(rng.realInRange(margin, level.width - margin)),
      radius,
      speed: between(OBSTACLES.FALL_SPEED),
      endY: level.groundY - radius,
    };
    t += between(OBSTACLES.SPAWN_INTERVAL_MS);

    // Same formula as ObstacleField.positionAt, evaluated at t=0.
    const yAtStart = -radius + (entry.speed * -entry.spawnAtMs) / 1000;
    if (entry.spawnAtMs < 0 && yAtStart > safeStartY) continue;

    schedule.push(entry);
  }
  return schedule;
}
