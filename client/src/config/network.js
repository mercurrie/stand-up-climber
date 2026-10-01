import { DEFAULT_SERVER_PORT } from '@stand-up-climber/shared';

// In production, set VITE_SERVER_URL at build time (e.g. wss://climber.onrender.com).
// In development, default to the same host that served the page, so a coworker
// opening http://<your-ip>:5173 automatically connects to ws://<your-ip>:8080.
function defaultServerUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
}

export const SERVER_URL = import.meta.env.VITE_SERVER_URL || defaultServerUrl();
