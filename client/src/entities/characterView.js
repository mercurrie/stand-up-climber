import { PLAYER_TEXTURE, ensurePlayerTexture } from './playerTexture.js';
import { HatView } from './hats.js';

/**
 * A static character (body + hat) for menus: the lobby preview, player list
 * and results screen. (x, y) is the feet position. Returns a container with
 * `bodySprite`, `hat` (the HatView) and `characterHeight` (body + hat, in px).
 */
export function createCharacter(scene, x, y, { color, hat }, scale = 1) {
  ensurePlayerTexture(scene);
  const bodySprite = scene.add.image(0, 0, PLAYER_TEXTURE).setOrigin(0.5, 1).setTint(color).setScale(scale);
  const hatView = new HatView(scene, hat, scale).placeOnHead(0, 0);
  const container = scene.add.container(x, y, [bodySprite, hatView]);
  container.bodySprite = bodySprite;
  container.hat = hatView;
  container.characterHeight = bodySprite.displayHeight + hatView.heightAboveHead;
  return container;
}
