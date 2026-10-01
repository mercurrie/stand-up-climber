import Phaser from 'phaser';
import { Rules } from '@stand-up-climber/shared';
import { COLORS, FONT_FAMILY, GAME_WIDTH, GAME_HEIGHT } from '../config/display.js';
import { Button } from '../ui/Button.js';
import { showToast } from '../ui/toast.js';
import { addMuteButton } from '../ui/MuteButton.js';
import { inviteLink, setRoomCodeInUrl } from '../networking/inviteLink.js';

const LIST_TOP = 260;
const ROW_HEIGHT = 34;

/**
 * Waiting room: shows the room code and who's here. The host starts the
 * round; when the server sends ROUND_START, main.js switches everyone to the
 * game scene.
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super('Lobby');
  }

  create() {
    this.session = this.registry.get('session');
    const cx = GAME_WIDTH / 2;
    const text = (x, y, value, size, color = COLORS.text) => this.add.text(x, y, value, {
      fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: 'bold', color,
    });

    text(cx, 50, 'STAND-UP CLIMBER', 30, COLORS.accent).setOrigin(0.5);
    text(cx, 100, 'ROOM CODE', 15, COLORS.textMuted).setOrigin(0.5);
    this.codeText = text(cx, 145, '', 64).setOrigin(0.5);
    this.codeText.setLetterSpacing?.(8);

    new Button(this, cx, 210, 'Copy invite link', () => this.copyInvite(), {
      width: 200, height: 40, fontSize: 17, variant: 'secondary',
    });

    this.playersHeader = text(40, LIST_TOP - 10, '', 17, COLORS.textMuted).setOrigin(0, 1);
    this.rows = this.add.container(0, 0);

    this.statusText = text(cx, GAME_HEIGHT - 170, '', 18, COLORS.textMuted).setOrigin(0.5).setAlign('center');
    this.startButton = new Button(this, cx, GAME_HEIGHT - 110, 'START GAME', () => this.session.startRound());
    new Button(this, cx, GAME_HEIGHT - 45, 'Leave room', () => this.leave(), {
      width: 160, height: 40, fontSize: 16, variant: 'secondary',
    });

    addMuteButton(this);

    const onRoom = (room) => this.render(room);
    this.session.on('room', onRoom);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.session.off('room', onRoom));

    if (this.session.room) this.render(this.session.room);
  }

  render(room) {
    this.codeText.setText(room.code);
    this.playersHeader.setText(`PLAYERS (${room.players.length}/${Rules.MAX_PLAYERS})`);

    this.rows.removeAll(true);
    room.players.forEach((player, i) => {
      const y = LIST_TOP + i * ROW_HEIGHT;
      const isYou = player.id === this.session.localId;
      const badges = [player.id === room.hostId ? '👑' : '', isYou ? '(you)' : ''].filter(Boolean).join(' ');
      this.rows.add([
        this.add.text(40, y, '✓', { fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', color: COLORS.good }),
        this.add.circle(76, y + 12, 8, player.color),
        this.add.text(94, y, `${player.name} ${badges}`, {
          fontFamily: FONT_FAMILY, fontSize: '20px', fontStyle: 'bold', color: isYou ? COLORS.accent : COLORS.text,
        }),
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
