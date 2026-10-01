import { FONT_FAMILY } from '../config/display.js';

const SPARK_KEY = 'spark';

/** Small reusable juice: particle bursts and floating text. One per scene. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    ensureSparkTexture(scene);

    this.emitter = scene.add.particles(0, 0, SPARK_KEY, {
      emitting: false,
      speed: { min: 80, max: 320 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: { min: 300, max: 600 },
      gravityY: 500,
    }).setDepth(50);
  }

  burst(x, y, color, count = 18) {
    this.emitter.setParticleTint(color);
    this.emitter.explode(count, x, y);
  }

  floatingText(x, y, text, color = '#ffffff') {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '26px',
      fontStyle: 'bold',
      color,
      stroke: '#1d1b2f',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(60);

    this.scene.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}

function ensureSparkTexture(scene) {
  if (scene.textures.exists(SPARK_KEY)) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture(SPARK_KEY, 8, 8);
  g.destroy();
}
