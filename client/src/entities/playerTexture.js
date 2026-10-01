import { PLAYER } from '../config/gameplay.js';

export const PLAYER_TEXTURE = 'player';

/** A rounded white square with two little eyes. Tinted per player. */
export function ensurePlayerTexture(scene) {
  if (scene.textures.exists(PLAYER_TEXTURE)) return;
  const s = PLAYER.SIZE;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, s, s, 9);
  // Pupils sit right of centre so the character "looks" where it's going
  // (the sprite is flipped when moving left).
  g.fillStyle(0x1d1b2f, 1);
  g.fillCircle(s * 0.56, s * 0.4, 3.2);
  g.fillCircle(s * 0.8, s * 0.4, 3.2);
  g.generateTexture(PLAYER_TEXTURE, s, s);
  g.destroy();
}
