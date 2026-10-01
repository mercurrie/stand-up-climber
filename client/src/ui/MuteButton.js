import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';

/** A small speaker icon in the bottom-right corner that toggles sound. */
export function addMuteButton(scene) {
  const sfx = scene.registry.get('sfx');
  const icon = scene.add.text(GAME_WIDTH - 14, GAME_HEIGHT - 12, '', { fontSize: '24px' })
    .setOrigin(1, 1).setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
  const render = (muted) => icon.setText(muted ? '🔇' : '🔊');
  render(sfx.muted);

  icon.on('pointerup', () => sfx.toggleMute());
  sfx.on('change', render);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.off('change', render));
  return icon;
}
