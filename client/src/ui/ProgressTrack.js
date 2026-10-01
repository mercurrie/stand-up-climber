import { GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';

const X = GAME_WIDTH - 12;
// Below the leaderboard (which is ~220px tall with a full room).
const TOP = 250;
const BOTTOM = GAME_HEIGHT - 40;
const DEPTH = 95;

/**
 * A thin vertical bar on the right edge showing where everyone is right now,
 * so you can see who's closing in. Your own dot is bigger and outlined.
 */
export class ProgressTrack {
  constructor(scene) {
    const track = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    track.fillStyle(0x000000, 0.3);
    track.fillRoundedRect(X - 3, TOP, 6, BOTTOM - TOP, 3);
    // Little flag at the top.
    track.fillStyle(0xffd166, 1);
    track.fillTriangle(X, TOP - 16, X, TOP - 6, X + 9, TOP - 11);
    track.fillRect(X - 1, TOP - 16, 2, 16);
    this.dots = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
  }

  /** entries: [{ color, fraction (0..1 height), isLocal }] */
  update(entries) {
    this.dots.clear();
    // Draw yourself last, so you're on top.
    const sorted = [...entries].sort((a, b) => Number(a.isLocal) - Number(b.isLocal));
    for (const { color, fraction, isLocal } of sorted) {
      const y = BOTTOM - Math.min(1, Math.max(0, fraction)) * (BOTTOM - TOP);
      if (isLocal) {
        this.dots.fillStyle(0xffffff, 1);
        this.dots.fillCircle(X, y, 7);
      }
      this.dots.fillStyle(color, 1);
      this.dots.fillCircle(X, y, isLocal ? 5 : 4);
    }
  }
}
