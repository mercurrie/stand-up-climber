import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { DEFAULT_SERVER_PORT } from '@stand-up-climber/shared';
import { GameServer } from './GameServer.js';
import { createStaticHandler } from './staticFiles.js';

// Most free hosts (Render, Fly, Railway) inject PORT and expect one HTTP port.
// Everything shares it: the health check, the built game files, and the
// WebSocket upgrade.
const PORT = Number(process.env.PORT) || DEFAULT_SERVER_PORT;

// The built client (`npm run build`). If it exists we serve it, so the whole
// game is one URL on one host. In development Vite serves the client instead.
const CLIENT_DIST = process.env.CLIENT_DIST
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const serveStatic = existsSync(CLIENT_DIST) ? createStaticHandler(CLIENT_DIST) : null;

const httpServer = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...gameServer.stats() }));
    return;
  }
  if (serveStatic && await serveStatic(req, res)) return;

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(serveStatic ? 'Not found' : 'Stand-Up Climber server. Connect via WebSocket.');
});

// Our messages are tiny; cap the size so a bad client can't send huge payloads.
const wss = new WebSocketServer({ server: httpServer, maxPayload: 16 * 1024 });
const gameServer = new GameServer(wss);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT} (ws on same port)`);
  console.log(serveStatic
    ? `[server] serving the game from ${CLIENT_DIST}`
    : '[server] no client build found; run `npm run build` to serve the game from here');
});

function shutdown() {
  gameServer.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
