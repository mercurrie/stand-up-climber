import Phaser from 'phaser';
import { FONT_FAMILY } from '../config/display.js';

const STYLES = {
  primary: { fill: 0x4cc9f0, hover: 0x7ad9f5, text: '#1d1b2f' },
  secondary: { fill: 0x3a3760, hover: 0x4a4778, text: '#ffffff' },
};

/** A rounded, clickable button. Call setEnabled(false) to grey it out. */
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, x, y, label, onClick, { width = 220, height = 60, fontSize = 26, variant = 'primary' } = {}) {
    super(scene, x, y);
    this.style = STYLES[variant];
    this.w = width;
    this.h = height;
    this.enabled = true;

    this.bg = scene.add.graphics();
    this.text = scene.add.text(0, 0, label, {
      fontFamily: FONT_FAMILY, fontSize: `${fontSize}px`, fontStyle: 'bold', color: this.style.text,
    }).setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.draw(this.style.fill);

    this.setSize(width, height).setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.enabled && this.draw(this.style.hover));
    this.on('pointerout', () => this.draw(this.style.fill));
    this.on('pointerup', () => this.enabled && onClick());
    scene.add.existing(this);
  }

  draw(fill) {
    this.bg.clear();
    this.bg.fillStyle(fill, 1);
    this.bg.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
  }

  setLabel(label) {
    this.text.setText(label);
    return this;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.4);
    return this;
  }
}
