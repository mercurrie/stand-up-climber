# Stand-Up Climber

A tiny multiplayer vertical platformer for deciding who hosts next week's stand-up.
Everyone climbs at once, falling blocks knock you back to the bottom, and the
best climber wins the honour of hosting.

> **Status:** Phase 5 (multiplayer). Create a room, share the code or invite
> link, and the host starts the race. "Practice solo" is still on the menu.
> Add `?debug` to the URL to see physics hitboxes.

## How to play

1. Enter your name and **Create room**. You'll get a 4-letter code like `K7F2`.
2. Share the code, or press **Copy invite link** (`…/?room=K7F2`) and paste it
   in your team chat.
3. Everyone else enters their name and the code, then presses **Join**.
4. The host (👑) presses **Start game**. After 3-2-1-GO, use ← → or A D to
   move. You bounce automatically. Dodge the falling balls, or you go back to
   the bottom.
5. The winner hosts next week's stand-up. The host can press **Play again**.

Rooms hold 2–10 players. If the host leaves, the next person becomes host.
Anyone who joins mid-round waits in the lobby and joins the next round.

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
└── shared/   Protocol, round rules (RoundState) and player colours used by both sides
```

This is an npm workspaces monorepo. `shared` is linked into `client` and
`server` automatically by `npm install`.

### How the networking works

The server is a referee, not a physics engine:

- **Each browser runs its own game.** Movement, collisions and obstacle hits
  are all local. Each client reports its position and progress about 10 times
  a second (`PLAYER_STATE`).
- **The server runs the rules.** `server/src/GameRoom.js` runs the shared
  `RoundState` with its own clock. It picks the start time and obstacle seed,
  decides who reached the top first and when the round ends, and sends the
  final rankings. It also relays everyone's positions about 10 times a second
  (`SNAPSHOT`).
- **Obstacles cost no bandwidth.** Every client builds the same obstacle
  schedule from the seed and places obstacles by time since the round started.
- **Clocks are synced with ping/pong.** Each client estimates the offset
  between its clock and the server's, so the countdown and obstacles line up
  across browsers.
- **Other players' characters glide.** Each one eases towards its latest
  reported position, because updates only arrive 10 times a second.

All message types are documented in `shared/src/protocol.js`.

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

1. Open http://localhost:5173 in two **separate windows**, side by side.
   Background tabs pause the game, so tabs won't work.
2. In one window, create a room. In the other, join with the code (or paste
   the invite link).
3. Start the game from the host window. Each window counts as a separate
   player. Click into a window to control that player.

A private or incognito window gets its own saved name, which helps tell the
two windows apart.

To let coworkers on the same network join, have them open
`http://<your-LAN-IP>:5173`. The client connects to the WebSocket server on
whatever host served the page, so no extra configuration is needed. (Copying
the invite link needs HTTPS or localhost. On a LAN IP the link is shown in a
notice instead.)

### Tests

```bash
npm test
```

This runs the round-rule unit tests (`shared/test`) and a server integration
test (`server/test`). The integration test drives real WebSocket clients
through creating, joining, starting, finishing, host transfer and
disconnecting.

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
