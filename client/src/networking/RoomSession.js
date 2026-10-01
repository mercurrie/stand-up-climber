import Phaser from 'phaser';
import { ClientMsg, ServerMsg } from '@stand-up-climber/shared';

/**
 * The client's view of "the room I'm in", on top of NetworkClient.
 *
 * Keeps the latest ROOM_STATE and re-emits server messages as friendlier
 * events that scenes listen to:
 *   'room'          latest room state { code, hostId, phase, players }
 *   'round-start'   { startAt, seed, playerIds }   (server clock)
 *   'snapshot'      { players }
 *   'first-finish'  { playerId, name, endsAt }       (server clock)
 *   'round-end'     { rankings }
 *   'notice'        { text }
 *   'error'         { code, message }
 *   'disconnected'  { wasInRoom }
 */
export class RoomSession extends Phaser.Events.EventEmitter {
  constructor(net) {
    super();
    this.net = net;
    this.room = null;

    net.on(ServerMsg.ROOM_STATE, (msg) => {
      this.room = msg;
      this.emit('room', msg);
    });
    net.on(ServerMsg.ROUND_START, (msg) => this.emit('round-start', msg));
    net.on(ServerMsg.SNAPSHOT, (msg) => this.emit('snapshot', msg));
    net.on(ServerMsg.FIRST_FINISH, (msg) => this.emit('first-finish', msg));
    net.on(ServerMsg.ROUND_END, (msg) => this.emit('round-end', msg));
    net.on(ServerMsg.NOTICE, (msg) => this.emit('notice', msg));
    net.on(ServerMsg.ERROR, (msg) => this.emit('error', msg));
    net.on('close', () => {
      const wasInRoom = Boolean(this.room);
      this.room = null;
      this.emit('disconnected', { wasInRoom });
    });
  }

  get localId() {
    return this.net.clientId;
  }

  get isHost() {
    return Boolean(this.room) && this.room.hostId === this.localId;
  }

  playerById(id) {
    return this.room?.players.find((p) => p.id === id) ?? null;
  }

  createRoom(name) {
    return this.net.send(ClientMsg.CREATE_ROOM, { name });
  }

  joinRoom(code, name) {
    return this.net.send(ClientMsg.JOIN_ROOM, { code, name });
  }

  leaveRoom() {
    this.net.send(ClientMsg.LEAVE_ROOM);
    this.room = null;
  }

  startRound() {
    return this.net.send(ClientMsg.START_ROUND);
  }

  sendPlayerState(state) {
    this.net.send(ClientMsg.PLAYER_STATE, state);
  }
}
