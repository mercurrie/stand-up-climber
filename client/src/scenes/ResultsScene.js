import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from '../config/display.js';
import { MEDALS, formatPercent, hostingLine } from '../ui/format.js';

const ROW_HEIGHT = 34;
const CONFETTI_KEY = 'confetti';

/**
 * Final standings and the all-important announcement of next week's host.
 *
 * data: { rankings: [{ id, name, color, best, finished }], localId }
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create({ rankings, localId }) {
    const cx = GAME_WIDTH / 2;
    const winner = rankings[0];
    const text = (x, y, value, size, color = COLORS.text, extra = {}) => this.add.text(x, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      ...extra,
    });

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.startConfetti();

    text(cx, 50, '🏆 FINAL RESULTS', 32, COLORS.accent).setOrigin(0.5);

    // Rankings
    const top = 100;
    rankings.forEach((player, i) => {
      const y = top + i * ROW_HEIGHT;
      const color = player.id === localId ? COLORS.accent : COLORS.text;
      text(70, y, MEDALS[i] ?? `${i + 1}`, 22).setOrigin(0.5, 0);
      this.add.circle(108, y + 13, 7, player.color);
      text(124, y, player.name, 22, color);
      text(GAME_WIDTH - 60, y, formatPercent(player.best), 22, color).setOrigin(1, 0);
    });

    // The winner: their character bouncing just above the announcement, which
    // sits at a fixed spot so it never collides with a full 10-player list.
    const announceY = GAME_HEIGHT - 240;
    if (winner) {
      const hero = this.add.image(cx, announceY - 12, 'player').setTint(winner.color).setScale(1.5).setOrigin(0.5, 1);
      this.tweens.add({ targets: hero, y: hero.y - 30, duration: 380, ease: 'Quad.easeOut', yoyo: true, repeat: -1 });

      const announcement = text(cx, announceY, hostingLine(winner.name), 34, COLORS.accent, {
        align: 'center',
        stroke: '#1d1b2f',
        strokeThickness: 8,
        wordWrap: { width: GAME_WIDTH - 30 },
      }).setOrigin(0.5, 0);
      announcement.setScale(0);
      this.tweens.add({ targets: announcement, scale: 1, duration: 600, delay: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: announcement, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.createPlayAgainButton(cx, GAME_HEIGHT - 80);
  }

  createPlayAgainButton(x, y) {
    const button = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (fill) => {
      bg.clear();
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(-110, -30, 220, 60, 16);
    };
    draw(0x4cc9f0);
    const label = this.add.text(0, 0, 'PLAY AGAIN', {
      fontFamily: FONT_FAMILY, fontSize: '26px', fontStyle: 'bold', color: '#1d1b2f',
    }).setOrigin(0.5);
    button.add([bg, label]);
    button.setSize(220, 60).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => draw(0x7ad9f5));
    button.on('pointerout', () => draw(0x4cc9f0));
    // Solo for now. In Phase 5 only the host can restart the room.
    button.on('pointerup', () => this.scene.start('Game'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Game'));
  }

  startConfetti() {
    if (!this.textures.exists(CONFETTI_KEY)) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 8, 12);
      g.generateTexture(CONFETTI_KEY, 8, 12);
      g.destroy();
    }
    this.add.particles(0, -20, CONFETTI_KEY, {
      x: { min: 0, max: GAME_WIDTH },
      lifespan: 4000,
      speedY: { min: 80, max: 200 },
      speedX: { min: -40, max: 40 },
      rotate: { start: 0, end: 360 },
      tint: PLAYER_COLORS,
      frequency: 60,
      quantity: 2,
    }).setDepth(-1);
  }
}
