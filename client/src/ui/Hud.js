import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';
import { LEADERBOARD_WIDTH, Leaderboard } from './Leaderboard.js';
import { formatClock, formatPercent } from './format.js';

const DEPTH = 100;

/**
 * Everything drawn on top of the game, fixed to the screen: round timer, your
 * progress, live leaderboard, countdown numbers and announcement banners.
 * Holds no game state; GameScene feeds it each frame.
 */
export class Hud {
  constructor(scene) {
    this.scene = scene;
    const fixed = (obj) => obj.setScrollFactor(0).setDepth(DEPTH);
    const style = (size, color = COLORS.text) => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#1d1b2f',
      strokeThickness: 4,
    });

    this.timer = fixed(scene.add.text(14, 10, '', style(30)));
    this.progress = fixed(scene.add.text(14, 48, '', style(15, COLORS.textMuted)));
    this.leaderboard = new Leaderboard(scene, GAME_WIDTH - LEADERBOARD_WIDTH - 10, 10);

    this.countdown = fixed(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.38, '', style(120, COLORS.accent)))
      .setOrigin(0.5).setStroke('#1d1b2f', 10);
    this.banner = fixed(scene.add.text(GAME_WIDTH / 2, 150, '', { ...style(24, COLORS.accent), align: 'center' }))
      .setOrigin(0.5).setAlpha(0);

    this.lastCountdownLabel = null;
  }

  update({ now, phase, round, current, best }) {
    this.updateTimer(now, phase, round);
    this.progress.setText(`Now ${formatPercent(current)}  ·  Best ${formatPercent(best)}`);
    this.leaderboard.update(round.standings, round.localId);
    this.updateCountdown(now, phase, round.startAt);
  }

  updateTimer(now, phase, round) {
    if (phase === 'countdown') {
      this.timer.setText(formatClock(round.endsAt - round.startAt)).setColor(COLORS.text);
    } else {
      // Red in the finishing window and the last 10 seconds.
      const remaining = round.endsAt - now;
      const urgent = phase === 'finishing' || remaining <= 10_000;
      this.timer.setText(formatClock(remaining)).setColor(urgent ? COLORS.bad : COLORS.text);
    }
  }

  // Derived from the shared start time each frame (not a local timer), so
  // every player's "3, 2, 1, GO!" lines up.
  updateCountdown(now, phase, startAt) {
    let label = '';
    if (phase === 'countdown') label = String(Math.ceil((startAt - now) / 1000));
    else if (now - startAt < 700) label = 'GO!';
    if (label === this.lastCountdownLabel) return;
    this.lastCountdownLabel = label;

    this.countdown.setText(label);
    if (!label) return;
    this.scene.tweens.killTweensOf(this.countdown);
    this.countdown.setScale(1.6).setAlpha(1);
    this.scene.tweens.add({ targets: this.countdown, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  /** A short announcement under the timer. Stays up if `holdMs` is null. */
  announce(text, { holdMs = 2500, color = COLORS.accent } = {}) {
    this.scene.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setColor(color).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({ targets: this.banner, scale: 1, duration: 350, ease: 'Back.easeOut' });
    if (holdMs !== null) {
      this.scene.tweens.add({ targets: this.banner, alpha: 0, delay: holdMs, duration: 500 });
    }
  }
}
