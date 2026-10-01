import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path,
  // e.g. https://<user>.github.io/stand-up-climber/
  base: './',
  server: {
    port: 5173,
    // Listen on the LAN too, so coworkers can join your dev machine.
    host: true,
  },
  build: {
    // Phaser alone is ~1.2 MB minified (~320 KB gzipped); that's expected.
    chunkSizeWarningLimit: 1500,
  },
});
