import { Rules } from '@stand-up-climber/shared';
import { FONT_FAMILY } from '../config/display.js';
import { MEDALS, formatPercent } from './format.js';

const ROW_HEIGHT = 20;
export const LEADERBOARD_WIDTH = 170;
const PADDING = 8;
// Column x offsets: medal/rank, colour dot, name. Percent is right-aligned.
const DOT_X = 38;
const NAME_X = 48;
const NAME_MAX_CHARS = 8;

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
    this.rows = Array.from({ length: Rules.MAX_PLAYERS }, (_, i) => {
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

    this.background.clear();
    this.background.fillStyle(0x000000, 0.35);
    const height = PADDING * 2 + standings.length * ROW_HEIGHT;
    this.bottom = this.y + height;
    this.background.fillRoundedRect(this.x, this.y, LEADERBOARD_WIDTH, height, 8);

    this.rows.forEach((row, i) => {
      const player = standings[i];
      const visible = Boolean(player);
      Object.values(row).forEach((obj) => obj.setVisible(visible));
      if (!visible) return;

      const color = player.id === localId ? '#ffd166' : '#ffffff';
      row.rank.setText(MEDALS[i] ?? `${i + 1}`);
      row.dot.setFillStyle(player.color);
      row.name.setText(truncate(player.name, NAME_MAX_CHARS)).setColor(color);
      row.percent.setText(formatPercent(player.best)).setColor(color);
    });
  }
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
