import Phaser from 'phaser';
import { Rules } from '@stand-up-climber/shared';

/**
 * A multiplayer round. Same interface as SoloRound (see there), but the
 * server is the referee: it runs RoundState and tells us when someone
 * finishes and when the round is over. We only:
 *   - convert the server's timestamps to local time,
 *   - keep the latest standings from snapshots for the leaderboard,
 *   - send our position/progress (throttled, plus immediately on progress).
 *
 * Extra event: 'snapshot' ({ players }) with everyone's latest position, used
 * to draw remote players.
 */
export class NetworkRound extends Phaser.Events.EventEmitter {
  constructor(session, { startAt, playerIds }) {
    super();
    this.session = session;
    this.localId = session.localId;
    this.startAt = session.net.serverToLocalTime(startAt);
    this.endsAt = this.startAt + Rules.ROUND_MAX_MS;
    this.someoneFinished = false;
    this.ended = false;

    // Names/colours for everyone in this round, captured at the start so the
    // results still show someone who left the room afterwards.
    this.roster = new Map(playerIds.map((id) => {
      const p = session.playerById(id) ?? { id, name: '???', color: 0xffffff };
      return [id, { id, name: p.name, color: p.color }];
    }));
    this.standings = [...this.roster.values()].map((p) => ({ ...p, current: 0, best: 0, finished: false }));

    this.localState = { x: 0, y: 0, flip: false, hidden: false, current: 0, best: 0, finished: false };
    this.lastSentAt = 0;

    this.listeners = {
      snapshot: (msg) => this.handleSnapshot(msg),
      'first-finish': (msg) => this.handleFirstFinish(msg),
      'round-end': (msg) => this.handleRoundEnd(msg),
    };
    Object.entries(this.listeners).forEach(([event, fn]) => session.on(event, fn));
  }

  get localPlayer() {
    return this.roster.get(this.localId);
  }

  phase(now) {
    if (this.ended) return 'ended';
    if (now < this.startAt) return 'countdown';
    return this.someoneFinished ? 'finishing' : 'playing';
  }

  reportProgress(progress) {
    Object.assign(this.localState, progress);
    this.send(Date.now());
  }

  /** Called every frame; only actually sends every CLIENT_STATE_INTERVAL_MS. */
  reportPosition(position, now) {
    Object.assign(this.localState, position);
    if (now - this.lastSentAt >= Rules.CLIENT_STATE_INTERVAL_MS) this.send(now);
  }

  send(now) {
    this.lastSentAt = now;
    this.session.sendPlayerState(this.localState);
  }

  update() {
    // Nothing to do: the server decides when the round ends.
  }

  handleSnapshot({ players }) {
    // Server sends players in rank order. Anyone missing has left the room.
    this.standings = players
      .filter((p) => this.roster.has(p.id))
      .map((p) => ({ ...this.roster.get(p.id), current: p.current, best: p.best, finished: p.finished }));
    this.emit('snapshot', { players: players.filter((p) => p.id !== this.localId) });
  }

  handleFirstFinish({ playerId, name, endsAt }) {
    this.someoneFinished = true;
    this.endsAt = this.session.net.serverToLocalTime(endsAt);
    this.emit('first-finish', { name, isLocal: playerId === this.localId, endsAt: this.endsAt });
  }

  handleRoundEnd({ rankings }) {
    this.ended = true;
    this.emit('ended', { rankings });
  }

  destroy() {
    Object.entries(this.listeners).forEach(([event, fn]) => this.session.off(event, fn));
    this.removeAllListeners();
  }
}
