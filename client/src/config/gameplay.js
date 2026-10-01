// Gameplay tuning. Units are pixels and seconds unless noted.
//
// Handy derived numbers (keep level gaps below MAX_JUMP_HEIGHT):
//   max jump height = JUMP_VELOCITY² / (2 · GRAVITY) ≈ 240 px
//   air time (same-height bounce) = 2 · JUMP_VELOCITY / GRAVITY ≈ 1.17 s

export const GRAVITY = 1400;

export const PLAYER = {
  // Visual size; the hitbox is a little smaller so near-misses feel fair.
  SIZE: 34,
  HITBOX_WIDTH: 26,
  HITBOX_HEIGHT: 30,

  MOVE_SPEED: 300,
  // Fraction of the gap to target speed closed per 60 fps frame (0–1).
  // Lower = more slidey, higher = snappier.
  ACCELERATION: 0.28,

  // Applied automatically every time the player lands on a platform.
  JUMP_VELOCITY: 820,
  // Caps fall speed so fast falls can't tunnel through thin platforms.
  MAX_FALL_SPEED: 900,
};

export const MAX_JUMP_HEIGHT = (PLAYER.JUMP_VELOCITY ** 2) / (2 * GRAVITY);

export const CAMERA = {
  // Keep the player below screen centre so upcoming platforms are visible.
  // Fraction of screen height: 0.18 puts the player ~68% of the way down.
  FOLLOW_OFFSET_Y: 0.18,
  // Vertical smoothing (0–1). Horizontal never scrolls: world width = screen width.
  LERP_Y: 0.12,
};

export const PLATFORM_THICKNESS = 18;

export const OBSTACLES = {
  // The schedule starts this long *before* the round, so at t=0 the whole
  // tower is already full of falling obstacles. Should be at least the time
  // the slowest obstacle takes to fall the full tower (~2900 px / 230 px/s).
  PREWARM_MS: 13_000,
  // ...except near the start area: pre-warmed obstacles that would begin the
  // round lower than this (px above ground) are skipped, so nobody gets
  // bonked on the very first frame.
  START_SAFE_HEIGHT: 400,
  // Time between consecutive spawns, picked randomly in this range.
  SPAWN_INTERVAL_MS: { min: 650, max: 1250 },
  // Constant fall speed (px/s) and radius, per obstacle.
  FALL_SPEED: { min: 230, max: 330 },
  RADIUS: { min: 14, max: 20 },
  // Keep spawns away from the walls.
  EDGE_MARGIN: 24,
  // Schedule is generated this far ahead (covers the longest possible round).
  SCHEDULE_DURATION_MS: 100_000,
};

export const HIT = {
  // Pause before respawning at the bottom, so the hit registers visually.
  RESPAWN_DELAY_MS: 450,
  // Can't be hit again for this long after respawning.
  INVULNERABLE_MS: 1500,
};
