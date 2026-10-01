import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { ClientMsg, ErrorCode, Rules, ServerMsg } from '@stand-up-climber/shared';
import { GameServer } from '../src/GameServer.js';

let httpServer;
let gameServer;
let url;

before(async () => {
  httpServer = http.createServer();
  gameServer = new GameServer(new WebSocketServer({ server: httpServer }));
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `ws://localhost:${httpServer.address().port}`;
});

after(() => {
  gameServer.close();
  httpServer.close();
});

/** A tiny test client that records messages and can wait for a given type. */
async function connect() {
  const socket = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  socket.on('message', (raw) => {
    const msg = JSON.parse(raw);
    inbox.push(msg);
    for (const w of [...waiters]) {
      if (w.match(msg)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg);
      }
    }
  });
  const client = {
    socket,
    inbox,
    send: (type, payload = {}) => socket.send(JSON.stringify({ type, ...payload })),
    /** Resolve with the next message of `type` (optionally matching `pred`) that arrives after this call. */
    next(type, pred = () => true) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 6000);
        waiters.push({ match: (m) => m.type === type && pred(m), resolve: (m) => { clearTimeout(timer); resolve(m); } });
      });
    },
    close: () => socket.close(),
  };
  const welcome = await client.next(ServerMsg.WELCOME);
  client.id = welcome.clientId;
  return client;
}

test('create, join, start, finish, results, host transfer', async (t) => {
  const host = await connect();
  const guest = await connect();
  t.after(() => { host.close(); guest.close(); });

  // Create
  host.send(ClientMsg.CREATE_ROOM, { name: '  Mason  ' });
  const created = await host.next(ServerMsg.ROOM_STATE);
  assert.match(created.code, /^[A-Z2-9]{4}$/);
  assert.equal(created.hostId, host.id);
  assert.equal(created.players[0].name, 'Mason');

  // Starting alone is refused
  host.send(ClientMsg.START_ROUND);
  const tooFew = await host.next(ServerMsg.ERROR);
  assert.equal(tooFew.code, ErrorCode.NOT_ENOUGH_PLAYERS);

  // Join (lower-case code works; duplicate name gets a suffix)
  const joinedState = host.next(ServerMsg.ROOM_STATE, (m) => m.players.length === 2);
  const joinedNotice = host.next(ServerMsg.NOTICE);
  guest.send(ClientMsg.JOIN_ROOM, { code: created.code.toLowerCase(), name: 'mason' });
  const lobby = await joinedState;
  assert.deepEqual(lobby.players.map((p) => p.name), ['Mason', 'mason 2']);
  assert.notEqual(lobby.players[0].color, lobby.players[1].color);
  assert.match((await joinedNotice).text, /mason 2 joined/);

  // Only the host can start
  guest.send(ClientMsg.START_ROUND);
  assert.equal((await guest.next(ServerMsg.ERROR)).code, ErrorCode.NOT_HOST);

  // Start: both get the same seed and start time
  const hostStart = host.next(ServerMsg.ROUND_START);
  const guestStart = guest.next(ServerMsg.ROUND_START);
  host.send(ClientMsg.START_ROUND);
  const [a, b] = await Promise.all([hostStart, guestStart]);
  assert.equal(a.seed, b.seed);
  assert.equal(a.startAt, b.startAt);
  assert.equal(a.startAt - Date.now() > Rules.COUNTDOWN_MS, true);

  // Wait for the countdown, then report progress
  await new Promise((r) => setTimeout(r, a.startAt - Date.now() + 50));
  guest.send(ClientMsg.PLAYER_STATE, { x: 100, y: 200, current: 0.5, best: 0.5 });
  const snap = await host.next(ServerMsg.SNAPSHOT, (m) => m.players.some((p) => p.best === 0.5));
  assert.equal(snap.players[0].id, guest.id, 'leader is first');
  assert.equal(snap.players[0].x, 100);

  // Host reaches the top → finishing window
  host.send(ClientMsg.PLAYER_STATE, { x: 0, y: 0, current: 1, best: 1, finished: true });
  const firstFinish = await guest.next(ServerMsg.FIRST_FINISH);
  assert.equal(firstFinish.playerId, host.id);
  assert.equal(firstFinish.endsAt > Date.now(), true);

  // Guest finishes too → round ends early, host wins
  const endMsg = host.next(ServerMsg.ROUND_END);
  const resultsState = host.next(ServerMsg.ROOM_STATE, (m) => m.phase === 'results');
  guest.send(ClientMsg.PLAYER_STATE, { current: 1, best: 1, finished: true });
  const end = await endMsg;
  assert.deepEqual(end.rankings.map((r) => r.name), ['Mason', 'mason 2']);
  assert.equal((await resultsState).phase, 'results');

  // Host leaves → guest becomes host
  const transferred = guest.next(ServerMsg.ROOM_STATE, (m) => m.players.length === 1);
  host.close();
  assert.equal((await transferred).hostId, guest.id);
});

test('leaving mid-round removes the player from the round', async (t) => {
  const host = await connect();
  const guest = await connect();
  t.after(() => { host.close(); guest.close(); });

  host.send(ClientMsg.CREATE_ROOM, { name: 'Host' });
  const { code } = await host.next(ServerMsg.ROOM_STATE);
  guest.send(ClientMsg.JOIN_ROOM, { code, name: 'Guest' });
  await host.next(ServerMsg.ROOM_STATE, (m) => m.players.length === 2);

  host.send(ClientMsg.START_ROUND);
  const start = await host.next(ServerMsg.ROUND_START);
  await new Promise((r) => setTimeout(r, start.startAt - Date.now() + 50));

  const leftNotice = host.next(ServerMsg.NOTICE, (m) => /left/.test(m.text));
  guest.close();
  assert.match((await leftNotice).text, /Guest left/);
  const snap = await host.next(ServerMsg.SNAPSHOT);
  assert.deepEqual(snap.players.map((p) => p.id), [host.id]);
});

test('looks: preferred colour/hat on join, unique colours, hat in results', async (t) => {
  const [red, blue] = [0xff6b9d, 0x4cc9f0];
  const host = await connect();
  const guest = await connect();
  t.after(() => { host.close(); guest.close(); });

  host.send(ClientMsg.CREATE_ROOM, { name: 'Host', look: { color: blue, hat: 'pirate' } });
  const created = await host.next(ServerMsg.ROOM_STATE);
  assert.deepEqual(created.players.map((p) => [p.color, p.hat]), [[blue, 'pirate']]);

  // Guest prefers the same colour: they get a different one; bogus hat → none.
  const joined = host.next(ServerMsg.ROOM_STATE, (m) => m.players.length === 2);
  guest.send(ClientMsg.JOIN_ROOM, { code: created.code, name: 'Guest', look: { color: blue, hat: 'sombrero' } });
  const lobby = await joined;
  const guestInfo = lobby.players.find((p) => p.id === guest.id);
  assert.notEqual(guestInfo.color, blue);
  assert.equal(guestInfo.hat, 'none');

  // Taking someone else's colour is refused; a free colour and a real hat work.
  guest.send(ClientMsg.SET_LOOK, { color: blue });
  assert.equal((await guest.next(ServerMsg.ERROR)).code, ErrorCode.COLOR_TAKEN);
  const changed = host.next(ServerMsg.ROOM_STATE, (m) => m.players.some((p) => p.id === guest.id && p.hat === 'propeller'));
  guest.send(ClientMsg.SET_LOOK, { color: red, hat: 'propeller' });
  const after = (await changed).players.find((p) => p.id === guest.id);
  assert.deepEqual([after.color, after.hat], [red, 'propeller']);

  // Hats come through in the final rankings.
  host.send(ClientMsg.START_ROUND);
  const start = await host.next(ServerMsg.ROUND_START);
  await new Promise((r) => setTimeout(r, start.startAt - Date.now() + 50));
  const end = host.next(ServerMsg.ROUND_END);
  host.send(ClientMsg.PLAYER_STATE, { finished: true });
  guest.send(ClientMsg.PLAYER_STATE, { finished: true });
  assert.deepEqual((await end).rankings.map((r) => r.hat), ['pirate', 'propeller']);
});

test('joining an unknown room fails clearly', async (t) => {
  const client = await connect();
  t.after(() => client.close());
  client.send(ClientMsg.JOIN_ROOM, { code: 'ZZZZ', name: 'Sam' });
  assert.equal((await client.next(ServerMsg.ERROR)).code, ErrorCode.ROOM_NOT_FOUND);
});
