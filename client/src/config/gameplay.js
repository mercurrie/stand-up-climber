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
