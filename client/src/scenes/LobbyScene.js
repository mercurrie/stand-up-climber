import Phaser from 'phaser';
import { HATS, PLAYER_COLORS, Rules } from '@stand-up-climber/shared';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';
import { saveLook } from '../config/look.js';
import { Button } from '../ui/Button.js';
import { showToast } from '../ui/toast.js';
import { addMuteButton } from '../ui/MuteButton.js';
import { inviteLink, setRoomCodeInUrl } from '../networking/inviteLink.js';
import { createCharacter } from '../entities/characterView.js';
import { HatView } from '../entities/hats.js';

// "Your look" panel: preview on the left, colour swatches and hats on the right.
const PANEL_TOP = 178;
const PANEL_HEIGHT = 148;
// Sized so the tallest hat clears the "YOUR LOOK" label.
const PREVIEW = { x: 78, feetY: PANEL_TOP + 136, scale: 1.7 };
const PICKER_COLUMNS = [176, 232, 288, 344, 400];
const SWATCH_ROWS = [PANEL_TOP + 34, PANEL_TOP + 72];
const SWATCH_RADIUS = 16;
const HAT_ROW_Y = PANEL_TOP + 118;
const HAT_BUTTON = { width: 50, height: 44 };

const LIST_TOP = 362;
const ROW_HEIGHT = 27;

/**
 * Waiting room: room code, your look (colour + hat), and who's here. The host
 * starts the round; when the server sends ROUND_START, main.js switches
 * everyone to the game scene.
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    this.session = this.registry.get('session');
    const cx = GAME_WIDTH / 2;

    this.text(cx, 32, 'STAND-UP CLIMBER', 24, COLORS.accent).setOrigin(0.5);
    this.text(cx, 64, 'ROOM CODE', 13, COLORS.textMuted).setOrigin(0.5);
    this.codeText = this.text(cx, 102, '', 50).setOrigin(0.5);
    this.codeText.setLetterSpacing?.(8);
    new Button(this, cx, 150, 'Copy invite link', () => this.copyInvite(), {
      width: 190, height: 34, fontSize: 16, variant: 'secondary',
    });

    this.createLookPanel();

    this.playersHeader = this.text(32, LIST_TOP - 8, '', 15, COLORS.textMuted).setOrigin(0, 1);
    this.rows = this.add.container(0, 0);

    this.statusText = this.text(cx, GAME_HEIGHT - 145, '', 16, COLORS.textMuted).setOrigin(0.5).setAlign('center');
    this.startButton = new Button(this, cx, GAME_HEIGHT - 95, 'START GAME', () => this.session.startRound(), {
      height: 52,
    });
    new Button(this, cx, GAME_HEIGHT - 36, 'Leave room', () => this.leave(), {
      width: 150, height: 34, fontSize: 15, variant: 'secondary',
    });

    addMuteButton(this);

    const onRoom = (room) => this.render(room);
    this.session.on('room', onRoom);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.session.off('room', onRoom));

    if (this.session.room) this.render(this.session.room);
  }

  text(x, y, value, size, color = COLORS.text) {
    return this.add.text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: 'bold', color });
  }

  // --- Your look --------------------------------------------------------

  createLookPanel() {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.25);
    panel.fillRoundedRect(16, PANEL_TOP, GAME_WIDTH - 32, PANEL_HEIGHT, 14);
    this.text(30, PANEL_TOP + 8, 'YOUR LOOK', 13, COLORS.textMuted);

    this.preview = null;
    this.previewKey = '';

    // Colours: two rows of five. Taken ones are dimmed and can't be picked.
    this.swatches = PLAYER_COLORS.map((color, i) => {
      const x = PICKER_COLUMNS[i % 5];
      const y = SWATCH_ROWS[Math.floor(i / 5)];
      const ring = this.add.circle(x, y, SWATCH_RADIUS + 4).setStrokeStyle(3, 0xffffff).setVisible(false);
      const dot = this.add.circle(x, y, SWATCH_RADIUS, color).setInteractive({ useHandCursor: true });
      dot.on('pointerup', () => this.pickLook({ color }));
      return { color, ring, dot };
    });

    // Hats: one button each, showing the hat itself.
    this.hatButtons = HATS.map(({ id, label }, i) => {
      const x = PICKER_COLUMNS[i];
      const bg = this.add.graphics();
      const hit = this.add.zone(x, HAT_ROW_Y, HAT_BUTTON.width, HAT_BUTTON.height).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.pickLook({ hat: id }));
      hit.on('pointerover', () => this.showHatLabel(label));
      hit.on('pointerout', () => this.showHatLabel(''));
      if (id === 'none') {
        this.text(x, HAT_ROW_Y, '✕', 20, COLORS.textMuted).setOrigin(0.5);
      } else {
        const hat = new HatView(this, id, 0.8);
        hat.setPosition(x, HAT_ROW_Y - hat.visualCenterOffset);
      }
      return { id, x, bg };
    });
    this.hatLabel = this.text(PICKER_COLUMNS[2], PANEL_TOP + 8, '', 13, COLORS.textMuted).setOrigin(0.5, 0);
  }

  pickLook(change) {
    saveLook(change);
    this.session.setLook(change);
  }

  showHatLabel(label) {
    this.hatLabel.setText(label);
  }

  renderLookPanel(me, room) {
    if (!me) return;
    const key = `${me.color}|${me.hat}`;
    if (key !== this.previewKey) {
      this.previewKey = key;
      this.preview?.destroy();
      this.preview = createCharacter(this, PREVIEW.x, PREVIEW.feetY, me, PREVIEW.scale);
      // A happy little hop whenever you change something.
      this.tweens.add({ targets: this.preview, y: PREVIEW.feetY - 14, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    }

    const takenByOthers = new Set(room.players.filter((p) => p.id !== me.id).map((p) => p.color));
    for (const { color, ring, dot } of this.swatches) {
      const taken = takenByOthers.has(color);
      ring.setVisible(color === me.color);
      dot.setAlpha(taken ? 0.2 : 1);
      if (taken) dot.disableInteractive();
      else dot.setInteractive({ useHandCursor: true });
    }

    for (const { id, x, bg } of this.hatButtons) {
      const selected = id === me.hat;
      bg.clear();
      bg.fillStyle(selected ? 0x4a4778 : 0x2b2950, 1);
      bg.fillRoundedRect(x - HAT_BUTTON.width / 2, HAT_ROW_Y - HAT_BUTTON.height / 2, HAT_BUTTON.width, HAT_BUTTON.height, 10);
      if (selected) {
        bg.lineStyle(2, 0xffd166, 1);
        bg.strokeRoundedRect(x - HAT_BUTTON.width / 2, HAT_ROW_Y - HAT_BUTTON.height / 2, HAT_BUTTON.width, HAT_BUTTON.height, 10);
      }
    }
  }

  // --- Room -------------------------------------------------------------

  render(room) {
    this.codeText.setText(room.code);
    this.playersHeader.setText(`PLAYERS (${room.players.length}/${Rules.MAX_PLAYERS})`);
    this.renderLookPanel(room.players.find((p) => p.id === this.session.localId), room);

    this.rows.removeAll(true);
    room.players.forEach((player, i) => {
      const y = LIST_TOP + i * ROW_HEIGHT;
      const isYou = player.id === this.session.localId;
      const badges = [player.id === room.hostId ? '👑' : '', isYou ? '(you)' : ''].filter(Boolean).join(' ');
      this.rows.add([
        this.text(32, y, '✓', 18, COLORS.good),
        createCharacter(this, 66, y + 22, player, 0.5),
        this.text(88, y + 1, `${player.name} ${badges}`, 18, isYou ? COLORS.accent : COLORS.text),
      ]);
    });

    const enoughPlayers = room.players.length >= Rules.MIN_PLAYERS;
    this.startButton.setVisible(this.session.isHost).setEnabled(enoughPlayers && room.phase !== 'playing');
    this.statusText.setText(this.statusFor(room, enoughPlayers));
  }

  statusFor(room, enoughPlayers) {
    if (room.phase === 'playing') return "A round is in progress.\nYou'll join the next one!";
    if (!enoughPlayers) return `Share the code! Need at least ${Rules.MIN_PLAYERS} players.`;
    if (!this.session.isHost) return 'Waiting for the host to start…';
    return 'Everyone here? Hit start!';
  }

  async copyInvite() {
    const link = inviteLink(this.session.room.code);
    try {
      await navigator.clipboard.writeText(link);
      showToast('Invite link copied!');
    } catch {
      // Clipboard can be blocked (e.g. non-HTTPS on a LAN IP): show the link instead.
      showToast(link);
    }
  }

  leave() {
    this.session.leaveRoom();
    setRoomCodeInUrl(null);
    this.scene.start('Menu');
  }
}
