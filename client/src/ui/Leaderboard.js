import { FONT_FAMILY } from '../config/display.js';
import { MEDALS, formatPercent, truncate } from './format.js';

const ROW_HEIGHT = 20;
export const LEADERBOARD_WIDTH = 170;
const PADDING = 8;
// Column x offsets: medal/rank, colour dot, name. Percent is right-aligned.
const DOT_X = 38;
const NAME_X = 48;
const NAME_MAX_CHARS = 8;
// With a big room, listing everyone would cover too much of the screen, so
// show the top few plus your own row (the progress track still shows all).
const MAX_ROWS = 8;

/**
 * Compact live standings, pinned to the top-right of the screen.
 * Takes the already-sorted standings from the round and only touches text
 * objects when something changed.
 */
export class Leaderboard {
  constructor(scene, x, y) {
    this.x = x;
    this.y = y;
    this.background = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.rows = Array.from({ length: MAX_ROWS }, (_, i) => {
      const rowY = y + PADDING + i * ROW_HEIGHT;
      const style = { fontFamily: FONT_FAMILY, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' };
      return {
        dot: scene.add.circle(x + DOT_X, rowY + 9, 5, 0xffffff).setScrollFactor(0).setDepth(101),
        rank: scene.add.text(x + PADDING, rowY, '', style).setScrollFactor(0).setDepth(101),
        name: scene.add.text(x + NAME_X, rowY, '', style).setScrollFactor(0).setDepth(101),
        percent: scene.add.text(x + LEADERBOARD_WIDTH - PADDING, rowY, '', style).setOrigin(1, 0).setScrollFactor(0).setDepth(101),
      };
    });
    this.lastKey = '';
    this.bottom = y;
  }

  /** True if screen x falls within the panel's columns. */
  coversX(x) {
    return x >= this.x - 12 && x <= this.x + LEADERBOARD_WIDTH + 12;
  }

  update(standings, localId) {
    const key = standings.map((p) => `${p.id}:${Math.floor(p.best * 100)}`).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;

    const shown = visibleRows(standings, localId);
    this.background.clear();
    this.background.fillStyle(0x000000, 0.35);
    const height = PADDING * 2 + shown.length * ROW_HEIGHT;
    this.bottom = this.y + height;
    this.background.fillRoundedRect(this.x, this.y, LEADERBOARD_WIDTH, height, 8);

    this.rows.forEach((row, i) => {
      const entry = shown[i];
      Object.values(row).forEach((obj) => obj.setVisible(Boolean(entry)));
      if (!entry) return;

      const { player, rank } = entry;
      const color = player.id === localId ? '#ffd166' : '#ffffff';
      row.rank.setText(MEDALS[rank - 1] ?? `${rank}`);
      row.dot.setFillStyle(player.color);
      row.name.setText(truncate(player.name, NAME_MAX_CHARS)).setColor(color);
      row.percent.setText(formatPercent(player.best)).setColor(color);
    });
  }
}

/** Everyone if they fit; otherwise the top few, with you in the last row. */
function visibleRows(standings, localId) {
  const ranked = standings.map((player, i) => ({ player, rank: i + 1 }));
  if (ranked.length <= MAX_ROWS) return ranked;
  const you = ranked.find((e) => e.player.id === localId);
  if (!you || you.rank <= MAX_ROWS) return ranked.slice(0, MAX_ROWS);
  return [...ranked.slice(0, MAX_ROWS - 1), you];
}
