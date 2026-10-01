import { randomInt, randomUUID } from 'node:crypto';
import { ClientMsg, ErrorCode, Rules, ServerMsg } from '@stand-up-climber/shared';
import { GameRoom } from './GameRoom.js';
import { Player } from './Player.js';

// How often we ping sockets to detect dead connections (closed laptop lids,
// dropped Wi-Fi). Without this, `close` may not fire for a long time.
const HEARTBEAT_MS = 15_000;
// No 0/O or 1/I, so codes are easy to read out loud.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Owns all WebSocket connections and the room registry, and routes incoming
 * messages to the right GameRoom. Game rules live in GameRoom/RoundState.
 */
export class GameServer {
  constructor(wss) {
    this.wss = wss;
    this.rooms = new Map();
    this.wss.on('connection', (socket) => this.handleConnection(socket));
    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_MS);
  }

  handleConnection(socket) {
    socket.id = randomUUID();
    socket.isAlive = true;
    socket.room = null;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (raw) => this.handleMessage(socket, raw));
    socket.on('close', () => this.leaveRoom(socket));

    send(socket, { type: ServerMsg.WELCOME, clientId: socket.id, serverTime: Date.now() });
  }

  handleMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      sendError(socket, ErrorCode.BAD_REQUEST, 'Invalid JSON');
      return;
    }

    switch (msg.type) {
      case ClientMsg.PING:
        // Echo the client's timestamp so it can measure round-trip time and
        // estimate the offset between its clock and ours. That offset is what
        // lets every client start the round at the same moment.
        send(socket, { type: ServerMsg.PONG, clientTime: msg.clientTime, serverTime: Date.now() });
        break;
      case ClientMsg.CREATE_ROOM:
        this.createRoom(socket, msg);
        break;
      case ClientMsg.JOIN_ROOM:
        this.joinRoom(socket, msg);
        break;
      case ClientMsg.LEAVE_ROOM:
        this.leaveRoom(socket);
        break;
      case ClientMsg.START_ROUND: {
        const error = socket.room?.startRound(socket.id);
        if (error) sendError(socket, error, startRoundErrorMessage(error));
        break;
      }
      case ClientMsg.PLAYER_STATE:
        socket.room?.handlePlayerState(socket.id, msg);
        break;
      default:
        sendError(socket, ErrorCode.BAD_REQUEST, `Unknown message type: ${msg.type}`);
    }
  }

  createRoom(socket, { name }) {
    const cleanName = sanitizeName(name);
    if (!cleanName) return sendError(socket, ErrorCode.BAD_REQUEST, 'Please enter a name');

    const code = this.newRoomCode();
    const room = new GameRoom(code, { onEmpty: (r) => this.deleteRoom(r) });
    this.rooms.set(code, room);
    console.log(`[server] room ${code} created (${this.rooms.size} active)`);
    this.addToRoom(socket, room, cleanName);
  }

  joinRoom(socket, { code, name }) {
    const cleanName = sanitizeName(name);
    if (!cleanName) return sendError(socket, ErrorCode.BAD_REQUEST, 'Please enter a name');

    const room = this.rooms.get(String(code ?? '').trim().toUpperCase());
    if (!room) return sendError(socket, ErrorCode.ROOM_NOT_FOUND, `No room with code "${code}"`);
    if (room.isFull) return sendError(socket, ErrorCode.ROOM_FULL, 'That room is full');
    this.addToRoom(socket, room, cleanName);
  }

  addToRoom(socket, room, name) {
    if (socket.room === room) return;
    this.leaveRoom(socket);
    socket.room = room;
    room.addPlayer(new Player({ id: socket.id, socket, name }));
  }

  leaveRoom(socket) {
    const room = socket.room;
    if (!room) return;
    socket.room = null;
    room.removePlayer(socket.id);
  }

  deleteRoom(room) {
    this.rooms.delete(room.code);
    console.log(`[server] room ${room.code} closed (${this.rooms.size} active)`);
  }

  newRoomCode() {
    let code;
    do {
      code = Array.from({ length: Rules.ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  checkHeartbeats() {
    for (const socket of this.wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }

  stats() {
    return { connections: this.wss.clients.size, rooms: this.rooms.size };
  }

  close() {
    clearInterval(this.heartbeat);
    this.rooms.forEach((room) => room.stopTicking());
    this.wss.close();
  }
}

function sanitizeName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, Rules.MAX_NAME_LENGTH);
}

function startRoundErrorMessage(code) {
  if (code === ErrorCode.NOT_HOST) return 'Only the host can start the game';
  if (code === ErrorCode.NOT_ENOUGH_PLAYERS) return `Need at least ${Rules.MIN_PLAYERS} players`;
  return 'Could not start the game';
}

function send(socket, msg) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

function sendError(socket, code, message) {
  send(socket, { type: ServerMsg.ERROR, code, message });
}
