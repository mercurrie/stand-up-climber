import { randomInt } from 'node:crypto';
import { ErrorCode, PLAYER_COLORS, RoundState, Rules, ServerMsg } from '@stand-up-climber/shared';

/**
 * One room: a lobby of players and, while playing, the official round.
 *
 * The server is the referee, not the physics engine. Clients simulate their
 * own movement and report position + progress; this class decides when the
 * round starts and ends and who won, using the shared RoundState rules with
 * the server's clock.
 *
 * Phases: 'lobby' → 'playing' → 'results' → (host starts again) → 'playing'…
 * People can join in any phase. Joining mid-round means waiting for the next
 * round (they aren't in the RoundState).
 */
export class GameRoom {
  constructor(code, { onEmpty }) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.players = new Map();
    this.hostId = null;
    this.phase = 'lobby';
    this.round = null;
    this.tickTimer = null;
  }

  get isFull() {
    return this.players.size >= Rules.MAX_PLAYERS;
  }

  addPlayer(player) {
    player.name = this.uniqueName(player.name);
    player.color = this.unusedColor();
    this.players.set(player.id, player);
    this.hostId ??= player.id;

    this.broadcast({ type: ServerMsg.NOTICE, text: `${player.name} joined` }, player.id);
    this.broadcastRoomState();
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);

    if (this.players.size === 0) {
      this.stopTicking();
      this.onEmpty(this);
      return;
    }

    let notice = `${player.name} left`;
    if (this.hostId === id) {
      // Hand host to whoever has been here longest (Map keeps insertion order).
      const newHost = this.players.values().next().value;
      this.hostId = newHost.id;
      notice += `. ${newHost.name} is now the host`;
    }

    if (this.round) {
      this.round.removePlayer(id);
      if (this.round.players.size === 0 || this.round.phase(Date.now()) === 'ended') this.endRound();
    }

    this.broadcast({ type: ServerMsg.NOTICE, text: notice });
    this.broadcastRoomState();
  }

  /** Returns an error code, or null on success. */
  startRound(requesterId) {
    if (requesterId !== this.hostId) return ErrorCode.NOT_HOST;
    if (this.phase === 'playing') return null;
    if (this.players.size < Rules.MIN_PLAYERS) return ErrorCode.NOT_ENOUGH_PLAYERS;

    const participants = [...this.players.values()];
    const startAt = Date.now() + Rules.ROUND_START_LEAD_MS + Rules.COUNTDOWN_MS;
    this.round = new RoundState({ startAt, players: participants.map((p) => p.toJSON()) });
    this.phase = 'playing';
    participants.forEach((p) => Object.assign(p, { x: 0, y: 0, flip: false, hidden: false }));

    // The seed is all clients need to generate identical obstacles.
    this.broadcast({
      type: ServerMsg.ROUND_START,
      startAt,
      seed: randomInt(1, 2 ** 31),
      playerIds: participants.map((p) => p.id),
    });
    this.broadcastRoomState();

    this.tickTimer = setInterval(() => this.tick(), Rules.SNAPSHOT_INTERVAL_MS);
    return null;
  }

  handlePlayerState(id, msg) {
    if (this.phase !== 'playing' || !this.round.players.has(id)) return;
    const player = this.players.get(id);
    if (Number.isFinite(msg.x)) player.x = Math.round(msg.x);
    if (Number.isFinite(msg.y)) player.y = Math.round(msg.y);
    player.flip = Boolean(msg.flip);
    player.hidden = Boolean(msg.hidden);

    const event = this.round.updateProgress(id, msg, Date.now());
    if (event?.type === 'first-finish') {
      this.broadcast({ type: ServerMsg.FIRST_FINISH, playerId: id, name: event.player.name, endsAt: event.endsAt });
    } else if (event?.type === 'ended') {
      this.endRound();
    }
  }

  tick() {
    if (this.round.phase(Date.now()) === 'ended') {
      this.endRound();
      return;
    }
    const players = this.round.rankings().map((r) => {
      const p = this.players.get(r.id);
      return { id: r.id, x: p.x, y: p.y, flip: p.flip, hidden: p.hidden, current: r.current, best: r.best, finished: r.finished };
    });
    this.broadcast({ type: ServerMsg.SNAPSHOT, players });
  }

  endRound() {
    if (this.phase !== 'playing') return;
    this.stopTicking();
    this.phase = 'results';
    this.broadcast({ type: ServerMsg.ROUND_END, rankings: this.round.rankings() });
    this.round = null;
    this.broadcastRoomState();
  }

  stopTicking() {
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  broadcastRoomState() {
    this.broadcast({
      type: ServerMsg.ROOM_STATE,
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      players: [...this.players.values()].map((p) => ({
        ...p.toJSON(),
        inRound: Boolean(this.round?.players.has(p.id)),
      })),
    });
  }

  broadcast(msg, exceptId = null) {
    for (const player of this.players.values()) {
      if (player.id !== exceptId) player.send(msg);
    }
  }

  uniqueName(name) {
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; ; n++) {
      const candidate = `${name.slice(0, Rules.MAX_NAME_LENGTH - 2)} ${n}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  unusedColor() {
    const used = new Set([...this.players.values()].map((p) => p.color));
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
  }
}
