import { ClientMsg, ServerMsg } from '@stand-up-climber/shared';

/**
 * Thin wrapper around a browser WebSocket.
 *
 * - Parses/serialises JSON messages of the form { type, ...payload }.
 * - Lets scenes subscribe to message types with on(type, handler).
 * - Keeps an estimate of the server clock offset, so the client can convert
 *   server timestamps (like an official round start time) into local time.
 *
 * Only one instance should exist; scenes share it via the Phaser registry.
 */
export class NetworkClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.handlers = new Map();
    this.clientId = null;
    this.latencyMs = null;
    // serverTime ≈ Date.now() + clockOffsetMs
    this.clockOffsetMs = 0;
  }

  connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('open', () => this.emit('open'));
    this.socket.addEventListener('close', () => this.emit('close'));
    this.socket.addEventListener('error', () => this.emit('error'));
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));

    this.on(ServerMsg.WELCOME, (msg) => { this.clientId = msg.clientId; });
    this.on(ServerMsg.PONG, (msg) => this.handlePong(msg));
  }

  get isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send(type, payload = {}) {
    if (!this.isConnected) return;
    this.socket.send(JSON.stringify({ type, ...payload }));
  }

  /** Subscribe to a message type (or 'open'/'close'/'error'). Returns an unsubscribe fn. */
  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  emit(type, msg) {
    this.handlers.get(type)?.forEach((handler) => handler(msg));
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[net] ignoring non-JSON message', raw);
      return;
    }
    this.emit(msg.type, msg);
  }

  ping() {
    this.send(ClientMsg.PING, { clientTime: Date.now() });
  }

  // Simple NTP-style estimate: assume the pong took half the round trip to
  // reach us. Good to within a few ms on a normal connection, which is plenty
  // for a casual game.
  handlePong({ clientTime, serverTime }) {
    const now = Date.now();
    this.latencyMs = now - clientTime;
    this.clockOffsetMs = serverTime + this.latencyMs / 2 - now;
  }

  /** Convert a server timestamp to the equivalent local Date.now() value. */
  serverToLocalTime(serverTime) {
    return serverTime - this.clockOffsetMs;
  }
}
