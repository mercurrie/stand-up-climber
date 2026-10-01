import { DEFAULT_HAT, Rules } from './protocol.js';

/**
 * The rules of one round, as pure logic with no I/O and no timers. Callers
 * pass in the current time, so it's easy to reason about and test.
 *
 * Multiplayer: the server owns the official RoundState and uses its own clock.
 * In solo play the client runs one locally. Both use this same code, so the
 * rules can't diverge.
 *
 * Timeline (all times are ms timestamps on the owner's clock):
 *   countdown  [createdAt, startAt)
 *   playing    [startAt, endsAt)    endsAt = startAt + ROUND_MAX_MS
 *   finishing  once someone reaches the top: endsAt = topAt + FINISH_WINDOW_MS
 *   ended      at endsAt, or early once every player has reached the top
 *
 * Progress values are fractions 0..1 of the course height.
 */
export class RoundState {
  constructor({ startAt, players }) {
    this.startAt = startAt;
    this.endsAt = startAt + Rules.ROUND_MAX_MS;
    this.firstFinisherId = null;
    this.endedEarly = false;
    this.players = new Map();
    players.forEach((p, joinOrder) => {
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        hat: p.hat ?? DEFAULT_HAT,
        joinOrder,
        current: 0,
        best: 0,
        bestAt: null,
        finishedAt: null,
      });
    });
  }

  phase(now) {
    if (this.endedEarly || now >= this.endsAt) return 'ended';
    if (now < this.startAt) return 'countdown';
    return this.firstFinisherId ? 'finishing' : 'playing';
  }

  /**
   * Record a player's progress. Returns an event when something round-changing
   * happened: { type: 'first-finish', player, endsAt } or { type: 'ended' }.
   */
  updateProgress(id, { current, best, finished }, now) {
    const player = this.players.get(id);
    const phase = this.phase(now);
    if (!player || phase === 'countdown' || phase === 'ended') return null;

    player.current = clamp01(current);
    // Best only ever goes up, and remembers when it was reached (tiebreaker).
    const reported = clamp01(best);
    if (reported > player.best) {
      player.best = reported;
      player.bestAt = now;
    }

    if (finished && player.finishedAt === null) {
      player.finishedAt = now;
      player.best = 1;
      player.bestAt ??= now;

      if (!this.firstFinisherId) {
        this.firstFinisherId = id;
        this.endsAt = now + Rules.FINISH_WINDOW_MS;
        if (this.allFinished()) this.endedEarly = true;
        return this.endedEarly ? { type: 'ended' } : { type: 'first-finish', player: { ...player }, endsAt: this.endsAt };
      }
      if (this.allFinished()) {
        this.endedEarly = true;
        return { type: 'ended' };
      }
    }
    return null;
  }

  removePlayer(id) {
    this.players.delete(id);
    // Leaving can also mean "everyone remaining has finished".
    if (this.firstFinisherId && this.players.size > 0 && this.allFinished()) this.endedEarly = true;
  }

  allFinished() {
    for (const p of this.players.values()) if (p.finishedAt === null) return false;
    return true;
  }

  /** Highest best progress first; ties go to whoever reached it earliest. */
  rankings() {
    return [...this.players.values()]
      .sort((a, b) =>
        b.best - a.best
        || (a.bestAt ?? Infinity) - (b.bestAt ?? Infinity)
        || a.joinOrder - b.joinOrder)
      .map(({ id, name, color, hat, current, best, finishedAt }) => ({ id, name, color, hat, current, best, finished: finishedAt !== null }));
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
