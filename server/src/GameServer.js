import { randomUUID } from 'node:crypto';
import { ClientMsg, ServerMsg } from '@stand-up-climber/shared';

// How often we ping sockets to detect dead connections (closed laptop lids,
// dropped Wi-Fi). Without this, `close` may not fire for a long time.
const HEARTBEAT_MS = 15_000;

/**
 * Owns all WebSocket connections and routes incoming messages.
 * Room management (create/join/leave) is added in Phase 5 via GameRoom.
 */
export class GameServer {
  constructor(wss) {
    this.wss = wss;
    this.wss.on('connection', (socket) => this.handleConnection(socket));
    this.heartbeat = setInterval(() => this.checkHeartbeats(), HEARTBEAT_MS);
  }

  handleConnection(socket) {
    socket.id = randomUUID();
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', (raw) => this.handleMessage(socket, raw));
    socket.on('close', () => console.log(`[server] client ${socket.id} disconnected`));

    console.log(`[server] client ${socket.id} connected`);
    send(socket, { type: ServerMsg.WELCOME, clientId: socket.id, serverTime: Date.now() });
  }

  handleMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      send(socket, { type: ServerMsg.ERROR, message: 'Invalid JSON' });
      return;
    }

    switch (msg.type) {
      case ClientMsg.PING:
        // Echo the client's timestamp so it can measure round-trip time and
        // estimate the offset between its clock and ours. That offset is what
        // lets every client start the round at the same moment.
        send(socket, { type: ServerMsg.PONG, clientTime: msg.clientTime, serverTime: Date.now() });
        break;
      default:
        send(socket, { type: ServerMsg.ERROR, message: `Unknown message type: ${msg.type}` });
    }
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
    return { connections: this.wss.clients.size };
  }

  close() {
    clearInterval(this.heartbeat);
    this.wss.close();
  }
}

function send(socket, msg) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}
