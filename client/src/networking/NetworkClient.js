import { ClientMsg, ServerMsg } from '@stand-up-climber/shared';

const PING_INTERVAL_MS = 2000;
// Right after connecting, take a few quick samples so the clock estimate is
// good before anyone can press "start".
const INITIAL_PINGS = 5;
const INITIAL_PING_SPACING_MS = 150;
const CLOCK_SAMPLES = 8;
const RECONNECT_DELAY_MS = 2000;

/**
 * Thin wrapper around a browser WebSocket.
 *
 * - Parses/serialises JSON messages of the form { type, ...payload }.
 * - Lets code subscribe to message types with on(type, handler); also emits
 *   'open' and 'close'.
 * - Pings the server regularly to estimate the server clock offset, so server
 *   timestamps (like the official round start) can be converted to local time.
 * - Reconnects automatically if the connection drops.
 *
 * Only one instance exists; it's created in main.js.
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
    this.clockSamples = [];
    this.pingTimer = null;

    this.on(ServerMsg.WELCOME, (msg) => { this.clientId = msg.clientId; });
    this.on(ServerMsg.PONG, (msg) => this.handlePong(msg));
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('open', () => this.handleOpen());
    this.socket.addEventListener('close', () => this.handleClose());
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));
  }

  get isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Returns false if not connected (the message is dropped). */
  send(type, payload = {}) {
    if (!this.isConnected) return false;
    this.socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  /** Subscribe to a message type (or 'open'/'close'). Returns an unsubscribe fn. */
  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  emit(type, msg) {
    this.handlers.get(type)?.forEach((handler) => handler(msg));
  }

  handleOpen() {
    this.clockSamples = [];
    for (let i = 0; i < INITIAL_PINGS; i++) setTimeout(() => this.ping(), i * INITIAL_PING_SPACING_MS);
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
    this.emit('open');
  }

  handleClose() {
    clearInterval(this.pingTimer);
    this.clientId = null;
    this.emit('close');
    setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
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

  // NTP-style estimate: assume the reply took half the round trip. Network
  // jitter makes single samples noisy, so we keep the last few and trust the
  // one with the lowest round-trip time (least time for delays to sneak in).
  // Good to within a few ms on a normal connection: plenty for a casual game.
  handlePong({ clientTime, serverTime }) {
    const now = Date.now();
    const rtt = now - clientTime;
    this.latencyMs = rtt;
    this.clockSamples.push({ rtt, offset: serverTime + rtt / 2 - now });
    if (this.clockSamples.length > CLOCK_SAMPLES) this.clockSamples.shift();
    const best = this.clockSamples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    this.clockOffsetMs = best.offset;
  }

  /** Convert a server timestamp to the equivalent local Date.now() value. */
  serverToLocalTime(serverTime) {
    return serverTime - this.clockOffsetMs;
  }
}
