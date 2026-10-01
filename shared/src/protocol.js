// Shared between client and server so both sides agree on message names and
// round timing. Keep this file dependency-free: it runs in Node and the browser.
//
// Every WebSocket message is a JSON object of the form { type, ...payload }.

/** Messages sent from a client to the server. */
export const ClientMsg = Object.freeze({
  // Clock sync: client sends its local time, server echoes it with server time.
  PING: 'ping',
});

/** Messages sent from the server to a client. */
export const ServerMsg = Object.freeze({
  WELCOME: 'welcome',
  PONG: 'pong',
  ERROR: 'error',
});

/** Room and round rules. Values the server enforces live here. */
export const Rules = Object.freeze({
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  COUNTDOWN_MS: 3000,
  ROUND_MAX_MS: 90_000,
  FINISH_WINDOW_MS: 10_000,
});

export const DEFAULT_SERVER_PORT = 8080;
