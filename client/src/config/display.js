// Logical game resolution. Phaser scales this to fit the browser window,
// so all game code can assume these dimensions.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

export const COLORS = {
  background: 0x1d1b2f,
  text: '#ffffff',
  textMuted: '#a9a6c9',
  good: '#7ee081',
  bad: '#ff6b6b',
  accent: '#ffd166',
};

// Player colours live in shared/ because the server assigns them.
export { PLAYER_COLORS } from '@stand-up-climber/shared';

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
