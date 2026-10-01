import http from 'node:http';
import { WebSocketServer } from 'ws';
import { DEFAULT_SERVER_PORT } from '@stand-up-climber/shared';
import { GameServer } from './GameServer.js';

// Most free hosts (Render, Fly, Railway) inject PORT and expect one HTTP port.
// We serve a tiny health check over HTTP and upgrade WebSocket connections on
// the same port, so no extra configuration is needed when deploying.
const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...gameServer.stats() }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Stand-Up Climber server. Connect via WebSocket.');
});

// Our messages are tiny; cap the size so a bad client can't send huge payloads.
const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 });
const gameServer = new GameServer(wss);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (ws on same port)`);
});

function shutdown() {
  gameServer.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
