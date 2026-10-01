import Phaser from 'phaser';
import { RoundState, Rules } from '@stand-up-climber/shared';

/**
 * A practice round played offline, with the rules running locally.
 *
 * GameScene only talks to a "round" through this small interface, which
 * NetworkRound implements too:
 *   startAt, endsAt, phase(now), standings, localId, localPlayer
 *   reportProgress({ current, best, finished })
 *   reportPosition({ x, y, flip, hidden }, now)
 *   update(now), destroy()
 *   events: 'first-finish' ({ name, isLocal }), 'ended' ({ rankings })
 *
 * All times are local Date.now() milliseconds.
 */
export class SoloRound extends Phaser.Events.EventEmitter {
  constructor({ player, now = Date.now() }) {
    super();
    this.localId = player.id;
    this.localPlayer = player;
    this.state = new RoundState({ startAt: now + Rules.COUNTDOWN_MS, players: [player] });
    this.endedEmitted = false;
  }

  get startAt() {
    return this.state.startAt;
  }

  get endsAt() {
    return this.state.endsAt;
  }

  get standings() {
    return this.state.rankings();
  }

  phase(now) {
    return this.state.phase(now);
  }

  reportProgress(progress) {
    const event = this.state.updateProgress(this.localId, progress, Date.now());
    if (event?.type === 'first-finish') {
      this.emit('first-finish', { name: event.player.name, isLocal: event.player.id === this.localId });
    }
  }

  reportPosition() {
    // Nobody to tell.
  }

  update(now) {
    if (!this.endedEmitted && this.phase(now) === 'ended') {
      this.endedEmitted = true;
      this.emit('ended', { rankings: this.state.rankings() });
    }
  }

  destroy() {
    this.removeAllListeners();
  }
}
