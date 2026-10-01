# Stand-Up Climber

A tiny multiplayer vertical platformer for deciding who hosts next week's stand-up.
Everyone climbs at once, falling blocks knock you back to the bottom, and the
best climber wins the honour of hosting.

> **Status:** Phase 4 (full solo round). Press any key on the title screen to
> play a practice round: a 3-2-1 countdown, a 90 s timer, live progress, and
> the results screen. Use ← → or A D to move; you bounce automatically. Dodge
> the falling balls, or you go back to the bottom. In practice, R restarts with
> a new obstacle pattern. Add `?debug` to the URL to see physics hitboxes.

## Rules

- Progress is the height of the highest platform you've landed on (0–100%).
  Getting hit resets your *current* progress, but your *best* is kept.
- The first player to reach the top starts a 10 s finishing window. The round
  also ends after 90 s, or as soon as everyone has reached the top.
- Highest best progress wins. Ties go to whoever reached that height first.

The rules live in `shared/src/RoundState.js` and are unit-tested (`npm test`).

## Repository layout

```text
stand-up-climber/
├── client/   Vite + Phaser 3 browser game (builds to static files)
├── server/   Node.js + ws multiplayer server (rooms, timing, results)
└── shared/   Protocol message names and round timing used by both sides
```

This is an npm workspaces monorepo. `shared` is linked into `client` and
`server` automatically by `npm install`.

**How the networking works:** each browser runs its own physics. The server
handles rooms, the official start time, player progress and results. Clients
estimate their clock offset from the server with a ping/pong exchange, so they
can all start the round at the same moment.

## Requirements

- Node.js 20.19+ (or 22.12+)

## Local development

```bash
npm install
npm run dev
```

This starts both:

| Process | URL                       | Notes                                   |
| ------- | ------------------------- | --------------------------------------- |
| client  | http://localhost:5173     | Vite dev server with hot reload         |
| server  | ws://localhost:8080       | Restarts on file changes (`node --watch`) |
|         | http://localhost:8080/health | Health check (JSON)                 |

To run them separately:

```bash
npm run dev:server
npm run dev:client
```

### Testing multiplayer locally

Open http://localhost:5173 in several browser windows or tabs. Each tab gets its
own WebSocket connection and counts as a separate player. Put two windows side
by side to watch them play together.

To let coworkers on the same network join, have them open
`http://<your-LAN-IP>:5173`. The client connects to the WebSocket server on
whatever host served the page, so no extra configuration is needed.

## Configuration

| Variable          | Where  | Default                     | Purpose                              |
| ----------------- | ------ | --------------------------- | ------------------------------------ |
| `PORT`            | server | `8080`                      | HTTP + WebSocket port                |
| `VITE_SERVER_URL` | client | `ws://<page-host>:8080`     | Server URL, baked in at build time   |

Gameplay tuning (speeds, gravity, round timing, level layout) lives in
`client/src/config/` and `shared/src/protocol.js`.

## Production build

```bash
VITE_SERVER_URL=wss://your-server.example.com npm run build
```

The static site is written to `client/dist/`. Asset paths are relative, so it
works from a sub-path such as GitHub Pages.

## Deployment

The client and server deploy separately.

### Client: GitHub Pages (or any static host)

1. Build with `VITE_SERVER_URL` pointing at your deployed server (it must use
   `wss://`, because GitHub Pages serves over HTTPS).
2. Publish `client/dist/`. With GitHub Actions: build, then use
   `actions/upload-pages-artifact` with `path: client/dist`, followed by
   `actions/deploy-pages`.

Netlify, Cloudflare Pages and Vercel also work. Use build command `npm run build`
and publish directory `client/dist`.

### Server: any Node host that supports WebSockets

The server uses one port and reads `PORT` from the environment. Start it from
the repo root, so the `shared` workspace gets installed:

- **Install:** `npm install --workspace server --include-workspace-root`
- **Start:** `npm start`
- **Health check path:** `/health`

Free or cheap options:

- **Render** (free web service). Note: it sleeps after inactivity, so the first
  connection takes about 30–60 s. Open the game a minute before stand-up.
- **Fly.io** (small free allowance).
- **Railway** (trial credits, then usage-based).
- Any small VPS running `npm start` behind a TLS proxy (for example Caddy).
