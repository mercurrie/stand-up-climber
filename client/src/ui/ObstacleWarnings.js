const TEXTURE_KEY = 'obstacle-warning';
// Show a marker for obstacles up to this far above the top of the screen.
const WARNING_DISTANCE = 450;
const POOL_SIZE = 12;
const DEPTH = 90;

/**
 * Little "!" markers along the top edge of the screen for obstacles that are
 * about to fall into view. They fade in as the obstacle gets closer.
 *
 * `clearTopAt(x)` gives the highest screen y at column x that isn't covered
 * by HUD text (see Hud.clearTopAt), so markers never sit on the leaderboard.
 */
export class ObstacleWarnings {
  constructor(scene, obstacleField, clearTopAt) {
    this.scene = scene;
    this.obstacles = obstacleField;
    this.clearTopAt = clearTopAt;
    ensureWarningTexture(scene);
    this.markers = Array.from({ length: POOL_SIZE }, () => scene.add.image(0, 0, TEXTURE_KEY)
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH).setVisible(false));
  }

  update() {
    const viewTop = this.scene.cameras.main.worldView.top;
    let used = 0;
    for (const { sprite } of this.obstacles.active) {
      if (used === POOL_SIZE) break;
      const distance = viewTop - sprite.y;
      if (distance <= 0 || distance > WARNING_DISTANCE) continue;
      this.markers[used++]
        .setVisible(true)
        .setPosition(sprite.x, this.clearTopAt(sprite.x))
        .setAlpha(1 - distance / WARNING_DISTANCE);
    }
    for (let i = used; i < POOL_SIZE; i++) this.markers[i].setVisible(false);
  }
}

function ensureWarningTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xff6b6b, 1);
  g.fillTriangle(12, 0, 0, 20, 24, 20);
  g.fillStyle(0x1d1b2f, 1);
  g.fillRect(11, 5, 2.5, 8);
  g.fillRect(11, 15, 2.5, 2.5);
  g.generateTexture(TEXTURE_KEY, 24, 20);
  g.destroy();
}
