import Phaser from 'phaser';
import { RoundState, Rules } from '@stand-up-climber/shared';

/**
 * A round played offline, with the rules running locally.
 *
 * GameScene only talks to a "round" through this small interface:
 *   startAt, endsAt, phase(now), standings, localId
 *   reportProgress({ current, best, finished })
 *   update(now)
 *   events: 'first-finish' ({ name, isLocal, endsAt }), 'ended' ({ rankings })
 *
 * Phase 5 adds a network-backed round with the same interface, where the
 * server runs RoundState and these events come from server messages.
 * All times here are local Date.now() milliseconds.
 */
export class SoloRound extends Phaser.Events.EventEmitter {
  constructor({ player, now = Date.now() }) {
    super();
    this.localId = player.id;
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
      this.emit('first-finish', { name: event.player.name, isLocal: event.player.id === this.localId, endsAt: event.endsAt });
    }
  }

  update(now) {
    if (!this.endedEmitted && this.phase(now) === 'ended') {
      this.endedEmitted = true;
      this.emit('ended', { rankings: this.state.rankings() });
    }
  }
}
