// Shared between client and server so both sides agree on message names and
// round timing. Keep this file dependency-free: it runs in Node and the browser.
//
// Every WebSocket message is a JSON object of the form { type, ...payload }.
// All timestamps in messages are on the *server's* clock; clients convert
// them with NetworkClient.serverToLocalTime().

/** Messages sent from a client to the server. */
export const ClientMsg = Object.freeze({
  // Clock sync: { clientTime }. Server replies with PONG.
  PING: 'ping',
  // { name }
  CREATE_ROOM: 'create_room',
  // { code, name }
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  // Host only. Starts a round from the lobby or the results screen.
  START_ROUND: 'start_round',
  // During a round, ~10/s and whenever progress changes:
  // { x, y, flip, hidden, current, best, finished }
  PLAYER_STATE: 'player_state',
});

/** Messages sent from the server to a client. */
export const ServerMsg = Object.freeze({
  // { clientId, serverTime }
  WELCOME: 'welcome',
  // { clientTime, serverTime }
  PONG: 'pong',
  // { code, message }  (codes: see ErrorCode)
  ERROR: 'error',
  // Sent on any membership/phase change.
  // { code, hostId, phase: 'lobby'|'playing'|'results', players: [{ id, name, color, inRound }] }
  ROOM_STATE: 'room_state',
  // { startAt, seed, playerIds }
  ROUND_START: 'round_start',
  // ~10/s during a round. Players are in rank order.
  // { players: [{ id, x, y, flip, hidden, current, best, finished }] }
  SNAPSHOT: 'snapshot',
  // { playerId, name, endsAt }
  FIRST_FINISH: 'first_finish',
  // { rankings: [{ id, name, color, current, best, finished }] }
  ROUND_END: 'round_end',
  // A short human-readable message, e.g. "Sam left". { text }
  NOTICE: 'notice',
});

export const ErrorCode = Object.freeze({
  BAD_REQUEST: 'bad_request',
  ROOM_NOT_FOUND: 'room_not_found',
  ROOM_FULL: 'room_full',
  NOT_HOST: 'not_host',
  NOT_ENOUGH_PLAYERS: 'not_enough_players',
});

/** Room and round rules. Values the server enforces live here. */
export const Rules = Object.freeze({
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  MAX_NAME_LENGTH: 12,
  ROOM_CODE_LENGTH: 4,
  COUNTDOWN_MS: 3000,
  // Extra time between "start" and the countdown so the ROUND_START message
  // reaches every client before "3" appears.
  ROUND_START_LEAD_MS: 600,
  ROUND_MAX_MS: 90_000,
  FINISH_WINDOW_MS: 10_000,
  // Network rates during a round.
  SNAPSHOT_INTERVAL_MS: 100,
  CLIENT_STATE_INTERVAL_MS: 100,
});

// One per player slot (rooms hold up to 10). The server assigns them so
// everyone sees the same colour for the same person.
export const PLAYER_COLORS = Object.freeze([
  0xff6b9d, 0x4cc9f0, 0xffd166, 0x7ee081, 0xb388ff,
  0xff9f43, 0x00d2d3, 0xf368e0, 0xc8d6e5, 0xee5253,
]);

export const DEFAULT_SERVER_PORT = 8080;
