# Stand-Up Climber

A tiny multiplayer vertical platformer for deciding who hosts next week's stand-up.
Everyone climbs at once, grumpy falling balls knock you back to the bottom,
and the best climber wins the honour of hosting.

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

Other handy things:

- **Practice solo** on the menu plays a round on your own. Press R to restart
  it with new obstacles.
- **M** toggles sound, or use the 🔊 button on the menu and lobby.
- Red **!** markers at the top of the screen warn you about incoming
  obstacles. The bar on the right shows where everyone is.
- Add `?debug` to the URL to see physics hitboxes.

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

| Variable          | Where  | Default | Purpose |
| ----------------- | ------ | ------- | ------- |
| `PORT`            | server | `8080`  | The one port for the page, WebSocket and `/health` |
| `CLIENT_DIST`     | server | `client/dist` | Built game to serve. It's served if the folder exists |
| `VITE_SERVER_URL` | client (build time) | See below | Where the multiplayer server is |

If `VITE_SERVER_URL` isn't set, the client finds the server like this:

- **Dev** (`npm run dev`): `ws://<page-host>:8080`
- **Production build:** the same address as the page, since the Node server
  serves the game itself

Gameplay tuning (speeds, gravity, obstacle rates, level layout) lives in
`client/src/config/` and `client/src/level/`. Round timing lives in
`shared/src/protocol.js`.

## Production build (run it like the real thing)

```bash
npm run build   # builds the game into client/dist
npm start       # serves the game + multiplayer on http://localhost:8080
```

This is exactly what the hosted version runs.

## Deployment: Render (recommended, free)

One free Render web service hosts everything at one URL, such as
`https://stand-up-climber.onrender.com`. The repo includes a `render.yaml`
Blueprint, so setup is mostly clicking through.

1. Push this repo to GitHub.
2. Sign in at [render.com](https://render.com) with GitHub. No card is
   needed for the free plan.
3. Click **New → Blueprint**, pick this repository, and click **Apply**.
   Render reads `render.yaml`. It runs `npm ci && npm run build`, then
   `npm start`, and health-checks `/health`.
4. When the deploy finishes, open the service URL. That's the game. Share
   room links from the lobby as usual.

Every push to `main` redeploys automatically.

**Free-tier sleep:** Render's free services go to sleep after about 15
minutes with no traffic. The first visit afterwards takes about 30–60 s while
it wakes up. The menu shows "Connecting…" until then. Open the game a minute
before stand-up. Rooms only live in memory, so a restart or redeploy clears
them. That's fine for a weekly game.

### Alternatives

- **Other Node hosts** (Fly.io, Railway, a small VPS): use the same two
  commands, `npm ci && npm run build` then `npm start`. Make sure the host
  supports WebSockets and sets `PORT`, or leave it at 8080.
- **Game page on GitHub Pages, server elsewhere:** build with
  `VITE_SERVER_URL=wss://your-server.example.com npm run build` and publish
  `client/dist/`. Asset paths are relative, so sub-paths work. The server must
  use `wss://` (HTTPS), because GitHub Pages is HTTPS.
