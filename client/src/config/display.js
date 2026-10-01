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

// One per player slot (rooms hold up to 10). Picked to be distinct from each
// other and from the platform section colours.
export const PLAYER_COLORS = [
  0xff6b9d, 0x4cc9f0, 0xffd166, 0x7ee081, 0xb388ff,
  0xff9f43, 0x00d2d3, 0xf368e0, 0xc8d6e5, 0xee5253,
];

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
