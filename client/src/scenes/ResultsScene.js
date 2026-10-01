import Phaser from 'phaser';
import { Rules } from '@stand-up-climber/shared';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT, PLAYER_COLORS } from '../config/display.js';
import { MEDALS, formatPercent, hostingLine } from '../ui/format.js';
import { Button } from '../ui/Button.js';
import { PLAYER_TEXTURE, ensurePlayerTexture } from '../entities/playerTexture.js';

const ROW_HEIGHT = 34;
const CONFETTI_KEY = 'confetti';
const SMALL_BUTTON = { width: 140, height: 40, fontSize: 16, variant: 'secondary' };

/**
 * Final standings and the all-important announcement of next week's host.
 *
 * data: { rankings: [{ id, name, color, best, finished }], localId, solo }
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super('Results');
  }

  create({ rankings, localId, solo }) {
    ensurePlayerTexture(this);
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
    const announceY = GAME_HEIGHT - 265;
    if (winner) {
      const hero = this.add.image(cx, announceY - 12, PLAYER_TEXTURE).setTint(winner.color).setScale(1.5).setOrigin(0.5, 1);
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

    if (solo) this.createSoloButtons(cx);
    else this.createRoomButtons(cx);
  }

  createSoloButtons(cx) {
    const playAgain = () => this.scene.start('Game');
    new Button(this, cx, GAME_HEIGHT - 100, 'PLAY AGAIN', playAgain);
    new Button(this, cx, GAME_HEIGHT - 38, 'Menu', () => this.scene.start('Menu'), SMALL_BUTTON);
    this.input.keyboard.once('keydown-ENTER', playAgain);
  }

  // Multiplayer: only the host can restart the room (ROUND_START then moves
  // everyone to the game, see main.js). The host can change while we're here,
  // so re-render on room updates.
  createRoomButtons(cx) {
    const session = this.registry.get('session');
    const playAgain = new Button(this, cx, GAME_HEIGHT - 100, 'PLAY AGAIN', () => session.startRound());
    const waiting = this.add.text(cx, GAME_HEIGHT - 100, 'Waiting for the host to\nstart the next round…', {
      fontFamily: FONT_FAMILY, fontSize: '18px', fontStyle: 'bold', color: COLORS.textMuted, align: 'center',
    }).setOrigin(0.5);
    new Button(this, cx, GAME_HEIGHT - 38, 'Lobby', () => this.scene.start('Lobby'), SMALL_BUTTON);

    const render = () => {
      const canStart = session.isHost && (session.room?.players.length ?? 0) >= Rules.MIN_PLAYERS;
      playAgain.setVisible(session.isHost).setEnabled(canStart);
      waiting.setVisible(!session.isHost);
    };
    render();
    session.on('room', render);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => session.off('room', render));
    this.input.keyboard.on('keydown-ENTER', () => playAgain.visible && playAgain.enabled && session.startRound());
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
