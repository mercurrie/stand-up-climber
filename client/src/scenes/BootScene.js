import Phaser from 'phaser';
import { ServerMsg } from '@stand-up-climber/shared';
import { NetworkClient } from '../networking/NetworkClient.js';
import { SERVER_URL } from '../config/network.js';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';

const PING_INTERVAL_MS = 1000;

/**
 * Title screen. Connects to the server and shows connection status/latency.
 * Later this scene will hand off to the menu once connected.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, GAME_HEIGHT * 0.3, 'STAND-UP\nCLIMBER', {
      fontFamily: FONT_FAMILY,
      fontSize: '56px',
      fontStyle: 'bold',
      color: COLORS.accent,
      align: 'center',
    }).setOrigin(0.5);

    // A bouncing square, just to confirm the render loop is running.
    const square = this.add.rectangle(cx, GAME_HEIGHT * 0.52, 36, 36, 0x4cc9f0);
    this.tweens.add({
      targets: square,
      y: square.y - 60,
      duration: 420,
      ease: 'Quad.easeOut',
      yoyo: true,
      repeat: -1,
    });

    this.statusText = this.add.text(cx, GAME_HEIGHT * 0.7, `Connecting to ${SERVER_URL}…`, {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: COLORS.textMuted,
      align: 'center',
      wordWrap: { width: GAME_WIDTH - 40 },
    }).setOrigin(0.5);

    this.add.text(cx, GAME_HEIGHT * 0.84, 'Press any key or click to climb', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      fontStyle: 'bold',
      color: COLORS.text,
    }).setOrigin(0.5);

    // Phase 2: straight into a solo climb. Phase 5 replaces this with the
    // create/join room menu.
    const start = () => this.scene.start('Game');
    this.input.keyboard.once('keydown', start);
    this.input.once('pointerdown', start);

    this.connect();
  }

  connect() {
    const net = new NetworkClient(SERVER_URL);
    this.registry.set('net', net);

    // The connection outlives this scene, so unsubscribe our UI handlers when
    // the scene shuts down.
    const unsubscribers = [
      net.on('open', () => net.ping()),
      net.on(ServerMsg.PONG, () => {
        this.setStatus(`Connected ✓  ping ${net.latencyMs} ms`, COLORS.good);
      }),
      net.on('close', () => {
        this.setStatus('Disconnected from server.\nIs it running? (npm run dev)', COLORS.bad);
      }),
    ];
    net.connect();

    const timer = this.time.addEvent({
      delay: PING_INTERVAL_MS,
      loop: true,
      callback: () => net.ping(),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      timer.remove();
      unsubscribers.forEach((off) => off());
    });
  }

  setStatus(text, color) {
    this.statusText.setText(text).setColor(color);
  }
}
