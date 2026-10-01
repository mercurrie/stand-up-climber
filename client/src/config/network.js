import { DEFAULT_SERVER_PORT } from '@stand-up-climber/shared';

// Where the multiplayer server is:
//   1. VITE_SERVER_URL, if set at build time (e.g. when the page is on GitHub
//      Pages and the server is hosted elsewhere).
//   2. In development: the same host that served the page, on the server's
//      port, so a coworker opening http://<your-ip>:5173 connects to
//      ws://<your-ip>:8080.
//   3. In a production build: the same address as the page, because the Node
//      server serves the built game itself (one URL, e.g. on Render).
function defaultServerUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV) return `${protocol}://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
  return `${protocol}://${window.location.host}`;
}

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || defaultServerUrl();
